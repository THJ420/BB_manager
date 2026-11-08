import type { RecordModel } from 'pocketbase';
import { pb, isPocketBaseConfigured } from './pocketbase';
import { COLLECTIONS } from './collections';
import { assertBranchScope } from './branchScope';
import {
  mapBranchSettingsRecord,
  mapMenuRecord,
  mapOrderRecord,
  mapReservationRecord,
  mapTableRecord,
} from './mappers';
import { normalizeTerminalSettings } from '../lib/settings';
import { createDefaultTerminalSettings } from '../lib/seed';
import {
  ConnectionStatus,
  DiningTable,
  MenuItem,
  Order,
  Reservation,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';

export type RealtimeEntity = 'order' | 'menu_item' | 'table' | 'reservation';

export interface RealtimeHandlers {
  onOrder: (order: Order) => void;
  onMenuItem: (item: MenuItem) => void;
  onTable: (table: DiningTable) => void;
  onReservation: (reservation: Reservation) => void;
  /** A record removed on the website (or another terminal). */
  onDelete: (entity: RealtimeEntity, id: string) => void;
  onStoreConfig: (config: StoreOperationsConfig) => void;
  onSettings: (settings: TerminalSettings) => void;
  onStatus: (status: ConnectionStatus) => void;
}

type Subscription = [
  collection: string,
  entity: RealtimeEntity | null,
  handle: (record: RecordModel) => void,
];

function recordBranchId(record: RecordModel | null | undefined): string {
  if (!record) return '';
  const value = record.branch_id;
  if (typeof value === 'string') return value.trim();
  // A relation field configured with maxSelect > 1 is serialized as an array;
  // accept the first id instead of silently dropping the realtime event.
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string');
    return typeof first === 'string' ? first.trim() : '';
  }
  return '';
}

export interface RealtimeOptions {
  /** Owner console: subscribe across every branch, orders + reservations only. */
  allBranches?: boolean;
}

/**
 * Opens PocketBase realtime (SSE) subscriptions for every operational
 * collection belonging to the signed-in branch. The branch filter is sent to the
 * server, so records from another branch are never transmitted to this device;
 * the local comparison is a second gate, not the only one. Returns a cleanup
 * function.
 *
 * With `allBranches` (owner console) there is no branch filter: PocketBase's
 * collection rules already restrict the stream to the owner role, and only the
 * order/reservation collections are subscribed.
 */
export async function startRealtime(
  branchId: string,
  handlers: RealtimeHandlers,
  options: RealtimeOptions = {}
): Promise<() => void> {
  if (!isPocketBaseConfigured) {
    handlers.onStatus('live');
    return () => undefined;
  }

  const allBranches = options.allBranches === true;
  const scopedBranchId = allBranches ? '' : assertBranchScope(branchId);
  const subscribeOptions = allBranches
    ? {}
    : { filter: pb.filter('branch_id = {:branchId}', { branchId: scopedBranchId }) };

  const belongsToBranch = (record: RecordModel): boolean => {
    if (allBranches) return true;
    const recordBranch = recordBranchId(record).toLowerCase();
    if (!recordBranch) return false;
    return recordBranch === scopedBranchId.trim().toLowerCase();
  };

  const subscriptions: Subscription[] = [
    [
      COLLECTIONS.orders,
      'order',
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onOrder(mapOrderRecord(record));
      },
    ],
    [
      COLLECTIONS.reservations,
      'reservation',
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onReservation(mapReservationRecord(record));
      },
    ],
  ];

  if (!allBranches) {
    subscriptions.splice(
      1,
      0,
      [
        COLLECTIONS.menuItems,
        'menu_item',
        (record) => {
          if (!belongsToBranch(record)) return;
          handlers.onMenuItem(mapMenuRecord(record));
        },
      ],
      [
        COLLECTIONS.tables,
        'table',
        (record) => {
          if (!belongsToBranch(record)) return;
          handlers.onTable(mapTableRecord(record));
        },
      ]
    );
    subscriptions.push([
      COLLECTIONS.branchSettings,
      null,
      (record) => {
        if (!belongsToBranch(record)) return;
        const defaults = normalizeTerminalSettings({
          ...createDefaultTerminalSettings(),
          pocketbaseBranchId: scopedBranchId,
        });
        const mapped = mapBranchSettingsRecord(record, defaults);
        handlers.onStoreConfig(mapped.config);
        handlers.onSettings(mapped.settings);
      },
    ]);
  }

  const unsubscribers: Array<() => void> = [];

  try {
    for (const [collection, entity, handle] of subscriptions) {
      const unsubscribe = await pb
        .collection(collection)
        .subscribe('*', (event) => {
          const record = (event?.record ?? null) as RecordModel | null;
          if (!record || !belongsToBranch(record)) return;
          try {
            // PocketBase emits lowercase actions, but some proxies/webhook
            // bridges replay uppercase SQL verbs. Normalise before dispatching.
            const action = String(event?.action ?? '').toLowerCase();
            if (action === 'delete' || action === 'remove') {
              // A deleted record still carries its branch, so the gate above
              // keeps another branch's deletion from touching local state.
              if (entity) handlers.onDelete(entity, record.id);
              return;
            }
            // 'create' | 'insert' | 'update' | 'patch' all flow into the mapper.
            // Normalise the relation id so downstream filters/comparisons see the
            // canonical (trimmed, single) branch id even if the wire value was
            // padded or serialized as an array.
            const canonicalBranchId = recordBranchId(record);
            const normalized =
              record.branch_id === canonicalBranchId
                ? record
                : ({ ...record, branch_id: canonicalBranchId } as RecordModel);
            handle(normalized);
          } catch (error) {
            console.warn(`Unable to apply realtime ${collection} event`, error);
          }
        }, subscribeOptions);
      unsubscribers.push(() => {
        void unsubscribe().catch(() => undefined);
      });
    }
    handlers.onStatus('live');
  } catch (error) {
    console.warn('PocketBase realtime unavailable, falling back to offline queue', error);
    for (const unsubscribe of unsubscribers) unsubscribe();
    handlers.onStatus('offline');
    return () => undefined;
  }

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
