import { appReducer, AppState, initialAppState } from '../src/state/reducer';
import {
  createDefaultStoreConfig,
  createDefaultTerminalSettings,
  createSeedMenu,
  createSeedOrders,
  createSeedTables,
} from '../src/lib/seed';
import { BRANCHES } from '../src/constants/branches';
import { OutboxEntry } from '../src/types';

const NOW = Date.parse('2026-01-01T12:00:00.000Z');
const AT = '2026-01-01T12:00:00.000Z';

function hydratedState(): AppState {
  return {
    ...initialAppState,
    hydrated: true,
    orders: createSeedOrders(NOW),
    menuItems: createSeedMenu(NOW),
    tables: createSeedTables(),
    storeConfig: createDefaultStoreConfig(),
    settings: createDefaultTerminalSettings(),
  };
}

describe('appReducer', () => {
  it('hydrates the terminal state', () => {
    const state = appReducer(initialAppState, {
      type: 'HYDRATE',
      payload: {
        session: null,
        activeBranch: BRANCHES[0]!,
        orders: createSeedOrders(NOW),
        analyticsHistory: [],
        menuItems: createSeedMenu(NOW),
        tables: createSeedTables(),
        reservations: [],
        storeConfig: createDefaultStoreConfig(),
        settings: createDefaultTerminalSettings(),
        outbox: [],
      },
    });

    expect(state.hydrated).toBe(true);
    expect(state.orders).toHaveLength(4);
    expect(state.menuItems).toHaveLength(7);
    expect(state.lastSyncedAt).toBeNull();
  });

  it('stamps ready and completed timestamps when advancing tickets', () => {
    const start = hydratedState();

    const preparing = appReducer(start, {
      type: 'UPDATE_ORDER_STATUS',
      orderId: 'ord_101',
      status: 'preparing',
      at: AT,
    });
    expect(preparing.orders.find((order) => order.id === 'ord_101')?.status).toBe('preparing');
    expect(preparing.orders.find((order) => order.id === 'ord_101')?.readyAt).toBeUndefined();

    const ready = appReducer(preparing, {
      type: 'UPDATE_ORDER_STATUS',
      orderId: 'ord_101',
      status: 'ready',
      at: AT,
    });
    expect(ready.orders.find((order) => order.id === 'ord_101')?.readyAt).toBe(AT);

    const completed = appReducer(ready, {
      type: 'UPDATE_ORDER_STATUS',
      orderId: 'ord_101',
      status: 'completed',
      at: AT,
    });
    expect(completed.orders.find((order) => order.id === 'ord_101')?.completedAt).toBe(AT);
  });

  it('updates menu stock and price with an audit timestamp', () => {
    const start = hydratedState();

    const stock = appReducer(start, {
      type: 'SET_MENU_STOCK',
      itemId: 'm_03',
      inStock: true,
      at: AT,
    });
    const stocked = stock.menuItems.find((item) => item.id === 'm_03');
    expect(stocked?.inStock).toBe(true);
    expect(stocked?.updatedAt).toBe(AT);

    const price = appReducer(stock, {
      type: 'SET_MENU_PRICE',
      itemId: 'm_03',
      price: 13.25,
      at: AT,
    });
    expect(price.menuItems.find((item) => item.id === 'm_03')?.price).toBe(13.25);
  });

  it('upserts menu items by id', () => {
    const start = hydratedState();
    const existing = start.menuItems[0]!;

    const updated = appReducer(start, {
      type: 'UPSERT_MENU_ITEM',
      item: { ...existing, name: 'Renamed Burger' },
    });
    expect(updated.menuItems).toHaveLength(start.menuItems.length);
    expect(updated.menuItems[0]?.name).toBe('Renamed Burger');

    const created = appReducer(updated, {
      type: 'UPSERT_MENU_ITEM',
      item: { ...existing, id: 'm_new', name: 'New Burger' },
    });
    expect(created.menuItems).toHaveLength(start.menuItems.length + 1);
    expect(created.menuItems[0]?.id).toBe('m_new');
  });

  it('saves new and existing tables', () => {
    const start = hydratedState();

    const created = appReducer(start, {
      type: 'SAVE_TABLE',
      table: {
        id: 'tbl_new',
        branchId: 'branch_dt_01',
        tableNumber: 'T-09',
        name: 'Window Nook',
        capacity: 3,
        isAvailable: true,
        zone: 'Main Dining',
      },
    });
    expect(created.tables).toHaveLength(start.tables.length + 1);

    const updated = appReducer(created, {
      type: 'SAVE_TABLE',
      table: { ...created.tables[created.tables.length - 1]!, capacity: 5 },
    });
    expect(updated.tables.find((table) => table.id === 'tbl_new')?.capacity).toBe(5);
  });

  it('moves reservations and toggles arrival back to upcoming', () => {
    const start: AppState = {
      ...hydratedState(),
      reservations: [
        {
          id: 'res_x',
          branchId: 'branch_dt_01',
          customerName: 'Test Guest',
          customerPhone: '+1',
          guestCount: 2,
          reservationTime: '7:00 PM',
          status: 'upcoming',
        },
      ],
    };

    const arrived = appReducer(start, {
      type: 'UPDATE_RESERVATION_STATUS',
      reservationId: 'res_x',
      status: 'arrived',
    });
    expect(arrived.reservations[0]?.status).toBe('arrived');

    const undone = appReducer(arrived, {
      type: 'UPDATE_RESERVATION_STATUS',
      reservationId: 'res_x',
      status: 'upcoming',
    });
    expect(undone.reservations[0]?.status).toBe('upcoming');
  });

  it('queues outbox actions newest-first and clears synced ids', () => {
    const start = hydratedState();
    const entry: OutboxEntry = {
      id: 'act_1',
      actionType: 'UPDATE_ORDER_STATUS',
      label: 'Order #205 → PREPARING',
      payload: { orderId: 'ord_102', status: 'preparing' },
      createdAt: NOW,
      retryCount: 0,
      synced: false,
    };

    const queued = appReducer(start, { type: 'ADD_OUTBOX', entry });
    expect(queued.outbox).toHaveLength(1);
    expect(queued.outbox[0]?.id).toBe('act_1');

    const synced = appReducer(queued, {
      type: 'SYNC_OUTBOX',
      ids: ['act_1'],
      syncedAt: NOW,
    });
    expect(synced.outbox).toHaveLength(0);
    expect(synced.lastSyncedAt).toBe(NOW);
  });

  it('switches the active branch and updates the staff session', () => {
    const start: AppState = {
      ...hydratedState(),
      session: {
        id: 'usr_1',
        email: 'manager@bbmanager.internal',
        name: 'Alex Vance',
        role: 'manager',
        branchId: 'branch_dt_01',
        branchName: 'Downtown Flagship',
      },
    };

    const switched = appReducer(start, { type: 'SET_BRANCH', branch: BRANCHES[1]! });
    expect(switched.activeBranch.id).toBe('branch_ub_02');
    expect(switched.session?.branchId).toBe('branch_ub_02');
    expect(switched.settings.branchName).toBe('Uptown Bistro & Pickup');

    const loggedOut = appReducer(switched, { type: 'LOGOUT' });
    expect(loggedOut.session).toBeNull();
  });

  it('patches store operations without dropping the weekly schedule', () => {
    const start = hydratedState();
    const patched = appReducer(start, {
      type: 'PATCH_STORE_CONFIG',
      patch: { acceptingReservations: false, slotIntervalMinutes: 15 },
    });

    expect(patched.storeConfig.acceptingReservations).toBe(false);
    expect(patched.storeConfig.slotIntervalMinutes).toBe(15);
    expect(patched.storeConfig.weeklySchedule).toHaveLength(7);
  });
  it('discards a single dead-letter entry without touching the rest of the queue', () => {
    const dead: OutboxEntry = {
      id: 'act_dead',
      actionType: 'UPDATE_ORDER_STATUS',
      label: 'Order ord_102 -> READY',
      payload: { orderId: 'ord_102', status: 'ready' },
      createdAt: NOW,
      retryCount: 3,
      synced: false,
    };
    const alive: OutboxEntry = {
      ...dead,
      id: 'act_alive',
      actionType: 'UPDATE_MENU_PRICE',
      payload: { itemId: 'm_01', price: 12 },
    };

    const queued = appReducer(hydratedState(), { type: 'ADD_OUTBOX', entry: alive });
    const both = appReducer(queued, { type: 'ADD_OUTBOX', entry: dead });
    const dropped = appReducer(both, { type: 'DISCARD_OUTBOX', ids: ['act_dead'] });

    expect(dropped.outbox.map((entry) => entry.id)).toEqual(['act_alive']);
  });

  it('clears the entire outbox on demand', () => {
    const entry: OutboxEntry = {
      id: 'act_1',
      actionType: 'UPDATE_MENU_PRICE',
      label: 'price',
      payload: {},
      createdAt: NOW,
      retryCount: 0,
      synced: false,
    };
    const queued = appReducer(hydratedState(), { type: 'ADD_OUTBOX', entry });

    expect(appReducer(queued, { type: 'CLEAR_OUTBOX' }).outbox).toEqual([]);
  });
  it('removes a deleted menu item from local state', () => {
    const seeded = hydratedState();
    const victim = seeded.menuItems[0];
    const next = appReducer(seeded, { type: 'REMOVE_MENU_ITEM', itemId: victim.id });

    expect(next.menuItems).toHaveLength(seeded.menuItems.length - 1);
    expect(next.menuItems.find((item) => item.id === victim.id)).toBeUndefined();
  });
});
