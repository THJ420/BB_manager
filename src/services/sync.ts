import { pb, isPocketBaseConfigured } from './pocketbase';
import { COLLECTIONS } from './collections';
import { assertBranchScope, scopeWritePayload } from './branchScope';
import {
  DescribedPocketBaseError,
  describePocketBaseError,
  describeSyncHint,
  isDuplicateRecordError,
  isNotFoundError,
} from './errors';
import { buildMenuItemWritePayload } from './uploads';
import {
  toBranchSettingsRecord,
  toMenuItemRecord,
  toOrderRecord,
  toStoreRecord,
  toTableRecord,
} from './mappers';
import {
  DiningTable,
  MenuItem,
  Order,
  OutboxActionType,
  OutboxEntry,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';

export interface SyncFailure {
  entryId: string;
  actionType: OutboxActionType;
  label: string;
  error: DescribedPocketBaseError;
}

export interface FlushResult {
  syncedIds: string[];
  failedIds: string[];
  syncedTypes: OutboxActionType[];
  failures: SyncFailure[];
  /** Permanently rejected entries that were removed from the queue. */
  discarded: SyncFailure[];
}

/**
 * A retry can never fix these: the target record is gone (404) or PocketBase
 * rejected the payload shape (400 validation). Keeping them queued is what
 * previously jammed every later mutation.
 */
const PERMANENT_ERROR_KINDS: ReadonlySet<DescribedPocketBaseError['kind']> = new Set([
  'not-found',
  'validation',
]);

const DEMO_SYNC_DELAY_MS = 450;

const ACTION_TARGETS: Record<
  OutboxActionType,
  { collection: string; idKey?: string; nestedKey?: string }
> = {
  UPDATE_ORDER_STATUS: { collection: COLLECTIONS.orders, idKey: 'orderId' },
  CREATE_ORDER: { collection: COLLECTIONS.orders, nestedKey: 'order' },
  TOGGLE_MENU_STOCK: { collection: COLLECTIONS.menuItems, idKey: 'itemId' },
  UPDATE_MENU_PRICE: { collection: COLLECTIONS.menuItems, idKey: 'itemId' },
  CREATE_MENU_ITEM: { collection: COLLECTIONS.menuItems, nestedKey: 'item' },
  UPDATE_MENU_ITEM: { collection: COLLECTIONS.menuItems, nestedKey: 'item' },
  SAVE_TABLE: { collection: COLLECTIONS.tables, nestedKey: 'table' },
  UPDATE_RESERVATION_STATUS: {
    collection: COLLECTIONS.reservations,
    idKey: 'reservationId',
  },
  UPDATE_STORE_HOURS: { collection: COLLECTIONS.branchSettings },
  UPDATE_SETTINGS: { collection: COLLECTIONS.branchSettings },
};

function entryTarget(entry: OutboxEntry): {
  collection: string;
  recordId: string;
  branchId: string;
  keys: string;
} {
  const target = ACTION_TARGETS[entry.actionType];
  let recordId = target?.idKey ? String(entry.payload[target.idKey] ?? '') : '';
  let branchId = '';
  if (target?.nestedKey) {
    const nested = entry.payload[target.nestedKey] as
      | { id?: unknown; branchId?: unknown }
      | undefined;
    recordId = nested?.id ? String(nested.id) : recordId;
    branchId = nested?.branchId ? String(nested.branchId) : branchId;
  }
  if (!branchId && entry.payload.branchId) {
    branchId = String(entry.payload.branchId);
  }
  return {
    collection: target?.collection ?? 'unknown',
    recordId: recordId || '(new)',
    branchId: branchId || '(from session)',
    keys: Object.keys(entry.payload).join(','),
  };
}

function logSyncAttempt(entry: OutboxEntry): void {
  const target = entryTarget(entry);
  console.log(
    `[sync] ${entry.actionType} -> ${target.collection}/${target.recordId}` +
      ` | branch=${target.branchId}` +
      ` | auth.valid=${pb.authStore.isValid}` +
      ` | payload=${target.keys}` +
      (entry.retryCount > 0 ? ` | retry=${entry.retryCount}` : '')
  );
}

function withRecordId(
  payload: Record<string, unknown> | FormData,
  id: string
): Record<string, unknown> | FormData {
  if (payload instanceof FormData) {
    payload.append('id', id);
    return payload;
  }
  return { id, ...payload };
}

async function createOrUpdateRecord(
  collection: string,
  id: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await pb
      .collection(collection)
      .create(withRecordId(scopeWritePayload(collection, payload, 'create'), id));
  } catch (error) {
    if (!isDuplicateRecordError(error)) throw error;
    // A previous request created the record but its response was lost.
    await pb
      .collection(collection)
      .update(id, scopeWritePayload(collection, payload, 'update'));
  }
}

