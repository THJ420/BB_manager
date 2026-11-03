jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    filter: jest.fn((expression: string) => expression),
    collection: jest.fn(),
    authStore: { record: { branch_id: 'branch_dt_01' } },
  },
}));

import { pb } from '../src/services/pocketbase';
import { startRealtime, RealtimeHandlers } from '../src/services/realtime';

interface EmittedEvent {
  action: string;
  record: Record<string, unknown>;
}

interface CapturedSubscription {
  collection: string;
  emit: (event: EmittedEvent) => void;
}

const collectionMock = pb.collection as unknown as jest.Mock;

function createHandlers(): RealtimeHandlers {
  return {
    onOrder: jest.fn(),
    onMenuItem: jest.fn(),
    onTable: jest.fn(),
    onReservation: jest.fn(),
    onDelete: jest.fn(),
    onStoreConfig: jest.fn(),
    onSettings: jest.fn(),
    onStatus: jest.fn(),
  };
}

let subscriptions: CapturedSubscription[] = [];

function subscriptionFor(collection: string): CapturedSubscription {
  const captured = subscriptions.find((entry) => entry.collection === collection);
  if (!captured) throw new Error(`No subscription captured for ${collection}`);
  return captured;
}

beforeEach(() => {
  subscriptions = [];
  collectionMock.mockImplementation((collection: string) => ({
    subscribe: jest.fn(
      async (
        _topic: string,
        callback: (event: EmittedEvent) => void
      ): Promise<() => Promise<void>> => {
        subscriptions.push({ collection, emit: callback });
        return async () => undefined;
      }
    ),
  }));
});

describe('PocketBase realtime bridge', () => {
  it('removes a table deleted on the website', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('tables').emit({
      action: 'delete',
      record: { id: 'tbl_1', branch_id: 'branch_dt_01' },
    });

    expect(handlers.onDelete).toHaveBeenCalledWith('table', 'tbl_1');
    expect(handlers.onTable).not.toHaveBeenCalled();
    cleanup();
  });

  it('removes a menu item deleted on the website', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('menu_items').emit({
      action: 'delete',
      record: { id: 'menu_1', branch_id: 'branch_dt_01' },
    });

    expect(handlers.onDelete).toHaveBeenCalledWith('menu_item', 'menu_1');
    cleanup();
  });

  it('ignores a deletion from another branch', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('tables').emit({
      action: 'delete',
      record: { id: 'tbl_2', branch_id: 'branch_ub_02' },
    });

    expect(handlers.onDelete).not.toHaveBeenCalled();
    cleanup();
  });

  it('never removes the singleton settings row on a delete event', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('branch_settings').emit({
      action: 'delete',
      record: { id: 'settings_1', branch_id: 'branch_dt_01' },
    });

    expect(handlers.onDelete).not.toHaveBeenCalled();
    cleanup();
  });

  it('still applies website updates through the mapper', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('tables').emit({
      action: 'update',
      record: {
        id: 'tbl_1',
        branch_id: 'branch_dt_01',
        table_number: 'T1',
        name: 'Patio',
        capacity: 6,
        is_available: true,
        zone: 'Terrace',
      },
    });

    expect(handlers.onTable).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tbl_1',
        branchId: 'branch_dt_01',
        name: 'Patio',
        capacity: 6,
        zone: 'Terrace',
      })
    );
    expect(handlers.onDelete).not.toHaveBeenCalled();
    cleanup();
  });

  it('dispatches a newly created website order to the inbound-call handler', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('orders').emit({
      action: 'create',
      record: {
        id: 'ord_9001',
        branch_id: 'branch_dt_01',
        order_number: '9001',
        customer_name: 'Website Guest',
        customer_phone: '+48 500 100 200',
        status: 'new',
        items: JSON.stringify([{ id: 'i1', name: 'Kebab', quantity: 2, unitPrice: 24 }]),
        total_amount: 48,
        pickup_code: '4821',
        channel: 'online',
        created: '2026-11-04T00:00:00.000Z',
      },
    });

    expect(handlers.onOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ord_9001',
        branchId: 'branch_dt_01',
        status: 'new',
        orderNumber: '9001',
      })
    );
    cleanup();
  });

  it('accepts uppercase/legacy action verbs instead of dropping the insert', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('orders').emit({
      action: 'INSERT',
      record: {
        id: 'ord_9002',
        branch_id: 'branch_dt_01',
        order_number: '9002',
        status: 'new',
        items: '[]',
        total_amount: 12,
        pickup_code: '1111',
      },
    });

    expect(handlers.onOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ord_9002', status: 'new' })
    );
    cleanup();
  });

  it('keeps a matching branch when the relation id has surrounding whitespace', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('orders').emit({
      action: 'create',
      record: {
        id: 'ord_9003',
        branch_id: ' branch_dt_01 ',
        order_number: '9003',
        status: 'new',
        items: '[]',
        total_amount: 9,
        pickup_code: '2222',
      },
    });

    expect(handlers.onOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ord_9003', branchId: 'branch_dt_01' })
    );
    cleanup();
  });

  it('ignores an order created for a genuinely different branch', async () => {
    const handlers = createHandlers();
    const cleanup = await startRealtime('branch_dt_01', handlers);

    subscriptionFor('orders').emit({
      action: 'create',
      record: {
        id: 'ord_9004',
        branch_id: 'branch_ub_02',
        order_number: '9004',
        status: 'new',
        items: '[]',
        total_amount: 9,
        pickup_code: '3333',
      },
    });

    expect(handlers.onOrder).not.toHaveBeenCalled();
    cleanup();
  });
});
