import type { SQLiteDatabase } from 'expo-sqlite'

import { getMenu } from '@/db/menu'
import { getOrder } from '@/db/orders'
import {
  completeOutbox,
  failOutbox,
  listDueOutbox,
  markOutboxSending,
  pauseOutboxForAuth,
  parseOutboxPayload,
  type OutboxRow,
} from '@/db/outbox'
import { normalizeError } from '@/lib/errors'
import { canTransition } from '@/lib/orderStatus'
import { nextAttemptAt, shouldMarkFailed, type MenuPatch } from '@/lib/outboxPolicy'
import { isOrderStatus, type MenuRecord, type OrderRecord, type OrderStatus } from '@/types/models'
import { AuthRequiredError, ensureFreshAuth } from '@/services/auth'
import { ingestMenu, ingestOrder } from '@/services/ingest'
import { reloadOutbox } from '@/services/outboxState'
import { getPb } from '@/services/pocketbase'

export interface FlushOptions {
  onToast?: (message: string) => void
  onAuthRequired?: () => void
}

let activeFlush: Promise<void> | null = null

export function flushOutbox(db: SQLiteDatabase, options: FlushOptions = {}): Promise<void> {
  if (activeFlush) {
    return activeFlush
  }

  activeFlush = runFlush(db, options).finally(() => {
    activeFlush = null
  })

  return activeFlush
}

async function runFlush(db: SQLiteDatabase, options: FlushOptions): Promise<void> {
  try {
    await ensureFreshAuth()
  } catch (error) {
    if (error instanceof AuthRequiredError || normalizeError(error).kind === 'auth') {
      await pauseOutboxForAuth(db)
      await reloadOutbox(db)
      options.onAuthRequired?.()
    }

    return
  }

  const rows = await listDueOutbox(db)
  const blockedOrders = new Set<string>()

  for (const row of rows) {
    if (row.kind === 'order_status' && blockedOrders.has(row.entityId)) {
      continue
    }

    await markOutboxSending(db, row.id)

    try {
      if (row.kind === 'order_status') {
        await flushOrderStatus(db, row, blockedOrders, options)
      } else {
        await flushMenu(db, row)
      }
    } catch (error) {
      const normalized = normalizeError(error)

      if (error instanceof AuthRequiredError || normalized.kind === 'auth') {
        await pauseOutboxForAuth(db)
        await reloadOutbox(db)
        options.onAuthRequired?.()
        break
      }

      const attempts = row.attempts + 1
      const terminal = normalized.kind === 'validation'
        || normalized.kind === 'forbidden'
        || normalized.kind === 'notFound'
        || shouldMarkFailed(attempts)

      await failOutbox(db, row.id, {
        state: terminal ? 'failed' : 'pending',
        attempts,
        nextAttemptAt: terminal ? 0 : nextAttemptAt(attempts),
        lastError: normalized.message,
      })

      if (terminal) {
        if (row.kind === 'order_status') {
          blockedOrders.add(row.entityId)
        }

        options.onToast?.(normalized.message)
      }

      if (normalized.kind === 'network') {
        break
      }
    }
  }

  await reloadOutbox(db)
}

async function flushOrderStatus(
  db: SQLiteDatabase,
  row: OutboxRow,
  blockedOrders: Set<string>,
  options: FlushOptions,
): Promise<void> {
  const payload = parseOutboxPayload<{ status?: string }>(row)

  if (!payload?.status || !isOrderStatus(payload.status)) {
    await failOutbox(db, row.id, {
      state: 'failed',
      attempts: row.attempts + 1,
      nextAttemptAt: 0,
      lastError: 'The queued status is invalid.',
    })
    blockedOrders.add(row.entityId)

    return
  }

  const target: OrderStatus = payload.status
  const cached = await getOrder(db, row.entityId)

  if (!cached) {
    await failOutbox(db, row.id, {
      state: 'failed',
      attempts: row.attempts + 1,
      nextAttemptAt: 0,
      lastError: 'This order is no longer in the local cache.',
    })
    blockedOrders.add(row.entityId)

    return
  }

  if (cached.status === target) {
    await completeOutbox(db, row.id)

    return
  }

  if (!canTransition(cached.status, target)) {
    await failOutbox(db, row.id, {
      state: 'failed',
      attempts: row.attempts + 1,
      nextAttemptAt: 0,
      lastError: `The order is already ${cached.status}.`,
    })
    blockedOrders.add(row.entityId)
    options.onToast?.(`Order is already ${cached.status}. Refreshed from the server.`)

    return
  }

  const pb = getPb()
  const updated = await pb.collection('orders').update<OrderRecord>(row.entityId, {
    status: target,
  })

  await ingestOrder(db, updated, true)
  await completeOutbox(db, row.id)
}

async function flushMenu(
  db: SQLiteDatabase,
  row: OutboxRow,
): Promise<void> {
  const payload = parseOutboxPayload<MenuPatch>(row)
  const existing = await getMenu(db, row.entityId)

  if (!existing) {
    await failOutbox(db, row.id, {
      state: 'failed',
      attempts: row.attempts + 1,
      nextAttemptAt: 0,
      lastError: 'This menu item is no longer in the local cache.',
    })

    return
  }

  const price = typeof payload?.price === 'number' && Number.isFinite(payload.price)
    ? payload.price
    : undefined
  const isAvailable = typeof payload?.is_available === 'boolean'
    ? payload.is_available
    : undefined

  if (price === undefined && isAvailable === undefined) {
    await failOutbox(db, row.id, {
      state: 'failed',
      attempts: row.attempts + 1,
      nextAttemptAt: 0,
      lastError: 'The queued menu change is empty.',
    })

    return
  }

  const pb = getPb()
  const updated = await pb.collection('menu').update<MenuRecord>(row.entityId, {
    ...(price !== undefined ? { price } : {}),
    ...(isAvailable !== undefined ? { is_available: isAvailable } : {}),
  })

  await ingestMenu(db, updated)
  await completeOutbox(db, row.id)
}
