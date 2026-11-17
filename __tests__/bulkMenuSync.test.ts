jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    collection: jest.fn(),
    filter: jest.fn((expression: string) => expression),
    authStore: { record: { branch_id: 'branch_dt_01' } },
  },
}));

jest.mock('../src/services/uploads', () => ({
  UploadPayloadError: class UploadPayloadError extends Error {},
  buildMenuItemWritePayload: jest.fn(async () => ({ name: 'serialized payload' })),
  isLocalImageMissing: jest.fn(async () => false),
}));

import { pb } from '../src/services/pocketbase';
import { flushOutbox, MAX_OUTBOX_RETRIES } from '../src/services/sync';
import {
  buildBulkMenuDeletePayload,
  buildBulkMenuPatchPayload,
} from '../src/services/bulkMenu';
import { OutboxEntry } from '../src/types';

const collectionMock = pb.collection as unknown as jest.Mock;
const BULK_OPTIONS = { headers: { 'X-BB-Bulk': '1' } };

function entry(payload: Record<string, unknown>, retryCount = 0): OutboxEntry {
  return {
    id: 'act_1_BULK_MENU_PATCH',
    actionType: 'BULK_MENU_PATCH',
    label: 'Bulk menu edit',
    payload,
    createdAt: 1,
    retryCount,
    synced: false,
  };
}

function useMenuCollection(handlers: Record<string, jest.Mock>): void {
  collectionMock.mockImplementation((requested: string) => {
    if (requested !== 'menu_items') {
      throw new Error(`Unexpected collection request: ${requested}`);
    }
    return handlers;
  });
}

const notFound = {
  status: 404,
  message: "The requested resource wasn't found.",
  response: { message: "The requested resource wasn't found.", data: {} },
};
const networkFailure = { status: 0, message: 'Network request failed' };
const ruleDenial = {
  status: 400,
  message: 'Failed to update record.',
  response: { message: 'Failed to update record.', data: {} },
};

