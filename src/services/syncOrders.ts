import type PocketBase from 'pocketbase'
import type { SQLiteDatabase } from 'expo-sqlite'

import { ORDER_PAGE_SIZE } from '@/lib/config'
import { toPbFilterDate } from '@/lib/time'
import type { OrderRecord } from '@/types/models'
import { ingestOrdersBatch } from '@/services/ingest'

export async function fetchOrders(
  pb: PocketBase,
  branchId: string,
  since?: Date,
): Promise<OrderRecord[]> {
  const filter = since
    ? pb.filter('branch_id = {:branchId} && updated >= {:since}', {
        branchId,
        since: toPbFilterDate(since),
      })
    : pb.filter('branch_id = {:branchId}', { branchId })

  const page = await pb.collection('orders').getList<OrderRecord>(1, ORDER_PAGE_SIZE, {
    filter,
    sort: '-created',
  })

  return page.items
}

export async function syncOrders(
  db: SQLiteDatabase,
  pb: PocketBase,
  branchId: string,
  options: { since?: Date; suppressAlert?: boolean } = {},
): Promise<void> {
  const records = await fetchOrders(pb, branchId, options.since)

  await ingestOrdersBatch(db, branchId, records, options.suppressAlert ?? false)
}
