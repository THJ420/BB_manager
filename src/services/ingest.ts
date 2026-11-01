import type { SQLiteDatabase } from 'expo-sqlite'

import { getOrder, listOrders, upsertOrder, upsertOrders, type CachedOrder } from '@/db/orders'
import { listMenu, replaceMenu, upsertMenu } from '@/db/menu'
import { useMenuStore } from '@/stores/menuStore'
import { useOrdersStore } from '@/stores/ordersStore'
import type { MenuRecord, OrderRecord } from '@/types/models'
import { isOrderStatus } from '@/types/models'

export type OrderAlertHandler = (order: CachedOrder) => void | Promise<void>

let alertHandler: OrderAlertHandler | null = null

export function setOrderAlertHandler(handler: OrderAlertHandler | null): void {
  alertHandler = handler
}

async function maybeAlert(order: CachedOrder): Promise<void> {
  if (order.status !== 'pending' || !alertHandler) {
    return
  }

  try {
    await alertHandler(order)
  } catch (error) {
    console.warn('Order alert handler failed', error)
  }
}

export async function ingestOrder(
  db: SQLiteDatabase,
  record: OrderRecord,
  suppressAlert = false,
): Promise<CachedOrder | null> {
  if (!isOrderStatus(record.status)) {
    return null
  }

  await upsertOrder(db, record)

  const order = await getOrder(db, record.id)

  if (!order) {
    return null
  }

  useOrdersStore.getState().upsert(order)

  if (!suppressAlert) {
    await maybeAlert(order)
  }

  return order
}

export async function ingestOrdersBatch(
  db: SQLiteDatabase,
  branchId: string,
  records: OrderRecord[],
  suppressAlert = false,
): Promise<CachedOrder[]> {
  await upsertOrders(db, records)

  const orders = await listOrders(db, branchId)
  useOrdersStore.getState().setOrders(orders)

  if (!suppressAlert) {
    for (const record of records) {
      if (record.status !== 'pending') {
        continue
      }

      const order = await getOrder(db, record.id)

      if (order) {
        await maybeAlert(order)
      }
    }
  }

  return orders
}

export async function ingestMenu(db: SQLiteDatabase, record: MenuRecord): Promise<void> {
  await upsertMenu(db, record)

  const menu = await listMenu(db, record.branch_id)
  useMenuStore.getState().setMenu(menu)
}

export async function ingestMenuBatch(
  db: SQLiteDatabase,
  branchId: string,
  records: MenuRecord[],
): Promise<void> {
  await replaceMenu(db, branchId, records)

  const menu = await listMenu(db, branchId)
  useMenuStore.getState().setMenu(menu)
}