describe('BULK_MENU_PATCH outbox flush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends individual PATCH requests, each with the X-BB-Bulk header', async () => {
    const update = jest.fn(async () => undefined);
    useMenuCollection({ update });

    const result = await flushOutbox([
      entry({
        ...buildBulkMenuPatchPayload([
          { id: 'm_01', fields: { inStock: false } },
          { id: 'm_02', fields: { price: 9.99, isVisible: true } },
        ]),
        branchId: 'branch_dt_01',
      }),
    ]);

    expect(result.syncedIds).toEqual(['act_1_BULK_MENU_PATCH']);
    expect(result.failedIds).toEqual([]);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(
      1,
      'm_01',
      { in_stock: false, branch_id: 'branch_dt_01' },
      BULK_OPTIONS
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      'm_02',
      { price: 9.99, is_visible: true, branch_id: 'branch_dt_01' },
      BULK_OPTIONS
    );
  });

  it('sends individual DELETE requests with the X-BB-Bulk header for the delete variant', async () => {
    const remove = jest.fn(async () => undefined);
    useMenuCollection({ delete: remove });

    const result = await flushOutbox([
      entry({
        ...buildBulkMenuDeletePayload(['m_01', 'm_02']),
        branchId: 'branch_dt_01',
      }),
    ]);

    expect(result.syncedIds).toEqual(['act_1_BULK_MENU_PATCH']);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenNthCalledWith(1, 'm_01', BULK_OPTIONS);
    expect(remove).toHaveBeenNthCalledWith(2, 'm_02', BULK_OPTIONS);
  });

  it('leaves normal single-item writes without the bulk header', async () => {
    const update = jest.fn(async () => undefined);
    const remove = jest.fn(async () => undefined);
    useMenuCollection({ update, delete: remove });

    await flushOutbox([
      {
        id: 'act_single_stock',
        actionType: 'TOGGLE_MENU_STOCK',
        label: 'stock',
        payload: { itemId: 'm_01', inStock: true },
        createdAt: 1,
        retryCount: 0,
        synced: false,
      },
      {
        id: 'act_single_delete',
        actionType: 'DELETE_MENU_ITEM',
        label: 'delete',
        payload: { itemId: 'm_02', branchId: 'branch_dt_01' },
        createdAt: 2,
        retryCount: 0,
        synced: false,
      },
    ]);

    expect(update).toHaveBeenCalledWith('m_01', {
      in_stock: true,
      branch_id: 'branch_dt_01',
    });
    expect(remove).toHaveBeenCalledWith('m_02');
  });

  it('strips non-whitelisted fields from a queued patch', async () => {
    const update = jest.fn(async () => undefined);
    useMenuCollection({ update });

    await flushOutbox([
      entry({
        operation: 'update',
        items: [
          { id: 'm_01', fields: { price: 5, name: 'renamed', prep_minutes: 3 } },
        ],
        branchId: 'branch_dt_01',
      }),
    ]);

    expect(update).toHaveBeenCalledWith(
      'm_01',
      { price: 5, branch_id: 'branch_dt_01' },
      BULK_OPTIONS
    );
  });

  it('skips items whose field set is empty', async () => {
    const update = jest.fn(async () => undefined);
    useMenuCollection({ update });

    const result = await flushOutbox([
      entry({
        operation: 'update',
        items: [{ id: 'm_01', fields: {} }],
        branchId: 'branch_dt_01',
      }),
    ]);

    expect(update).not.toHaveBeenCalled();
    expect(result.syncedIds).toEqual(['act_1_BULK_MENU_PATCH']);
  });

  it('attempts every item and dead-letters only the permanently failed ids', async () => {
    const update = jest.fn(async (id: string) => {
      if (id === 'm_02') throw notFound;
      return undefined;
    });
    useMenuCollection({ update });
    const queued = entry({
      ...buildBulkMenuPatchPayload([
        { id: 'm_01', fields: { inStock: false } },
        { id: 'm_02', fields: { inStock: false } },
        { id: 'm_03', fields: { inStock: false } },
      ]),
      branchId: 'branch_dt_01',
    });

    const result = await flushOutbox([queued]);

    expect(update).toHaveBeenCalledTimes(3);
    expect(result.discarded).toHaveLength(1);
    expect(result.discarded[0].error.kind).toBe('not-found');
    expect(result.failedIds).toEqual([]);
    // The payload is trimmed to the failed id so nothing applied is replayed.
    expect(queued.payload.items).toEqual([{ id: 'm_02', fields: { in_stock: false } }]);
  });

  it('keeps only the failed ids queued on a retryable partial failure', async () => {
    const update = jest.fn(async (id: string) => {
      if (id === 'm_02') throw networkFailure;
      return undefined;
    });
    useMenuCollection({ update });
    const queued = entry({
      ...buildBulkMenuPatchPayload([
        { id: 'm_01', fields: { price: 10 } },
        { id: 'm_02', fields: { price: 12 } },
      ]),
      branchId: 'branch_dt_01',
    });

    const result = await flushOutbox([queued]);

    expect(result.failedIds).toEqual(['act_1_BULK_MENU_PATCH']);
    expect(result.discarded).toEqual([]);
    expect(result.failures[0].error.kind).toBe('network');
    expect(queued.payload.items).toEqual([{ id: 'm_02', fields: { price: 12 } }]);
  });

  it('prefers a retryable error so a transient failure is not dead-lettered with a 404', async () => {
    const update = jest.fn(async (id: string) => {
      if (id === 'm_02') throw notFound;
      if (id === 'm_03') throw networkFailure;
      return undefined;
    });
    useMenuCollection({ update });
    const queued = entry({
      ...buildBulkMenuPatchPayload([
        { id: 'm_01', fields: { inStock: true } },
        { id: 'm_02', fields: { inStock: true } },
        { id: 'm_03', fields: { inStock: true } },
      ]),
      branchId: 'branch_dt_01',
    });

    const result = await flushOutbox([queued]);

    expect(result.failedIds).toEqual(['act_1_BULK_MENU_PATCH']);
    expect(result.discarded).toEqual([]);
    expect(result.failures[0].error.kind).toBe('network');
    expect(queued.payload.items).toEqual([
      { id: 'm_02', fields: { in_stock: true } },
      { id: 'm_03', fields: { in_stock: true } },
    ]);
  });

  it('dead-letters the whole entry when every item fails permanently', async () => {
    const remove = jest.fn(async () => {
      throw notFound;
    });
    useMenuCollection({ delete: remove });
    const queued = entry({
      ...buildBulkMenuDeletePayload(['m_01', 'm_02']),
      branchId: 'branch_dt_01',
    });

    const result = await flushOutbox([queued]);

    expect(remove).toHaveBeenCalledTimes(2);
    expect(result.discarded).toHaveLength(1);
    expect(result.failedIds).toEqual([]);
    expect(result.syncedIds).toEqual([]);
  });

  it('refuses a bulk patch queued for another branch before any request', async () => {
    const update = jest.fn(async () => undefined);
    const remove = jest.fn(async () => undefined);
    useMenuCollection({ update, delete: remove });

    const result = await flushOutbox([
      entry({
        ...buildBulkMenuPatchPayload([{ id: 'm_01', fields: { price: 5 } }]),
        branchId: 'branch_ub_02',
      }),
    ]);

    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(result.failedIds).toEqual(['act_1_BULK_MENU_PATCH']);
    expect(result.failures[0].error.kind).toBe('forbidden');
  });

  it('drops a server-rejected bulk patch once the retry ceiling is reached', async () => {
    const update = jest.fn(async () => {
      throw ruleDenial;
    });
    useMenuCollection({ update });

    const result = await flushOutbox([
      entry(
        {
          ...buildBulkMenuPatchPayload([{ id: 'm_01', fields: { price: 5 } }]),
          branchId: 'branch_dt_01',
        },
        MAX_OUTBOX_RETRIES
      ),
    ]);

    expect(result.discarded).toHaveLength(1);
    expect(result.discarded[0].error.message).toContain('Retry limit reached');
    expect(result.failedIds).toEqual([]);
  });

  it('never applies the retry ceiling to offline transport failures', async () => {
    const update = jest.fn(async () => {
      throw networkFailure;
    });
    useMenuCollection({ update });

    const result = await flushOutbox([
      entry(
        {
          ...buildBulkMenuPatchPayload([{ id: 'm_01', fields: { inStock: false } }]),
          branchId: 'branch_dt_01',
        },
        MAX_OUTBOX_RETRIES + 5
      ),
    ]);

    expect(result.discarded).toEqual([]);
    expect(result.failedIds).toEqual(['act_1_BULK_MENU_PATCH']);
  });
});