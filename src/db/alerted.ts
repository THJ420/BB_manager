import type { SQLiteDatabase } from 'expo-sqlite'

export async function markAlerted(db: SQLiteDatabase, orderId: string): Promise<boolean> {
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO alerted (order_id, alerted_at) VALUES (?, ?)',
    orderId,
    Date.now(),
  )

  return result.changes > 0
}

export async function hasAlerted(db: SQLiteDatabase, orderId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ order_id: string }>(
    'SELECT order_id FROM alerted WHERE order_id = ?',
    orderId,
  )

  return row !== null
}

export async function markManyAlerted(db: SQLiteDatabase, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) {
    return
  }

  const now = Date.now()

  await db.withTransactionAsync(async () => {
    for (const orderId of orderIds) {
      await db.runAsync('INSERT OR IGNORE INTO alerted (order_id, alerted_at) VALUES (?, ?)', orderId, now)
    }
  })
}

export async function clearAlerted(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM alerted')
}