async function upsertBranchSettings(
  branchId: string,
  payload: Record<string, unknown>,
  createDefaults: Record<string, unknown> = {}
): Promise<void> {
  const scopedBranchId = assertBranchScope(branchId);
  const scopedPayload = scopeWritePayload(
    COLLECTIONS.branchSettings,
    payload,
    'update'
  );
  const createFields = scopeWritePayload(
    COLLECTIONS.branchSettings,
    { ...createDefaults, ...scopedPayload },
    'create'
  );

  try {
    const existing = await pb
      .collection(COLLECTIONS.branchSettings)
      .getFirstListItem(pb.filter('branch_id = {:branchId}', { branchId: scopedBranchId }));
    await pb.collection(COLLECTIONS.branchSettings).update(existing.id, scopedPayload);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    await pb.collection(COLLECTIONS.branchSettings).create(createFields);
  }
}

/**
 * Menu writes may be multipart when a local photo is attached; a FormData body
 * already carries the scoped `branch_id` from the record it was built from.
 */
async function menuWritePayload(
  item: MenuItem,
  mode: 'create' | 'update',
  removeImage: boolean
): Promise<Record<string, unknown> | FormData> {
  const scopedItem: MenuItem = { ...item, branchId: assertBranchScope(item.branchId) };
  const payload = await buildMenuItemWritePayload(scopedItem, { clearImage: removeImage });

  if (payload instanceof FormData) {
    console.log(
      `[payload] menu_items ${mode} ${scopedItem.id} (multipart) ` +
        JSON.stringify(toMenuItemRecord(scopedItem)) +
        ' + image file'
    );
    return payload;
  }

  const scoped = scopeWritePayload(COLLECTIONS.menuItems, payload, mode);
  console.log(`[payload] menu_items ${mode} ${scopedItem.id} ${JSON.stringify(scoped)}`);
  return scoped;
}

async function saveMenuRecord(
  item: MenuItem,
  mode: 'create' | 'update',
  removeImage = false
): Promise<void> {
  if (mode === 'create') {
    try {
      const payload = await menuWritePayload(item, 'create', removeImage);
      await pb
        .collection(COLLECTIONS.menuItems)
        .create(withRecordId(payload, item.id));
    } catch (error) {
      if (!isDuplicateRecordError(error)) throw error;
      // The record was created by an earlier request whose response was lost.
      // Rebuild the multipart payload so the image stream is fresh.
      const retryPayload = await menuWritePayload(item, 'update', removeImage);
      await pb.collection(COLLECTIONS.menuItems).update(item.id, retryPayload);
    }
    return;
  }

  const payload = await menuWritePayload(item, 'update', removeImage);
  await pb.collection(COLLECTIONS.menuItems).update(item.id, payload);
}

async function saveTableRecord(table: DiningTable): Promise<void> {
  const payload = scopeWritePayload(
    COLLECTIONS.tables,
    toTableRecord(table),
    'update'
  );
  console.log(`[payload] tables update ${table.id} ${JSON.stringify(payload)}`);
  try {
    await pb.collection(COLLECTIONS.tables).update(table.id, payload);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const createPayload = withRecordId(
      scopeWritePayload(COLLECTIONS.tables, toTableRecord(table), 'create'),
      table.id
    );
    console.log(`[payload] tables create ${table.id} ${JSON.stringify(createPayload)}`);
    await pb.collection(COLLECTIONS.tables).create(createPayload);
  }
}

