import type { RecordModel } from 'pocketbase';

jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    collection: jest.fn(),
    filter: jest.fn((expression: string) => expression),
    authStore: { record: { branch_id: 'branch_dt_01' } },
  },
}));

jest.mock('../src/services/uploads', () => ({
  buildMenuItemWritePayload: jest.fn(async () => ({ name: 'serialized payload' })),
}));

import { pb } from '../src/services/pocketbase';
import { buildMenuItemWritePayload } from '../src/services/uploads';
import { flushOutbox } from '../src/services/sync';
import {
  createDefaultStoreConfig,
  createDefaultTerminalSettings,
  createSeedMenu,
} from '../src/lib/seed';
import {
  MenuItem,
  OutboxEntry,
  OutboxActionType,
  StoreOperationsConfig,
  TerminalSettings,
} from '../src/types';

const collectionMock = pb.collection as unknown as jest.Mock;
const uploadMock = buildMenuItemWritePayload as jest.MockedFunction<
  typeof buildMenuItemWritePayload
>;

function entry(
  actionType: OutboxActionType,
  payload: Record<string, unknown>
): OutboxEntry {
  return {
    id: `act_1_${actionType}`,
    actionType,
    label: actionType,
    payload,
    createdAt: 1,
    retryCount: 0,
    synced: false,
  };
}

function useCollection(name: string, handlers: Record<string, jest.Mock>): void {
  collectionMock.mockImplementation((requested: string) => {
    if (requested !== name) {
      throw new Error(`Unexpected collection request: ${requested}`);
    }
    return handlers;
  });
}

