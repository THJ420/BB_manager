import type PocketBase from 'pocketbase'
import type { SQLiteDatabase } from 'expo-sqlite'

import type { MenuRecord } from '@/types/models'
import { ingestMenuBatch } from '@/services/ingest'

export async function fetchMenu(pb: PocketBase, branchId: string): Promise<MenuRecord[]> {
  return pb.collection('menu').getFullList<MenuRecord>({
    filter: pb.filter('branch_id = {:branchId}', { branchId }),
    sort: 'category,name',
  })
}

export async function syncMenu(
  db: SQLiteDatabase,
  pb: PocketBase,
  branchId: string,
): Promise<void> {
  const records = await fetchMenu(pb, branchId)

  await ingestMenuBatch(db, branchId, records)
}
