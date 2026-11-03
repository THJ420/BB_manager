import type { RecordModel } from 'pocketbase';
import { isPocketBaseConfigured, pb } from './pocketbase';
import { COLLECTIONS } from './collections';
import { assertBranchScope } from './branchScope';
import { isNotFoundError } from './errors';
import {
  mapBranchRecord,
  mapBranchSettingsRecord,
  mapMenuRecord,
  mapOrderRecord,
  mapReservationRecord,
  mapTableRecord,
} from './mappers';
import { normalizeTerminalSettings } from '../lib/settings';
import { createDefaultStoreConfig, createDefaultTerminalSettings } from '../lib/seed';
import {
  Branch,
  DiningTable,
  MenuItem,
  Order,
  Reservation,
  StoreOperationsConfig,
  TerminalSettings,
} from '../types';

const ANALYTICS_LOOKBACK_DAYS = 365;
const OPERATIONAL_LOOKBACK_DAYS = 7;
const PAGE_SIZE = 200;

export interface BranchSnapshot {
  branches: Branch[];
  orders: Order[];
  analyticsHistory: Order[];
  menuItems: MenuItem[];
  tables: DiningTable[];
  reservations: Reservation[];
  storeConfig: StoreOperationsConfig;
  settings: TerminalSettings;
}

function branchFilter(branchId: string): string {
  return pb.filter('branch_id = {:branchId}', { branchId: assertBranchScope(branchId) });
}

function newestFirst(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

async function fetchBranches(): Promise<Branch[]> {
  try {
    const records = await pb
      .collection(COLLECTIONS.branches)
      .getFullList<RecordModel>(PAGE_SIZE, { sort: 'name' });
    return records.map(mapBranchRecord);
  } catch (error) {
    console.warn('Unable to load the PocketBase branch directory', error);
    return [];
  }
}

async function fetchSettingsRecord(branchId: string): Promise<RecordModel | null> {
  try {
    return await pb
      .collection(COLLECTIONS.branchSettings)
      .getFirstListItem<RecordModel>(branchFilter(branchId));
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

/**
 * Loads the complete live operational dataset for one branch. Orders cover the
 * analytics year; the board receives active tickets plus the last seven days.
 */
export async function fetchBranchSnapshot(
  branchId: string,
  now: number = Date.now()
): Promise<BranchSnapshot> {
  if (!isPocketBaseConfigured) {
    throw new Error('PocketBase is not configured.');
  }

  const scopedBranchId = assertBranchScope(branchId);
  const analyticsStart = new Date(
    now - ANALYTICS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const operationalStart = now - OPERATIONAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const [branches, orderRecords, menuRecords, tableRecords, reservationRecords, settingsRecord] =
    await Promise.all([
      fetchBranches(),
      pb.collection(COLLECTIONS.orders).getFullList<RecordModel>(PAGE_SIZE, {
        filter: pb.filter(
          'branch_id = {:branchId} && created >= {:start}',
          { branchId: scopedBranchId, start: analyticsStart }
        ),
        sort: '-created',
      }),
      pb.collection(COLLECTIONS.menuItems).getFullList<RecordModel>(PAGE_SIZE, {
        filter: branchFilter(scopedBranchId),
        sort: 'category,name',
      }),
      pb.collection(COLLECTIONS.tables).getFullList<RecordModel>(PAGE_SIZE, {
        filter: branchFilter(scopedBranchId),
        sort: 'table_number',
      }),
      pb.collection(COLLECTIONS.reservations).getFullList<RecordModel>(PAGE_SIZE, {
        filter: branchFilter(scopedBranchId),
        sort: 'reservation_time',
      }),
      fetchSettingsRecord(scopedBranchId),
    ]);

  const activeBranch = branches.find((branch) => branch.id === scopedBranchId);
  const defaults = normalizeTerminalSettings({
    ...createDefaultTerminalSettings(),
    branchName: activeBranch?.name ?? 'Restaurant Branch',
    pocketbaseBranchId: scopedBranchId,
  });

  const analyticsHistory = newestFirst(
    orderRecords.map(mapOrderRecord).filter((order) => order.branchId === scopedBranchId)
  );
  const orders = analyticsHistory.filter((order) => {
    if (order.status !== 'completed' && order.status !== 'cancelled') return true;
    return Date.parse(order.createdAt) >= operationalStart;
  });

  const settings = settingsRecord
    ? mapBranchSettingsRecord(settingsRecord, defaults).settings
    : defaults;
  const storeConfig = settingsRecord
    ? mapBranchSettingsRecord(settingsRecord, defaults).config
    : createDefaultStoreConfig();

  return {
    branches,
    orders,
    analyticsHistory,
    menuItems: menuRecords
      .map(mapMenuRecord)
      .filter((item) => item.branchId === scopedBranchId),
    tables: tableRecords
      .map(mapTableRecord)
      .filter((table) => table.branchId === scopedBranchId),
    reservations: reservationRecords
      .map(mapReservationRecord)
      .filter((reservation) => reservation.branchId === scopedBranchId),
    storeConfig,
    settings,
  };
}
