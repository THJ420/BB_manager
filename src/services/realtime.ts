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

export interface RealtimeHandlers {
  onOrder: (order: Order) => void;
  onMenuItem: (item: MenuItem) => void;
  onTable: (table: DiningTable) => void;
  onReservation: (reservation: Reservation) => void;
  onStoreConfig: (config: StoreOperationsConfig) => void;
  onSettings: (settings: TerminalSettings) => void;
  onStatus: (status: ConnectionStatus) => void;
}

type Subscription = [collection: string, handle: (record: RecordModel) => void];

function recordBranchId(record: RecordModel): string {
  return typeof record.branch_id === 'string' ? record.branch_id : '';
}

/**
 * Opens PocketBase realtime (SSE) subscriptions for every operational
 * collection belonging to the signed-in branch. The branch filter is sent to the
 * server, so records from another branch are never transmitted to this device;
 * the local comparison is a second gate, not the only one. Returns a cleanup
 * function.
 */
export async function startRealtime(
  branchId: string,
  handlers: RealtimeHandlers
): Promise<() => void> {
  if (!isPocketBaseConfigured) {
    handlers.onStatus('live');
    return () => undefined;
  }

  const scopedBranchId = assertBranchScope(branchId);
  const filter = pb.filter('branch_id = {:branchId}', { branchId: scopedBranchId });
  const subscribeOptions = { filter };

  const belongsToBranch = (record: RecordModel): boolean =>
    recordBranchId(record) === scopedBranchId;

  const subscriptions: Subscription[] = [
    [
      COLLECTIONS.orders,
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onOrder(mapOrderRecord(record));
      },
    ],
    [
      COLLECTIONS.menuItems,
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onMenuItem(mapMenuRecord(record));
      },
    ],
    [
      COLLECTIONS.tables,
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onTable(mapTableRecord(record));
      },
    ],
    [
      COLLECTIONS.reservations,
      (record) => {
        if (!belongsToBranch(record)) return;
        handlers.onReservation(mapReservationRecord(record));
      },
    ],
    [
      COLLECTIONS.branchSettings,
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
    ],
  ];

  const unsubscribers: Array<() => void> = [];

  try {
    for (const [collection, handle] of subscriptions) {
      const unsubscribe = await pb
        .collection(collection)
        .subscribe('*', (event) => {
          if (event.action === 'delete') return;
          try {
            handle(event.record);
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
