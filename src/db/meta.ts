import type { SQLiteDatabase } from 'expo-sqlite'

export const META_SESSION = 'session'
export const META_FIRST_SYNC_DONE = 'first_sync_done'
export const META_LAST_SYNC_AT = 'last_sync_at'
export const META_LAST_ALERT_AT = 'last_alert_at'

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)

  return row?.value ?? null
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  )
}

export async function deleteMeta(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('DELETE FROM meta WHERE key = ?', key)
}

export async function getJsonMeta<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const value = await getMeta(db, key)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function setJsonMeta(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
  await setMeta(db, key, JSON.stringify(value))
}
