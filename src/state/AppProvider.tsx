import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { BRANCHES } from '../constants/branches';
import { buildOutboxEntry, buildSimulatedOrder, sortOutboxChronologically } from '../lib/domain';
import { normalizeTerminalSettings } from '../lib/settings';
import {
  createDefaultTerminalSettings,
  createHistoricalOrders,
  createSeedMenu,
  createSeedOrders,
  createSeedReservations,
  createSeedTables,
  isHistoricalDatasetCurrent,
} from '../lib/seed';
import * as db from '../db/sqlite';
import { playAlertTone } from '../services/alertTones';
import { appReducer, AppState, initialAppState } from './reducer';
import {
  loginStaff,
  logoutStaff,
  persistSession,
  restoreSession,
  setActiveBranchId,
} from '../services/auth';
import {
  isPocketBaseConfigured,
  isPocketBaseReachable,
  pocketBaseDiagnostics,
  PocketBaseDiagnostics,
} from '../services/pocketbase';
import {
  assignedBranchId,
  canCreateMenuItems,
  canDeleteMenuItems,
  canDeleteTables,
} from '../services/branchScope';
import { startRealtime } from '../services/realtime';
import { flushOutbox, SyncFailure } from '../services/sync';
import { describeSyncHint } from '../services/errors';
import { runNetworkProbe, NetworkProbeResult } from '../services/networkProbe';
import { fetchBranchSnapshot, BranchSnapshot } from '../services/data';
import {
  Branch,
  ConnectionStatus,
  DaySchedule,
  DiningTable,
  MenuItem,
  OrderStatus,
  OutboxActionType,
  ReservationStatus,
  StaffSession,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface SyncDiagnosticsReport {
  generatedAt: string;
  pocketbase: PocketBaseDiagnostics;
  network: NetworkProbeResult;
  queue: { pending: number; actions: string[] };
  result: { synced: number; failed: number };
  failures: Array<{
    actionType: string;
    label: string;
    kind: string;
    status: number;
    message: string;
    detail: string;
    hint: string;
  }>;
  discarded: Array<{
    actionType: string;
    label: string;
    kind: string;
    status: number;
    message: string;
  }>;
}

interface AppContextValue {
  state: AppState;
  isLiveBackend: boolean;
  login: (email: string, password: string, branchCode: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  simulateIncomingOrder: () => Promise<void>;
  setMenuItemStock: (itemId: string, inStock: boolean) => Promise<void>;
  setMenuItemPrice: (itemId: string, price: number) => Promise<void>;
  saveMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  saveTable: (table: DiningTable) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  updateReservationStatus: (
    reservationId: string,
    status: ReservationStatus
  ) => Promise<void>;
  toggleStoreOpen: (isOpen: boolean) => Promise<void>;
  setSlotInterval: (minutes: number) => Promise<void>;
  updateWeeklySchedule: (schedule: DaySchedule[]) => Promise<void>;
  toggleAcceptingReservations: (accepting: boolean) => Promise<void>;
  saveTerminalSettings: (settings: TerminalSettings) => Promise<void>;
  syncOutboxNow: () => Promise<void>;
  clearOutbox: () => Promise<void>;
  runSyncDiagnostics: () => Promise<SyncDiagnosticsReport>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setBranch: (branch: Branch) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Slow recovery cadence for outbox actions that failed while offline. */
const OUTBOX_RETRY_INTERVAL_MS = 30_000;

function syntheticBranch(
  branchId: string,
  branchName: string | undefined,
  settings: TerminalSettings
): Branch {
  return {
    id: branchId,
    name: branchName || settings.branchName || 'Restaurant Branch',
    code: branchId.slice(-5).toUpperCase(),
    address: '',
    phone: '',
    isActive: true,
  };
}

function resolveBranch(
  branchId: string,
  branches: Branch[],
  session: StaffSession | null,
  settings: TerminalSettings
): Branch {
  return (
    branches.find((branch) => branch.id === branchId) ??
    BRANCHES.find((branch) => branch.id === branchId) ??
    syntheticBranch(branchId, session?.branchName, settings)
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const stateRef = useRef(state);
  const remoteRequestIdRef = useRef(0);
  const remoteLoadedBranchRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const lastSyncFailuresRef = useRef<SyncFailure[]>([]);
  const lastDiscardedRef = useRef<SyncFailure[]>([]);
  const lastFlushRef = useRef({ synced: 0, failed: 0 });
  const [realtimeEpoch, setRealtimeEpoch] = useState(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Hydrate instantly from SQLite. Live builds never inject demo records.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const now = Date.now();
      const [
        session,
        cachedOrders,
        cachedMenu,
        cachedTables,
        cachedReservations,
        cachedStoreConfig,
        cachedSettings,
        cachedAnalyticsHistory,
        cachedOutbox,
      ] = await Promise.all([
        restoreSession().catch(() => null as StaffSession | null),
        db.loadSnapshot<AppState['orders']>(db.SNAPSHOT_KEYS.orders).catch(() => null),
        db.loadSnapshot<MenuItem[]>(db.SNAPSHOT_KEYS.menu).catch(() => null),
        db.loadSnapshot<DiningTable[]>(db.SNAPSHOT_KEYS.tables).catch(() => null),
        db.loadSnapshot<AppState['reservations']>(db.SNAPSHOT_KEYS.reservations).catch(
          () => null
        ),
        db
          .loadSnapshot<StoreOperationsConfig>(db.SNAPSHOT_KEYS.storeConfig)
          .catch(() => null),
        db.loadTerminalSettings().catch(() => null),
        db
          .loadSnapshot<AppState['analyticsHistory']>(db.SNAPSHOT_KEYS.analyticsHistory)
          .catch(() => null),
        db.readOutbox().catch(() => []),
      ]);

      if (cancelled) return;

      const cachedNormalized = normalizeTerminalSettings(cachedSettings);
      const branchId =
        session?.branchId ??
        cachedNormalized.pocketbaseBranchId ??
        (BRANCHES[0] as Branch).id;
      const branch = resolveBranch(branchId, BRANCHES, session, cachedNormalized);
      const defaults = normalizeTerminalSettings({
        ...createDefaultTerminalSettings(),
        branchName: branch.name,
        pocketbaseBranchId: branch.id,
      });
      const settings = normalizeTerminalSettings(
        {
          ...cachedNormalized,
          branchName: branch.name,
          pocketbaseBranchId: branch.id,
        },
        defaults
      );

      const live = isPocketBaseConfigured;
      const orders = live
        ? cachedOrders ?? []
        : cachedOrders && cachedOrders.length > 0
          ? cachedOrders
          : createSeedOrders(now);
      const menuItems = live
        ? cachedMenu ?? []
        : cachedMenu && cachedMenu.length > 0
          ? cachedMenu
          : createSeedMenu(now);
      const tables = live
        ? cachedTables ?? []
        : cachedTables && cachedTables.length > 0
          ? cachedTables
          : createSeedTables();
      const reservations = live
        ? cachedReservations ?? []
        : cachedReservations && cachedReservations.length > 0
          ? cachedReservations
          : createSeedReservations();
      const historyIsCurrent = cachedAnalyticsHistory
        ? isHistoricalDatasetCurrent(cachedAnalyticsHistory, now)
        : false;
      const analyticsHistory = live
        ? cachedAnalyticsHistory ?? []
        : historyIsCurrent
          ? (cachedAnalyticsHistory as AppState['analyticsHistory'])
          : createHistoricalOrders(now);

      dispatch({
        type: 'HYDRATE',
        payload: {
          session,
          activeBranch: branch,
          branches: BRANCHES,
          orders,
          analyticsHistory,
          menuItems,
          tables,
          reservations,
          storeConfig: cachedStoreConfig ?? initialAppState.storeConfig,
          settings,
          outbox: cachedOutbox,
        },
      });

      if (!live) {
        if (!cachedOrders?.length) {
          void db.saveSnapshot(db.SNAPSHOT_KEYS.orders, orders).catch(() => undefined);
        }
        if (!cachedMenu?.length) {
          void db.saveSnapshot(db.SNAPSHOT_KEYS.menu, menuItems).catch(() => undefined);
        }
        if (!cachedTables?.length) {
          void db.saveSnapshot(db.SNAPSHOT_KEYS.tables, tables).catch(() => undefined);
        }
        if (!cachedReservations?.length) {
          void db
            .saveSnapshot(db.SNAPSHOT_KEYS.reservations, reservations)
            .catch(() => undefined);
        }
        if (!cachedStoreConfig) {
          void db
            .saveSnapshot(db.SNAPSHOT_KEYS.storeConfig, initialAppState.storeConfig)
            .catch(() => undefined);
        }
        if (!historyIsCurrent) {
          void db
            .saveSnapshot(db.SNAPSHOT_KEYS.analyticsHistory, analyticsHistory)
            .catch(() => undefined);
        }
      }
      if (!cachedSettings) {
        void db.saveTerminalSettings(settings).catch(() => undefined);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep SQLite warm so the same live snapshot is available offline.
  useEffect(() => {
    if (!state.hydrated) return;
    void db.saveSnapshot(db.SNAPSHOT_KEYS.orders, state.orders).catch(() => undefined);
  }, [state.hydrated, state.orders]);

  useEffect(() => {
    if (!state.hydrated) return;
    void db.saveSnapshot(db.SNAPSHOT_KEYS.menu, state.menuItems).catch(() => undefined);
  }, [state.hydrated, state.menuItems]);

  useEffect(() => {
    if (!state.hydrated) return;
    void db.saveSnapshot(db.SNAPSHOT_KEYS.tables, state.tables).catch(() => undefined);
  }, [state.hydrated, state.tables]);

  useEffect(() => {
    if (!state.hydrated) return;
    void db
      .saveSnapshot(db.SNAPSHOT_KEYS.reservations, state.reservations)
      .catch(() => undefined);
  }, [state.hydrated, state.reservations]);

  useEffect(() => {
    if (!state.hydrated) return;
    void db
      .saveSnapshot(db.SNAPSHOT_KEYS.storeConfig, state.storeConfig)
      .catch(() => undefined);
  }, [state.hydrated, state.storeConfig]);

  useEffect(() => {
    if (!state.hydrated) return;
    void db
      .saveSnapshot(db.SNAPSHOT_KEYS.analyticsHistory, state.analyticsHistory)
      .catch(() => undefined);
  }, [state.hydrated, state.analyticsHistory]);

  // Remote settings (SSE or a fetched snapshot) must survive an offline restart
  // even when the user never opens the settings screen.
  useEffect(() => {
    if (!state.hydrated) return;
    void db.saveTerminalSettings(state.settings).catch(() => undefined);
  }, [state.hydrated, state.settings]);

  const playIncomingAlert = useCallback((): void => {
    const { alertToneId, soundAlertsEnabled } = stateRef.current.settings;
    if (!soundAlertsEnabled) return;
    void playAlertTone(alertToneId);
  }, []);

  const applyBranchSnapshot = useCallback(
    (branchId: string, snapshot: BranchSnapshot): void => {
      const branch =
        snapshot.branches.find((entry) => entry.id === branchId) ??
        resolveBranch(
          branchId,
          snapshot.branches,
          stateRef.current.session,
          snapshot.settings
        );
      const defaults = normalizeTerminalSettings({
        ...createDefaultTerminalSettings(),
        branchName: branch.name,
        pocketbaseBranchId: branchId,
      });
      const settings = normalizeTerminalSettings(
        {
          ...snapshot.settings,
          branchName: branch.name,
          pocketbaseBranchId: branchId,
        },
        defaults
      );

      remoteLoadedBranchRef.current = branchId;
      dispatch({
        type: 'APPLY_REMOTE_DATA',
        payload: {
          activeBranch: branch,
          branches: snapshot.branches,
          orders: snapshot.orders,
          analyticsHistory: snapshot.analyticsHistory,
          menuItems: snapshot.menuItems,
          tables: snapshot.tables,
          reservations: snapshot.reservations,
          storeConfig: snapshot.storeConfig,
          settings,
          syncedAt: Date.now(),
        },
      });
    },
    []
  );

  const refreshRemoteData = useCallback(
    async (branchId: string): Promise<void> => {
      if (!isPocketBaseConfigured) return;
      const requestId = remoteRequestIdRef.current + 1;
      remoteRequestIdRef.current = requestId;
      dispatch({ type: 'SET_CONNECTION', status: 'polling' });

      try {
        const snapshot = await fetchBranchSnapshot(branchId);
        if (
          requestId !== remoteRequestIdRef.current ||
          stateRef.current.session?.branchId !== branchId
        ) {
          return;
        }
        applyBranchSnapshot(branchId, snapshot);
        dispatch({ type: 'SET_CONNECTION', status: 'live' });
      } catch (error) {
        console.warn('Unable to refresh the live PocketBase branch snapshot', error);
        if (requestId === remoteRequestIdRef.current) {
          dispatch({ type: 'SET_CONNECTION', status: 'offline' });
        }
      }
    },
    [applyBranchSnapshot]
  );

  // Load the branch-scoped live dataset whenever the signed-in branch changes.
  useEffect(() => {
    if (!state.hydrated) return;
    if (!state.session) {
      remoteLoadedBranchRef.current = null;
      return;
    }
    if (!isPocketBaseConfigured) return;
    if (remoteLoadedBranchRef.current === state.session.branchId) return;
    void refreshRemoteData(state.session.branchId);
  }, [state.hydrated, state.session, refreshRemoteData]);

  // PocketBase SSE keeps the board, menu, tables, bookings and settings live.
  useEffect(() => {
    if (!state.hydrated || !state.session || !isPocketBaseConfigured) return;
    const branchId = state.session.branchId;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void startRealtime(branchId, {
      onOrder: (order) => {
        const isNewOrder = !stateRef.current.orders.some(
          (entry) => entry.id === order.id
        );
        dispatch({ type: 'UPSERT_ORDER', order });
        if (isNewOrder && order.status === 'new') playIncomingAlert();
      },
      onMenuItem: (item) => dispatch({ type: 'UPSERT_MENU_ITEM', item }),
      onTable: (table) => dispatch({ type: 'SAVE_TABLE', table }),
      onReservation: (reservation) =>
        dispatch({ type: 'UPSERT_RESERVATION', reservation }),
      onStoreConfig: (config) => dispatch({ type: 'SET_STORE_CONFIG', config }),
      onSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
      onStatus: (status) => dispatch({ type: 'SET_CONNECTION', status }),
    }).then((dispose) => {
      if (disposed) dispose();
      else cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [state.hydrated, state.session?.branchId, playIncomingAlert, realtimeEpoch]);

  const enqueue = useCallback(
    async (
      actionType: OutboxActionType,
      label: string,
      payload: Record<string, unknown>
    ): Promise<void> => {
      const entry = buildOutboxEntry(actionType, label, payload);
      dispatch({ type: 'ADD_OUTBOX', entry });
      try {
        await db.insertOutbox(entry);
      } catch (error) {
        console.warn('Unable to persist outbox action', error);
      }
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string, branchCode: string): Promise<LoginResult> => {
      try {
        const session = await loginStaff({ email, password, branchCode });
        const settings = stateRef.current.settings;
        const branch = resolveBranch(
          session.branchId,
          stateRef.current.branches,
          session,
          settings
        );
        dispatch({ type: 'LOGIN', session, branch });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Unable to sign in to the terminal.',
        };
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    remoteRequestIdRef.current += 1;
    remoteLoadedBranchRef.current = null;
    await logoutStaff();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus): Promise<void> => {
      const order = stateRef.current.orders.find((entry) => entry.id === orderId);
      const at = new Date().toISOString();
      dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status, at });
      await enqueue(
        'UPDATE_ORDER_STATUS',
        `Order #${order?.orderNumber ?? orderId} → ${status.toUpperCase()}`,
        { orderId, status, at }
      );
    },
    [enqueue]
  );

  const simulateIncomingOrder = useCallback(async (): Promise<void> => {
    if (isPocketBaseConfigured) return;
    const order = buildSimulatedOrder(
      stateRef.current.orders,
      stateRef.current.activeBranch.id,
      Date.now()
    );
    dispatch({ type: 'ADD_ORDER', order });
    playIncomingAlert();
    await enqueue('CREATE_ORDER', `Order #${order.orderNumber} created`, { order });
  }, [enqueue, playIncomingAlert]);

  const setMenuItemStock = useCallback(
    async (itemId: string, inStock: boolean): Promise<void> => {
      const at = new Date().toISOString();
      dispatch({ type: 'SET_MENU_STOCK', itemId, inStock, at });
      const item = stateRef.current.menuItems.find((entry) => entry.id === itemId);
      await enqueue(
        'TOGGLE_MENU_STOCK',
        `${item?.name ?? itemId} → ${inStock ? 'IN STOCK' : 'OUT OF STOCK'}`,
        { itemId, inStock }
      );
    },
    [enqueue]
  );

  const setMenuItemPrice = useCallback(
    async (itemId: string, price: number): Promise<void> => {
      const at = new Date().toISOString();
      dispatch({ type: 'SET_MENU_PRICE', itemId, price, at });
      const item = stateRef.current.menuItems.find((entry) => entry.id === itemId);
      await enqueue(
        'UPDATE_MENU_PRICE',
        `${item?.name ?? itemId} → $${price.toFixed(2)}`,
        { itemId, price }
      );
    },
    [enqueue]
  );

  const saveMenuItem = useCallback(
    async (item: MenuItem): Promise<void> => {
      const existing = stateRef.current.menuItems.find((entry) => entry.id === item.id);
      const role = stateRef.current.session?.role ?? '';
      if (!existing && !canCreateMenuItems(role)) {
        // menu_items.createRule requires manager/kitchen_lead; queueing this
        // would fail forever and block the outbox badge.
        console.error(
          `[menu] role "${role || 'unknown'}" cannot create menu items — action not queued.`
        );
        return;
      }
      // Removing the last photo must clear PocketBase's `image` file field, not
      // just switch the optimistic card back to its placeholder.
      const imageRemoved = Boolean(existing?.imageUrl) && !item.imageUrl;
      dispatch({ type: 'UPSERT_MENU_ITEM', item });
      await enqueue(
        existing ? 'UPDATE_MENU_ITEM' : 'CREATE_MENU_ITEM',
        `Menu item ${item.name} ${existing ? 'updated' : 'added'}`,
        { item, imageRemoved }
      );
    },
    [enqueue]
  );

  const deleteMenuItem = useCallback(
    async (itemId: string): Promise<void> => {
      const item = stateRef.current.menuItems.find((entry) => entry.id === itemId);
      const role = stateRef.current.session?.role ?? '';
      if (!canDeleteMenuItems(role)) {
        console.error(
          `[menu] role "${role || 'unknown'}" cannot delete menu items — action not queued.`
        );
        return;
      }
      dispatch({ type: 'REMOVE_MENU_ITEM', itemId });
      await enqueue(
        'DELETE_MENU_ITEM',
        `Menu item ${item?.name ?? itemId} deleted`,
        { itemId, branchId: stateRef.current.activeBranch.id }
      );
    },
    [enqueue]
  );

  const saveTable = useCallback(
    async (table: DiningTable): Promise<void> => {
      dispatch({ type: 'SAVE_TABLE', table });
      await enqueue('SAVE_TABLE', `Table ${table.name} saved`, { table });
    },
    [enqueue]
  );

  const deleteTable = useCallback(
    async (tableId: string): Promise<void> => {
      const table = stateRef.current.tables.find((entry) => entry.id === tableId);
      const role = stateRef.current.session?.role ?? '';
      if (!canDeleteTables(role)) {
        console.error(
          `[tables] role "${role || 'unknown'}" cannot delete dining tables — action not queued.`
        );
        return;
      }
      dispatch({ type: 'REMOVE_TABLE', tableId });
      await enqueue('DELETE_TABLE', `Table ${table?.name ?? tableId} deleted`, {
        tableId,
        branchId: stateRef.current.activeBranch.id,
      });
    },
    [enqueue]
  );

  const updateReservationStatus = useCallback(
    async (reservationId: string, status: ReservationStatus): Promise<void> => {
      dispatch({ type: 'UPDATE_RESERVATION_STATUS', reservationId, status });
      const reservation = stateRef.current.reservations.find(
        (entry) => entry.id === reservationId
      );
      await enqueue(
        'UPDATE_RESERVATION_STATUS',
        `${reservation?.customerName ?? reservationId} → ${status.toUpperCase()}`,
        { reservationId, status }
      );
    },
    [enqueue]
  );

  const commitStoreConfig = useCallback(
    async (config: StoreOperationsConfig, label: string): Promise<void> => {
      dispatch({ type: 'SET_STORE_CONFIG', config });
      await enqueue('UPDATE_STORE_HOURS', label, {
        config,
        branchId: stateRef.current.activeBranch.id,
        // Include the paired terminal settings so a missing branch_settings row
        // is created complete rather than with empty SMTP/notification fields.
        settings: stateRef.current.settings,
      });
    },
    [enqueue]
  );

  const toggleStoreOpen = useCallback(
    async (isOpen: boolean): Promise<void> => {
      await commitStoreConfig(
        { ...stateRef.current.storeConfig, isOpenForOrders: isOpen },
        `Store reception → ${isOpen ? 'OPEN' : 'CLOSED'}`
      );
    },
    [commitStoreConfig]
  );

  const setSlotInterval = useCallback(
    async (minutes: number): Promise<void> => {
      await commitStoreConfig(
        { ...stateRef.current.storeConfig, slotIntervalMinutes: minutes },
        `Pickup slots → ${minutes}m`
      );
    },
    [commitStoreConfig]
  );

  const updateWeeklySchedule = useCallback(
    async (schedule: DaySchedule[]): Promise<void> => {
      const firstOpen = schedule.find((day) => day.isOpen) ?? schedule[0];
      await commitStoreConfig(
        {
          ...stateRef.current.storeConfig,
          weeklySchedule: schedule,
          openingTime: firstOpen?.openTime ?? stateRef.current.storeConfig.openingTime,
          closingTime: firstOpen?.closeTime ?? stateRef.current.storeConfig.closingTime,
        },
        'Weekly schedule updated (7 days)'
      );
    },
    [commitStoreConfig]
  );

  const toggleAcceptingReservations = useCallback(
    async (accepting: boolean): Promise<void> => {
      await commitStoreConfig(
        { ...stateRef.current.storeConfig, acceptingReservations: accepting },
        `Website table bookings → ${accepting ? 'LIVE' : 'SUSPENDED'}`
      );
    },
    [commitStoreConfig]
  );

  const saveTerminalSettings = useCallback(
    async (settings: TerminalSettings): Promise<void> => {
      const branchId = stateRef.current.activeBranch.id;
      const persisted = normalizeTerminalSettings({
        ...settings,
        pocketbaseBranchId: branchId,
        branchName:
          settings.branchName.trim() || stateRef.current.activeBranch.name,
      });
      dispatch({ type: 'SET_SETTINGS', settings: persisted });
      try {
        await db.saveTerminalSettings(persisted);
      } catch (error) {
        console.warn('Unable to persist terminal settings', error);
      }
      await enqueue('UPDATE_SETTINGS', 'Terminal settings saved', {
        settings: persisted,
        branchId,
        // Keep the operating schedule in the same upsert so both halves of the
        // branch_settings row stay consistent on a first-time create.
        config: stateRef.current.storeConfig,
      });
    },
    [enqueue]
  );

  const syncOutboxNow = useCallback(async (): Promise<void> => {
    if (syncInFlightRef.current) return;
    const entries = stateRef.current.outbox;
    if (entries.length === 0) return;

    syncInFlightRef.current = true;
    if (isPocketBaseConfigured) {
      dispatch({ type: 'SET_CONNECTION', status: 'polling' });
    }

    try {
      // Reducer/UI order is newest-first for the audit trail; the backend needs
      // causal order so a create always lands before its dependent update.
      const result = await flushOutbox(sortOutboxChronologically(entries));

      lastSyncFailuresRef.current = result.failures;
      lastDiscardedRef.current = result.discarded;
      lastFlushRef.current = {
        synced: result.syncedIds.length,
        failed: result.failedIds.length,
      };
      console.log(
        `[sync] flush: ${result.syncedIds.length} synced, ` +
          `${result.failedIds.length} failed of ${entries.length} attempted`
      );

      if (result.syncedIds.length > 0) {
        dispatch({
          type: 'SYNC_OUTBOX',
          ids: result.syncedIds,
          syncedAt: Date.now(),
        });
        try {
          await db.markOutboxSynced(result.syncedIds);
          await db.pruneSyncedOutbox();
        } catch (error) {
          console.warn('Unable to mark outbox actions as synced', error);
        }
      }

      if (result.failedIds.length > 0) {
        await Promise.all(
          result.failedIds.map((id) =>
            db.incrementOutboxRetry(id).catch(() => undefined)
          )
        );
      }

      if (result.discarded.length > 0) {
        // Dead-letter: a 404/validation mutation can never succeed, so remove it
        // instead of letting it jam every later mutation forever.
        const discardedIds = result.discarded.map((failure) => failure.entryId);
        dispatch({ type: 'DISCARD_OUTBOX', ids: discardedIds });
        try {
          await db.deleteOutboxEntries(discardedIds);
        } catch (error) {
          console.warn('Unable to remove discarded outbox actions', error);
        }
        console.warn(
          `[sync] removed ${discardedIds.length} permanently rejected action(s) from the queue`
        );
      }

      // A rejection from PocketBase means the network is up but the queue is
      // blocked by rules/auth — show POLLING, not OFFLINE QUEUED.
      const transportFailure = result.failures.some(
        (failure) =>
          failure.error.kind === 'network' || failure.error.kind === 'aborted'
      );
      const wasOffline = stateRef.current.connection === 'offline';
      const nextStatus = transportFailure
        ? 'offline'
        : result.failedIds.length > 0
          ? 'polling'
          : 'live';

      dispatch({ type: 'SET_CONNECTION', status: nextStatus });

      // Rebuild the SSE subscriptions that failed while the host was unreachable.
      if (wasOffline && nextStatus === 'live') {
        setRealtimeEpoch((epoch) => epoch + 1);
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  /**
   * Flips the terminal out of OFFLINE as soon as the host answers /api/health,
   * re-subscribes realtime, and lets the caller resume the outbox.
   */
  const probeConnection = useCallback(async (): Promise<boolean> => {
    if (!isPocketBaseConfigured) {
      dispatch({ type: 'SET_CONNECTION', status: 'live' });
      return true;
    }
    const reachable = await isPocketBaseReachable();
    if (!reachable) {
      dispatch({ type: 'SET_CONNECTION', status: 'offline' });
      return false;
    }
    const wasOffline = stateRef.current.connection === 'offline';
    dispatch({ type: 'SET_CONNECTION', status: 'live' });
    if (wasOffline) {
      setRealtimeEpoch((epoch) => epoch + 1);
    }
    return true;
  }, []);

  /** Manual reset: wipe every pending mutation and reconnect immediately. */
  const clearOutbox = useCallback(async (): Promise<void> => {
    const removed = stateRef.current.outbox.length;
    dispatch({ type: 'CLEAR_OUTBOX' });
    lastSyncFailuresRef.current = [];
    lastDiscardedRef.current = [];
    lastFlushRef.current = { synced: 0, failed: 0 };
    try {
      await db.clearOutbox();
    } catch (error) {
      console.warn('Unable to clear the local outbox', error);
    }
    dispatch({ type: 'SET_CONNECTION', status: 'live' });
    setRealtimeEpoch((epoch) => epoch + 1);
    console.warn(
      `[sync] outbox reset manually — ${removed} pending action(s) discarded`
    );
  }, []);

  /**
   * Force-flushes the queue and prints the exact PocketBase rejection for every
   * entry: URL, auth state, role, branch, HTTP status, server message and the
   * per-field validation detail. Returned so the UI can show the same report.
   */
  const runSyncDiagnostics = useCallback(async (): Promise<SyncDiagnosticsReport> => {
    const pendingEntries = stateRef.current.outbox.filter((entry) => !entry.synced);
    const pocketbase = pocketBaseDiagnostics();
    const network = await runNetworkProbe();

    console.log('[diag] PocketBase:', JSON.stringify(pocketbase));
    console.log(
      '[diag] queue:',
      pendingEntries.length === 0
        ? '(empty)'
        : pendingEntries
            .map((entry) => `${entry.actionType} retries=${entry.retryCount} "${entry.label}"`)
            .join(' | ')
    );

    if (pendingEntries.length > 0 && !syncInFlightRef.current) {
      await syncOutboxNow();
    }

    const report: SyncDiagnosticsReport = {
      generatedAt: new Date().toISOString(),
      pocketbase,
      network,
      queue: {
        pending: pendingEntries.length,
        actions: pendingEntries.map((entry) => `${entry.actionType}: ${entry.label}`),
      },
      result: lastFlushRef.current,
      failures:
        pendingEntries.length === 0
          ? []
          : lastSyncFailuresRef.current.map((failure) => ({
              actionType: failure.actionType,
              label: failure.label,
              kind: failure.error.kind,
              status: failure.error.status,
              message: failure.error.message,
              detail: failure.error.detail,
              hint: describeSyncHint(failure.error),
            })),
      discarded: lastDiscardedRef.current.map((failure) => ({
        actionType: failure.actionType,
        label: failure.label,
        kind: failure.error.kind,
        status: failure.error.status,
        message: failure.error.message,
      })),
    };

    console.log('[diag] report:', JSON.stringify(report, null, 2));
    return report;
  }, [syncOutboxNow]);

  // Once hydrated, every queued mutation attempts an immediate live sync.
  useEffect(() => {
    if (
      !isPocketBaseConfigured ||
      !state.hydrated ||
      !state.session ||
      state.outbox.length === 0
    ) {
      return;
    }
    void syncOutboxNow();
  }, [state.hydrated, state.session, state.outbox, syncOutboxNow]);

  // A mutation that failed while the network was down stays queued. Retry on a
  // slow timer so the terminal recovers without the user tapping "Sync now".
  useEffect(() => {
    if (!isPocketBaseConfigured || !state.hydrated || !state.session) return;
    const timer = setInterval(() => {
      if (stateRef.current.connection === 'offline') {
        // Confirm the host is back before hammering the failing mutations.
        void probeConnection().then((reachable) => {
          if (reachable) void syncOutboxNow();
        });
        return;
      }
      void syncOutboxNow();
    }, OUTBOX_RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.hydrated, state.session, syncOutboxNow, probeConnection]);

  const setConnectionStatus = useCallback((status: ConnectionStatus): void => {
    dispatch({ type: 'SET_CONNECTION', status });
  }, []);

  const setBranch = useCallback(
    async (branch: Branch): Promise<void> => {
      if (branch.id === stateRef.current.activeBranch.id) return;

      // A live terminal is pinned to the branch on the staff record; only the
      // local demo build can hop between the seeded branch directory.
      if (isPocketBaseConfigured) {
        const assigned = assignedBranchId();
        if (assigned && branch.id !== assigned) return;
      }

      if (isPocketBaseConfigured) {
        const requestId = remoteRequestIdRef.current + 1;
        remoteRequestIdRef.current = requestId;
        dispatch({ type: 'SET_CONNECTION', status: 'polling' });
        try {
          const snapshot = await fetchBranchSnapshot(branch.id);
          if (requestId !== remoteRequestIdRef.current) return;
          applyBranchSnapshot(branch.id, snapshot);
        } catch (error) {
          console.warn('Unable to switch branch while offline', error);
          dispatch({ type: 'SET_CONNECTION', status: 'offline' });
          return;
        }
      }

      dispatch({ type: 'SET_BRANCH', branch });
      try {
        await setActiveBranchId(branch.id);
        const session = stateRef.current.session;
        if (session) {
          await persistSession({
            ...session,
            branchId: branch.id,
            branchName: branch.name,
          });
        }
        dispatch({ type: 'SET_CONNECTION', status: 'live' });
      } catch (error) {
        console.warn('Unable to persist active branch', error);
        dispatch({ type: 'SET_CONNECTION', status: 'offline' });
      }
    },
    [applyBranchSnapshot]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      isLiveBackend: isPocketBaseConfigured,
      login,
      logout,
      updateOrderStatus,
      simulateIncomingOrder,
      setMenuItemStock,
      setMenuItemPrice,
      saveMenuItem,
      deleteMenuItem,
      saveTable,
      deleteTable,
      updateReservationStatus,
      toggleStoreOpen,
      setSlotInterval,
      updateWeeklySchedule,
      toggleAcceptingReservations,
      saveTerminalSettings,
      syncOutboxNow,
      clearOutbox,
      runSyncDiagnostics,
      setConnectionStatus,
      setBranch,
    }),
    [
      state,
      login,
      logout,
      updateOrderStatus,
      simulateIncomingOrder,
      setMenuItemStock,
      setMenuItemPrice,
      saveMenuItem,
      deleteMenuItem,
      saveTable,
      deleteTable,
      updateReservationStatus,
      toggleStoreOpen,
      setSlotInterval,
      updateWeeklySchedule,
      toggleAcceptingReservations,
      saveTerminalSettings,
      syncOutboxNow,
      clearOutbox,
      runSyncDiagnostics,
      setConnectionStatus,
      setBranch,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
