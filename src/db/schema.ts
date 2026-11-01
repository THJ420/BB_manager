import type { SQLiteDatabase } from 'expo-sqlite'

import { DB_NAME } from '@/lib/config'

export { DB_NAME }
export const SCHEMA_VERSION = 1

const DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  pickup_time TEXT,
  items_json TEXT NOT NULL,
  total_price REAL NOT NULL,
  source_website TEXT,
  created TEXT,
  updated TEXT,
  acknowledged_at INTEGER,
  seen_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created DESC);

CREATE TABLE IF NOT EXISTS menu (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  name TEXT,
  category TEXT,
  description TEXT,
  price REAL NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1,
  updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_menu_category_name ON menu(category, name);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  base_status TEXT,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(state, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(kind, entity_id, created_at);

CREATE TABLE IF NOT EXISTS alerted (
  order_id TEXT PRIMARY KEY,
  alerted_at INTEGER NOT NULL
);
`

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
  const version = row?.user_version ?? 0

  if (version > SCHEMA_VERSION) {
    throw new Error('This app is older than the local database. Update the app.')
  }

  if (version === SCHEMA_VERSION) {
    return
  }

  await db.withTransactionAsync(async () => {
    if (version < 1) {
      await db.execAsync(DDL)
    }

    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })
}

export async function clearLocalData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM orders; DELETE FROM menu; DELETE FROM outbox; DELETE FROM alerted; DELETE FROM meta;')
  })
}
