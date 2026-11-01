import type { SQLiteDatabase } from 'expo-sqlite'

import { uuid } from '@/lib/uuid'

export type OutboxKind = 'order_status' | 'menu_update'
export type OutboxState = 'pending' | 'sending' | 'failed' | 'needs_auth'

export interface OutboxRow {
  id: string
  kind: OutboxKind
  entityId: string
  payload: string
  baseStatus: string | null
  createdAt: number
  attempts: number
  nextAttemptAt: number
  state: OutboxState
  lastError: string | null
}

interface OutboxDbRow {
  id: string
  kind: string
  entity_id: string
  payload: string
  base_status: string | null
  created_at: number
  attempts: number
  next_attempt_at: number
  state: string
  last_error: string | null
}

function isKind(value: string): value is OutboxKind {
  return value === 'order_status' || value === 'menu_update'
}

function isState(value: string): value is OutboxState {
  return value === 'pending' || value === 'sending' || value === 'failed' || value === 'needs_auth'
}

function rowToOutbox(row: OutboxDbRow): OutboxRow {
  return {
    id: row.id,
    kind: isKind(row.kind) ? row.kind : 'menu_update',
    entityId: row.entity_id,
    payload: row.payload,
    baseStatus: row.base_status,
    createdAt: row.created_at,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    state: isState(row.state) ? row.state : 'pending',
    lastError: row.last_error,
  }
}

export function parseOutboxPayload<T>(row: OutboxRow): T | null {
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}

export async function enqueueOrderStatus(
  db: SQLiteDatabase,
  orderId: string,
  status: string,
  baseStatus: string | null,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO outbox (id, kind, entity_id, payload, base_status, created_at, state)
     VALUES (?, 'order_status', ?, ?, ?, ?, 'pending')`,
    uuid(),
    orderId,
    JSON.stringify({ status }),
    baseStatus,
    Date.now(),
  )
}

export async function enqueueMenuUpdate(
  db: SQLiteDatabase,
  menuId: string,
  payload: { price?: number; is_available?: boolean },
): Promise<void> {
  const serialized = JSON.stringify(payload)

  const update = await db.runAsync(
    `UPDATE outbox SET
       payload = ?,
       state = 'pending',
       attempts = 0,
       next_attempt_at = 0,
       last_error = NULL,
       created_at = ?
     WHERE id = (
       SELECT id FROM outbox
       WHERE kind = 'menu_update' AND entity_id = ? AND state IN ('pending', 'failed', 'needs_auth')
       ORDER BY created_at DESC
       LIMIT 1
     )`,
    serialized,
    Date.now(),
    menuId,
  )

  if (update.changes > 0) {
    return
  }

  await db.runAsync(
    `INSERT INTO outbox (id, kind, entity_id, payload, created_at, state)
     VALUES (?, 'menu_update', ?, ?, ?, 'pending')`,
    uuid(),
    menuId,
    serialized,
    Date.now(),
  )
}

export async function listOutbox(db: SQLiteDatabase, limit = 200): Promise<OutboxRow[]> {
  const rows = await db.getAllAsync<OutboxDbRow>(
    'SELECT * FROM outbox ORDER BY created_at ASC, id ASC LIMIT ?',
    limit,
  )

  return rows.map(rowToOutbox)
}

export async function listDueOutbox(db: SQLiteDatabase, now = Date.now()): Promise<OutboxRow[]> {
  const rows = await db.getAllAsync<OutboxDbRow>(
    "SELECT * FROM outbox WHERE state = 'pending' AND next_attempt_at <= ? ORDER BY created_at ASC, id ASC",
    now,
  )

  return rows.map(rowToOutbox)
}

export async function markOutboxSending(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("UPDATE outbox SET state = 'sending' WHERE id = ?", id)
}

export async function completeOutbox(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id)
}

export async function failOutbox(
  db: SQLiteDatabase,
  id: string,
  options: {
    state: OutboxState
    attempts: number
    nextAttemptAt: number
    lastError: string
  },
): Promise<void> {
  await db.runAsync(
    'UPDATE outbox SET state = ?, attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
    options.state,
    options.attempts,
    options.nextAttemptAt,
    options.lastError,
    id,
  )
}

export async function pauseOutboxForAuth(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("UPDATE outbox SET state = 'needs_auth' WHERE state IN ('pending', 'sending')")
}

export async function resetStuckSending(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("UPDATE outbox SET state = 'pending' WHERE state = 'sending'")
}

export async function retryFailedOutbox(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    "UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = 0, last_error = NULL WHERE state IN ('failed', 'needs_auth')",
  )
}

export async function requeueAuthPausedOutbox(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    "UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = 0 WHERE state = 'needs_auth'",
  )
}

export async function discardOutbox(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id)
}

export async function clearOutbox(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM outbox')
}

export async function countOutbox(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM outbox')

  return row?.count ?? 0
}
