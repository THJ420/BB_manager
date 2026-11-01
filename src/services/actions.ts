import type { SQLiteDatabase } from 'expo-sqlite'

import type { CachedOrder } from '@/db/orders'
import { enqueueMenuUpdate, enqueueOrderStatus } from '@/db/outbox'
import { canTransition } from '@/lib/orderStatus'
import { projectOrderStatus, type MenuPatch } from '@/lib/outboxPolicy'
import { useSyncStore } from '@/stores/syncStore'
import type { OrderStatus } from '@/types/models'
import { reloadOutbox } from '@/services/outboxState'

export async function queueOrderStatus(
  db: SQLiteDatabase,
  order: CachedOrder,
  target: OrderStatus,
): Promise<void> {
  const rows = useSyncStore.getState().outbox
  const projected = projectOrderStatus(order.status, order.id, rows)

  if (projected.status === target) {
    return
  }

  if (!canTransition(projected.status, target)) {
    throw new Error(
      `Cannot move this order from ${projected.status} to ${target}. Refresh the order list.`,
    )
  }

  await enqueueOrderStatus(db, order.id, target, projected.status)
  await reloadOutbox(db)
  useSyncStore.getState().requestFlush()
}

export async function queueMenuUpdate(
  db: SQLiteDatabase,
  menuId: string,
  patch: MenuPatch,
): Promise<void> {
  if (patch.price === undefined && patch.is_available === undefined) {
    return
  }

  await enqueueMenuUpdate(db, menuId, patch)
  await reloadOutbox(db)
  useSyncStore.getState().requestFlush()
}