async function applyOutboxEntry(entry: OutboxEntry): Promise<void> {
  switch (entry.actionType) {
    case 'UPDATE_ORDER_STATUS': {
      const orderId = String(entry.payload.orderId ?? '');
      const status = String(entry.payload.status ?? '');
      const at = String(entry.payload.at ?? new Date().toISOString());
      if (!orderId || !status) return;
      const patch: Record<string, unknown> = { status };
      if (status === 'ready') patch.ready_at = at;
      if (status === 'completed') patch.completed_at = at;
      await pb
        .collection(COLLECTIONS.orders)
        .update(orderId, scopeWritePayload(COLLECTIONS.orders, patch, 'update'));
      return;
    }
    case 'CREATE_ORDER': {
      const order = entry.payload.order as Order | undefined;
      if (!order) return;
      await createOrUpdateRecord(
        COLLECTIONS.orders,
        order.id,
        toOrderRecord({ ...order, branchId: assertBranchScope(order.branchId) })
      );
      return;
    }
    case 'TOGGLE_MENU_STOCK': {
      const itemId = String(entry.payload.itemId ?? '');
      if (!itemId) return;
      await pb.collection(COLLECTIONS.menuItems).update(
        itemId,
        scopeWritePayload(
          COLLECTIONS.menuItems,
          { in_stock: Boolean(entry.payload.inStock) },
          'update'
        )
      );
      return;
    }
    case 'UPDATE_MENU_PRICE': {
      const itemId = String(entry.payload.itemId ?? '');
      if (!itemId) return;
      await pb.collection(COLLECTIONS.menuItems).update(
        itemId,
        scopeWritePayload(
          COLLECTIONS.menuItems,
          { price: Number(entry.payload.price ?? 0) },
          'update'
        )
      );
      return;
    }
    case 'CREATE_MENU_ITEM': {
      const item = entry.payload.item as MenuItem | undefined;
      if (!item) return;
      await saveMenuRecord(item, 'create', entry.payload.imageRemoved === true);
      return;
    }
    case 'UPDATE_MENU_ITEM': {
      const item = entry.payload.item as MenuItem | undefined;
      if (!item) return;
      await saveMenuRecord(item, 'update', entry.payload.imageRemoved === true);
      return;
    }
    case 'SAVE_TABLE': {
      const table = entry.payload.table as DiningTable | undefined;
      if (!table) return;
      await saveTableRecord(table);
      return;
    }
    case 'UPDATE_RESERVATION_STATUS': {
      const reservationId = String(entry.payload.reservationId ?? '');
      if (!reservationId) return;
      await pb.collection(COLLECTIONS.reservations).update(
        reservationId,
        scopeWritePayload(
          COLLECTIONS.reservations,
          { status: String(entry.payload.status ?? '') },
          'update'
        )
      );
      return;
    }
    case 'UPDATE_STORE_HOURS': {
      const config = entry.payload.config as StoreOperationsConfig | undefined;
      const branchId = String(entry.payload.branchId ?? '');
      if (!config || !branchId) return;
      // The paired settings snapshot lets a missing branch_settings row be
      // created with the terminal's current configuration instead of a
      // half-populated defaults record.
      const settingsSnapshot = entry.payload.settings as TerminalSettings | undefined;
      await upsertBranchSettings(
        branchId,
        toStoreRecord(config),
        settingsSnapshot ? toBranchSettingsRecord(settingsSnapshot) : {}
      );
      return;
    }
    case 'UPDATE_SETTINGS': {
      const settings = entry.payload.settings as TerminalSettings | undefined;
      const branchId = String(
        entry.payload.branchId ?? settings?.pocketbaseBranchId ?? ''
      );
      if (!settings || !branchId) return;
      const configSnapshot = entry.payload.config as StoreOperationsConfig | undefined;
      await upsertBranchSettings(
        branchId,
        toBranchSettingsRecord(settings),
        configSnapshot ? toStoreRecord(configSnapshot) : {}
      );
      return;
    }
    default:
      return;
  }
}

/**
 * Delivers queued offline mutations in order. A failed entry stays queued so the
 * terminal can retry; successful entries are safe to mark as synced.
 */
export async function flushOutbox(entries: OutboxEntry[]): Promise<FlushResult> {
  if (entries.length === 0) {
    return {
      syncedIds: [],
      failedIds: [],
      syncedTypes: [],
      failures: [],
      discarded: [],
    };
  }

  if (!isPocketBaseConfigured) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_SYNC_DELAY_MS));
    return {
      syncedIds: entries.map((entry) => entry.id),
      failedIds: [],
      syncedTypes: entries.map((entry) => entry.actionType),
      failures: [],
      discarded: [],
    };
  }

  const syncedIds: string[] = [];
  const failedIds: string[] = [];
  const syncedTypes: OutboxActionType[] = [];
  const failures: SyncFailure[] = [];
  const discarded: SyncFailure[] = [];

  for (const entry of entries) {
    try {
      logSyncAttempt(entry);
      await applyOutboxEntry(entry);
      syncedIds.push(entry.id);
      syncedTypes.push(entry.actionType);
      console.log(`[sync] ok ${entry.actionType} (${entry.id})`);
    } catch (error) {
      const described = describePocketBaseError(error);
      const failure: SyncFailure = {
        entryId: entry.id,
        actionType: entry.actionType,
        label: entry.label,
        error: described,
      };

      if (PERMANENT_ERROR_KINDS.has(described.kind)) {
        // Dead-letter: drop this mutation only, keep the rest of the queue live.
        discarded.push(failure);
        console.warn(
          `[sync] DISCARDED ${entry.actionType} "${entry.label}"` +
            ` | kind=${described.kind} status=${described.status}` +
            ` | message=${described.message}` +
            (described.detail ? ` | detail=${described.detail}` : '') +
            (described.url ? ` | url=${described.url}` : '') +
            ` | removed from queue (permanent)`
        );
        continue;
      }

      failures.push(failure);
      // The full server rejection: kind, HTTP status, PocketBase message, the
      // per-field validation detail, and the request URL that produced it.
      console.warn(
        `[sync] FAILED ${entry.actionType} "${entry.label}"` +
          ` | kind=${described.kind} status=${described.status}` +
          ` | message=${described.message}` +
          (described.detail ? ` | detail=${described.detail}` : '') +
          (described.url ? ` | url=${described.url}` : '') +
          ` | hint=${describeSyncHint(described)}`
      );
      failedIds.push(entry.id);
    }
  }

  return { syncedIds, failedIds, syncedTypes, failures, discarded };
}
