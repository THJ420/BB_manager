import type { SQLiteDatabase } from 'expo-sqlite'

import { parseOrderItems, type OrderItem, type OrderRecord, type OrderStatus, isOrderStatus } from '@/types/models'

export interface CachedOrder {
  id: string
  branchId: string
  status: OrderStatus
  customerName: string
  customerPhone: string
  pickupTime: string
  items: OrderItem[]
  totalPrice: number
  sourceWebsite: string
  created: string
  updated: string
  acknowledgedAt: number | null
  seenAt: number | null
}

interface OrderRow {
  id: string
  branch_id: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  pickup_time: string | null
  items_json: string
  total_price: number
  source_website: string | null
  created: string | null
  updated: string | null
  acknowledged_at: number | null
  seen_at: number | null
}

function rowToOrder(row: OrderRow): CachedOrder {
  return {
    id: row.id,
    branchId: row.branch_id,
    status: isOrderStatus(row.status) ? row.status : 'pending',
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    pickupTime: row.pickup_time ?? '',
    items: parseOrderItems(row.items_json),
    totalPrice: Number(row.total_price),
    sourceWebsite: row.source_website ?? '',
    created: row.created ?? '',
    updated: row.updated ?? '',
    acknowledgedAt: row.acknowledged_at,
    seenAt: row.seen_at,
  }
}

export async function upsertOrder(db: SQLiteDatabase, record: OrderRecord): Promise<void> {
  if (!isOrderStatus(record.status)) {
    return
  }

  await db.runAsync(
    `INSERT INTO orders (
      id, branch_id, status, customer_name, customer_phone, pickup_time,
      items_json, total_price, source_website, created, updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      branch_id = excluded.branch_id,
      status = excluded.status,
      customer_name = excluded.customer_name,
      customer_phone = excluded.customer_phone,
      pickup_time = excluded.pickup_time,
      items_json = excluded.items_json,
      total_price = excluded.total_price,
      source_website = excluded.source_website,
      created = excluded.created,
      updated = excluded.updated`,
    record.id,
    record.branch_id,
    record.status,
    record.customer_name ?? '',
    record.customer_phone ?? '',
    record.pickup_time ?? '',
    JSON.stringify(parseOrderItems(record.items)),
    Number(record.total_price ?? 0),
    record.source_website ?? '',
    record.created ?? '',
    record.updated ?? '',
  )
}

export async function upsertOrders(db: SQLiteDatabase, records: OrderRecord[]): Promise<void> {
  if (records.length === 0) {
    return
  }

  await db.withTransactionAsync(async () => {
    for (const record of records) {
      await upsertOrder(db, record)
    }
  })
}

export async function listOrders(db: SQLiteDatabase, branchId: string, limit = 200): Promise<CachedOrder[]> {
  const rows = await db.getAllAsync<OrderRow>(
    'SELECT * FROM orders WHERE branch_id = ? ORDER BY created DESC LIMIT ?',
    branchId,
    limit,
  )

  return rows.map(rowToOrder)
}

export async function getOrder(db: SQLiteDatabase, orderId: string): Promise<CachedOrder | null> {
  const row = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', orderId)

  return row ? rowToOrder(row) : null
}

export async function acknowledgeOrder(db: SQLiteDatabase, orderId: string): Promise<void> {
  await db.runAsync('UPDATE orders SET acknowledged_at = ? WHERE id = ?', Date.now(), orderId)
}

export async function markOrderSeen(db: SQLiteDatabase, orderId: string): Promise<void> {
  await db.runAsync('UPDATE orders SET seen_at = ? WHERE id = ?', Date.now(), orderId)
}

export async function updateLocalOrderStatus(
  db: SQLiteDatabase,
  orderId: string,
  status: OrderStatus,
  updated?: string,
): Promise<void> {
  if (updated) {
    await db.runAsync('UPDATE orders SET status = ?, updated = ? WHERE id = ?', status, updated, orderId)
    return
  }

  await db.runAsync('UPDATE orders SET status = ? WHERE id = ?', status, orderId)
}

export async function pruneOrders(db: SQLiteDatabase, branchId: string, olderThan: string): Promise<void> {
  await db.runAsync(
    "DELETE FROM orders WHERE branch_id = ? AND status IN ('completed', 'cancelled') AND created < ?",
    branchId,
    olderThan,
  )
}

export async function deleteAllOrders(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM orders')
}