describe('sync outbox handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadMock.mockResolvedValue({ name: 'serialized payload' });
  });

  it('passes the image-removal flag when updating a menu item', async () => {
    const update = jest.fn(async () => undefined);
    useCollection('menu_items', { update });
    const item = createSeedMenu(1)[0] as MenuItem;
    const pruned: MenuItem = { ...item, imageUrl: undefined };

    const result = await flushOutbox([
      entry('UPDATE_MENU_ITEM', { item: pruned, imageRemoved: true }),
    ]);

    expect(result.syncedIds).toEqual(['act_1_UPDATE_MENU_ITEM']);
    expect(uploadMock).toHaveBeenCalledWith(pruned, { clearImage: true });
    expect(update).toHaveBeenCalledWith(item.id, {
      name: 'serialized payload',
      branch_id: 'branch_dt_01',
    });
  });

  it('retries a duplicate custom-ID create as an update with a fresh payload', async () => {
    const duplicate = {
      status: 400,
      response: { data: { id: { code: 'validation_not_unique' } } },
    };
    const create = jest.fn(async () => {
      throw duplicate;
    });
    const update = jest.fn(async () => undefined);
    useCollection('menu_items', { create, update });
    const item = createSeedMenu(1)[0] as MenuItem;

    const result = await flushOutbox([
      entry('CREATE_MENU_ITEM', { item, imageRemoved: false }),
    ]);

    expect(result.failedIds).toEqual([]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenCalledWith(item, { clearImage: false });
    expect(update).toHaveBeenCalledWith(item.id, {
      name: 'serialized payload',
      branch_id: 'branch_dt_01',
    });
  });

  it('creates a missing branch_settings row with both hours and terminal defaults', async () => {
    const getFirstListItem = jest.fn(async () => {
      throw { status: 404 };
    });
    const create = jest.fn(async (payload: Record<string, unknown>) => payload);
    useCollection('branch_settings', { getFirstListItem, create });

    const config: StoreOperationsConfig = {
      ...createDefaultStoreConfig(),
      acceptingReservations: false,
      slotIntervalMinutes: 45,
    };
    const settings: TerminalSettings = {
      ...createDefaultTerminalSettings(),
      alertToneId: 'urgent_pulse',
      pocketbaseBranchId: 'branch_dt_01',
    };

    const result = await flushOutbox([
      entry('UPDATE_STORE_HOURS', {
        config,
        settings,
        branchId: 'branch_dt_01',
      }),
    ]);

    expect(result.failedIds).toEqual([]);
    expect(getFirstListItem).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: 'branch_dt_01',
        is_open_for_orders: config.isOpenForOrders,
        accepting_reservations: false,
        slot_interval_minutes: 45,
        weekly_schedule: config.weeklySchedule,
        smtp_host: settings.smtp.host,
        notification_recipients: settings.notifications.recipients,
        delivery_wolt_url: settings.deliveryUrls.wolt,
        alert_tone_id: 'urgent_pulse',
        staff_roster: settings.staff,
      })
    );
  });

  it('rewrites an existing branch_settings row with the signed-in branch_id', async () => {
    const getFirstListItem = jest.fn(async () => ({ id: 'settings_row' }) as RecordModel);
    const update = jest.fn(
      async (_recordId: string, _payload: Record<string, unknown>) => undefined
    );
    useCollection('branch_settings', { getFirstListItem, update });

    const settings: TerminalSettings = {
      ...createDefaultTerminalSettings(),
      smtp: {
        ...createDefaultTerminalSettings().smtp,
        host: 'smtp.example.test',
        encryption: 'SSL',
      },
      alertToneId: 'kitchen_bell',
      pocketbaseBranchId: 'branch_dt_01',
    };

    const result = await flushOutbox([
      entry('UPDATE_SETTINGS', { settings, branchId: 'branch_dt_01' }),
    ]);

    expect(result.failedIds).toEqual([]);
    expect(update).toHaveBeenCalledTimes(1);
    const [recordId, payload] = update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];    expect(recordId).toBe('settings_row');
    expect(payload).toHaveProperty('branch_id', 'branch_dt_01');
    expect(payload).toMatchObject({
      smtp_host: 'smtp.example.test',
      smtp_encryption: 'SSL',
      alert_tone_id: 'kitchen_bell',
      notification_recipients: settings.notifications.recipients,
    });
  });

  it('never sends a mutation queued for another branch', async () => {
    const update = jest.fn(async () => undefined);
    const create = jest.fn(async () => undefined);
    useCollection('menu_items', { update, create });
    const foreignItem: MenuItem = {
      ...createSeedMenu(1)[0],
      branchId: 'branch_ub_02',
    };

    const result = await flushOutbox([
      entry('UPDATE_MENU_ITEM', { item: foreignItem, imageRemoved: false }),
    ]);

    expect(result.failedIds).toEqual(['act_1_UPDATE_MENU_ITEM']);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('reports the exact PocketBase rejection for a blocked mutation', async () => {
    const ruleDenial = {
      status: 400,
      message: 'Failed to create record.',
      url: 'https://pocket.example/api/collections/menu_items/records',
      response: { message: 'Failed to create record.', data: {} },
    };
    const create = jest.fn(async () => {
      throw ruleDenial;
    });
    useCollection('menu_items', { create });
    const item = createSeedMenu(1)[0] as MenuItem;

    const result = await flushOutbox([
      entry('CREATE_MENU_ITEM', { item, imageRemoved: false }),
    ]);

    expect(result.failedIds).toEqual(['act_1_CREATE_MENU_ITEM']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].actionType).toBe('CREATE_MENU_ITEM');
    expect(result.failures[0].error.kind).toBe('rule');
    expect(result.failures[0].error.url).toContain('menu_items');
  });

  it('stamps the authenticated branch onto a menu stock toggle', async () => {
    const update = jest.fn(async () => undefined);
    useCollection('menu_items', { update });

    const result = await flushOutbox([entry('TOGGLE_MENU_STOCK', { itemId: 'm_01', inStock: false })]);

    expect(result.failedIds).toEqual([]);
    expect(update).toHaveBeenCalledWith('m_01', {
      in_stock: false,
      branch_id: 'branch_dt_01',
    });
  });
});
