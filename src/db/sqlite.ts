import * as SQLite from 'expo-sqlite';
import { OutboxEntry, TerminalSettings } from '../types';

const DATABASE_NAME = 'bb_manager_local.db';

export const SNAPSHOT_KEYS = {
  orders: 'orders',
  menu: 'menu_items',
  tables: 'tables',
  reservations: 'reservations',
  storeConfig: 'branch_settings',
  terminalSettings: 'terminal_settings',
  analyticsHistory: 'analytics_history',
} as const;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outbox_queue (
      id TEXT PRIMARY KEY NOT NULL,
      action_type TEXT NOT NULL,
      label TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_queue (synced, created_at);
  `);
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return databasePromise;
}

interface CacheRow {
  payload: string;
}

interface OutboxRow {
  id: string;
  action_type: string;
  label: string;
  payload: string;
  created_at: number;
  retry_count: number;
  synced: number;
}

export async function saveSnapshot<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO cache_entries (key, payload, updated_at) VALUES (?, ?, ?)`,
    key,
    JSON.stringify(value),
    Date.now()
  );
}

export async function loadSnapshot<T>(key: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CacheRow>(
    `SELECT payload FROM cache_entries WHERE key = ?`,
    key
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function saveTerminalSettings(settings: TerminalSettings): Promise<void> {
  await saveSnapshot(SNAPSHOT_KEYS.terminalSettings, settings);
}

export async function loadTerminalSettings(): Promise<TerminalSettings | null> {
  return loadSnapshot<TerminalSettings>(SNAPSHOT_KEYS.terminalSettings);
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox_queue WHERE synced = 0 ORDER BY created_at ASC, rowid ASC`
  );
  return rows.map((row) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    return {
      id: row.id,
      actionType: row.action_type as OutboxEntry['actionType'],
      label: row.label,
      payload,
      createdAt: row.created_at,
      retryCount: row.retry_count,
      synced: row.synced === 1,
    };
  });
}

export async function insertOutbox(entry: OutboxEntry): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO outbox_queue
       (id, action_type, label, payload, created_at, retry_count, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.actionType,
    entry.label,
    JSON.stringify(entry.payload),
    entry.createdAt,
    entry.retryCount,
    entry.synced ? 1 : 0
  );
}

export async function markOutboxSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE outbox_queue SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids
  );
}

export async function incrementOutboxRetry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE outbox_queue SET retry_count = retry_count + 1 WHERE id = ?`,
    id
  );
}

export async function pruneSyncedOutbox(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM outbox_queue WHERE synced = 1`);
}
