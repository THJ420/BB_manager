import type { SQLiteDatabase } from 'expo-sqlite'

import { listOutbox, type OutboxRow } from '@/db/outbox'
import { useSyncStore } from '@/stores/syncStore'

export async function reloadOutbox(db: SQLiteDatabase): Promise<OutboxRow[]> {
  const rows = await listOutbox(db)
  useSyncStore.getState().setOutbox(rows)

  return rows
}
