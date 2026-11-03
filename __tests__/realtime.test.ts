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
});
