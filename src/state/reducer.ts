import { BRANCHES } from '../constants/branches';
import { activeBranch, createDefaultStoreConfig, createDefaultTerminalSettings } from '../lib/seed';
import {
  Branch,
  ConnectionStatus,
  DaySchedule,
  DiningTable,
  MenuItem,
  Order,
  OrderStatus,
  OutboxEntry,
  Reservation,
  ReservationStatus,
  StaffSession,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';

export interface AppState {
  hydrated: boolean;
  session: StaffSession | null;
  activeBranch: Branch;
  branches: Branch[];
  connection: ConnectionStatus;
  orders: Order[];
  /** Read-only one-year ledger used by Floor Analytics. */
  analyticsHistory: Order[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  reservations: Reservation[];
  storeConfig: StoreOperationsConfig;
  settings: TerminalSettings;
  outbox: OutboxEntry[];
  lastSyncedAt: number | null;
}

export interface HydratePayload {
  session: StaffSession | null;
  activeBranch: Branch;
  branches?: Branch[];
  orders: Order[];
  analyticsHistory: Order[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  reservations: Reservation[];
  storeConfig: StoreOperationsConfig;
  settings: TerminalSettings;
  outbox: OutboxEntry[];
}

export type AppAction =
  | { type: 'HYDRATE'; payload: HydratePayload }
  | { type: 'LOGIN'; session: StaffSession; branch: Branch }
  | { type: 'LOGOUT' }
  | { type: 'SET_BRANCH'; branch: Branch }
  | { type: 'SET_BRANCHES'; branches: Branch[] }
  | {
      type: 'APPLY_REMOTE_DATA';
      payload: Omit<HydratePayload, 'session' | 'outbox'> & {
        syncedAt: number;
      };
    }
  | { type: 'SET_CONNECTION'; status: ConnectionStatus }
  | { type: 'SET_ORDERS'; orders: Order[] }
  | { type: 'ADD_ORDER'; order: Order }
  | { type: 'UPSERT_ORDER'; order: Order }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: OrderStatus; at: string }
  | { type: 'SET_MENU'; items: MenuItem[] }
  | { type: 'UPSERT_MENU_ITEM'; item: MenuItem }
  | { type: 'REMOVE_MENU_ITEM'; itemId: string }
  | { type: 'SET_MENU_STOCK'; itemId: string; inStock: boolean; at: string }
  | { type: 'SET_MENU_PRICE'; itemId: string; price: number; at: string }
  | { type: 'SET_TABLES'; tables: DiningTable[] }
  | { type: 'SAVE_TABLE'; table: DiningTable }
  | { type: 'SET_RESERVATIONS'; reservations: Reservation[] }
  | { type: 'UPSERT_RESERVATION'; reservation: Reservation }
  | { type: 'UPDATE_RESERVATION_STATUS'; reservationId: string; status: ReservationStatus }
  | { type: 'SET_STORE_CONFIG'; config: StoreOperationsConfig }
  | { type: 'PATCH_STORE_CONFIG'; patch: Partial<StoreOperationsConfig> }
  | { type: 'SET_SETTINGS'; settings: TerminalSettings }
  | { type: 'ADD_OUTBOX'; entry: OutboxEntry }
  | { type: 'SYNC_OUTBOX'; ids: string[]; syncedAt: number }
  | { type: 'DISCARD_OUTBOX'; ids: string[] }
  | { type: 'CLEAR_OUTBOX' };

export const initialAppState: AppState = {
  hydrated: false,
  session: null,
  activeBranch: activeBranch(),
  branches: BRANCHES,
  connection: 'live',
  orders: [],
  analyticsHistory: [],
  menuItems: [],
  tables: [],
  reservations: [],
  storeConfig: createDefaultStoreConfig(),
  settings: createDefaultTerminalSettings(),
  outbox: [],
  lastSyncedAt: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        ...action.payload,
        branches: action.payload.branches ?? state.branches,
        hydrated: true,
      };

    case 'LOGIN':
      return {
        ...state,
        session: action.session,
        activeBranch: action.branch,
        settings: {
          ...state.settings,
          branchName: action.branch.name,
          pocketbaseBranchId: action.branch.id,
        },
      };

    case 'LOGOUT':
      return { ...state, session: null };

    case 'SET_BRANCH':
      return {
        ...state,
        activeBranch: action.branch,
        session: state.session
          ? {
              ...state.session,
              branchId: action.branch.id,
              branchName: action.branch.name,
            }
          : null,
        settings: {
          ...state.settings,
          branchName: action.branch.name,
          pocketbaseBranchId: action.branch.id,
        },
      };

    case 'SET_BRANCHES':
      return { ...state, branches: action.branches };

    case 'APPLY_REMOTE_DATA':
      return {
        ...state,
        activeBranch: action.payload.activeBranch,
        branches: action.payload.branches?.length
          ? action.payload.branches
          : state.branches,
        orders: action.payload.orders,
        analyticsHistory: action.payload.analyticsHistory,
        menuItems: action.payload.menuItems,
        tables: action.payload.tables,
        reservations: action.payload.reservations,
        storeConfig: action.payload.storeConfig,
        settings: action.payload.settings,
        session:
          state.session?.branchId === action.payload.activeBranch.id
            ? {
                ...state.session,
                branchName: action.payload.activeBranch.name,
              }
            : state.session,
        lastSyncedAt: action.payload.syncedAt,
      };

    case 'SET_CONNECTION':
      return { ...state, connection: action.status };

    case 'SET_ORDERS':
      return { ...state, orders: action.orders };

    case 'ADD_ORDER':
      return { ...state, orders: [action.order, ...state.orders] };

    case 'UPSERT_ORDER': {
      const exists = state.orders.some((order) => order.id === action.order.id);
      return {
        ...state,
        orders: exists
          ? state.orders.map((order) => (order.id === action.order.id ? action.order : order))
          : [action.order, ...state.orders],
      };
    }

    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map((order) => {
          if (order.id !== action.orderId) return order;
          const next: Order = { ...order, status: action.status };
          if (action.status === 'ready' && !next.readyAt) next.readyAt = action.at;
          if (action.status === 'completed') next.completedAt = action.at;
          return next;
        }),
      };

    case 'SET_MENU':
      return { ...state, menuItems: action.items };

    case 'UPSERT_MENU_ITEM': {
      const exists = state.menuItems.some((item) => item.id === action.item.id);
      return {
        ...state,
        menuItems: exists
          ? state.menuItems.map((item) => (item.id === action.item.id ? action.item : item))
          : [action.item, ...state.menuItems],
      };
    }

    case 'REMOVE_MENU_ITEM':
      return {
        ...state,
        menuItems: state.menuItems.filter((item) => item.id !== action.itemId),
      };

    case 'SET_MENU_STOCK':
      return {
        ...state,
        menuItems: state.menuItems.map((item) =>
          item.id === action.itemId
            ? { ...item, inStock: action.inStock, updatedAt: action.at }
            : item
        ),
      };

    case 'SET_MENU_PRICE':
      return {
        ...state,
        menuItems: state.menuItems.map((item) =>
          item.id === action.itemId ? { ...item, price: action.price, updatedAt: action.at } : item
        ),
      };

    case 'SET_TABLES':
      return { ...state, tables: action.tables };

    case 'SAVE_TABLE': {
      const exists = state.tables.some((table) => table.id === action.table.id);
      return {
        ...state,
        tables: exists
          ? state.tables.map((table) => (table.id === action.table.id ? action.table : table))
          : [...state.tables, action.table],
      };
    }

    case 'SET_RESERVATIONS':
      return { ...state, reservations: action.reservations };

    case 'UPSERT_RESERVATION': {
      const exists = state.reservations.some(
        (reservation) => reservation.id === action.reservation.id
      );
      return {
        ...state,
        reservations: exists
          ? state.reservations.map((reservation) =>
              reservation.id === action.reservation.id ? action.reservation : reservation
            )
          : [action.reservation, ...state.reservations],
      };
    }

    case 'UPDATE_RESERVATION_STATUS':
      return {
        ...state,
        reservations: state.reservations.map((reservation) =>
          reservation.id === action.reservationId
            ? { ...reservation, status: action.status }
            : reservation
        ),
      };

    case 'SET_STORE_CONFIG':
      return { ...state, storeConfig: action.config };

    case 'PATCH_STORE_CONFIG':
      return { ...state, storeConfig: { ...state.storeConfig, ...action.patch } };

    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };

    case 'ADD_OUTBOX':
      return { ...state, outbox: [action.entry, ...state.outbox] };

    case 'SYNC_OUTBOX': {
      const remaining = state.outbox.filter((entry) => !action.ids.includes(entry.id));
      return { ...state, outbox: remaining, lastSyncedAt: action.syncedAt };
    }

    case 'DISCARD_OUTBOX':
      return {
        ...state,
        outbox: state.outbox.filter((entry) => !action.ids.includes(entry.id)),
      };

    case 'CLEAR_OUTBOX':
      return { ...state, outbox: [] };

    default:
      return state;
  }
}

/** Convenience selectors used by screens and tests. */
export function selectPendingOutboxCount(state: AppState): number {
  return state.outbox.length;
}

export function selectOpenDays(config: StoreOperationsConfig): DaySchedule[] {
  return config.weeklySchedule.filter((day) => day.isOpen);
}
