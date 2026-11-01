import { OUTBOX_BACKOFF_SECONDS, OUTBOX_MAX_ATTEMPTS } from '@/lib/config'
import type { OrderStatus } from '@/types/models'
import { isOrderStatus } from '@/types/models'

export type ProjectableState = 'pending' | 'sending' | 'failed' | 'needs_auth'
export type ProjectableKind = 'order_status' | 'menu_update'

export interface ProjectableOutboxRow {
  kind: ProjectableKind
  entityId: string
  payload: string
  state: ProjectableState
  createdAt: number
}

const ACTIVE_STATES: ProjectableState[] = ['pending', 'sending', 'failed', 'needs_auth']

export interface MenuPatch {
  price?: number
  is_available?: boolean
}

export interface ProjectedMenu {
  price: number
  isAvailable: boolean
  pending: boolean
  failed: boolean
}

export function parsePayload<T>(row: ProjectableOutboxRow): T | null {
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}

function relevantRows(
  rows: ProjectableOutboxRow[],
  kind: ProjectableKind,
  entityId: string,
): ProjectableOutboxRow[] {
  return rows
    .filter((row) => row.kind === kind && row.entityId === entityId && ACTIVE_STATES.includes(row.state))
    .sort((left, right) => left.createdAt - right.createdAt)
}

export function projectOrderStatus(
  serverStatus: OrderStatus,
  orderId: string,
  rows: ProjectableOutboxRow[],
): { status: OrderStatus; pending: boolean; failed: boolean } {
  const statusRows = relevantRows(rows, 'order_status', orderId)
  let status = serverStatus
  let pending = false
  let failed = false

  for (const row of statusRows) {
    const payload = parsePayload<{ status?: string }>(row)

    if (payload?.status && isOrderStatus(payload.status)) {
      status = payload.status
      pending = true
      failed = failed || row.state === 'failed' || row.state === 'needs_auth'
    }
  }

  return { status, pending, failed }
}

export function projectMenu(
  menu: { price: number; isAvailable: boolean },
  menuId: string,
  rows: ProjectableOutboxRow[],
): ProjectedMenu {
  const menuRows = relevantRows(rows, 'menu_update', menuId)
  let price = menu.price
  let isAvailable = menu.isAvailable
  let pending = false
  let failed = false

  for (const row of menuRows) {
    const payload = parsePayload<MenuPatch>(row)

    if (typeof payload?.price === 'number' && Number.isFinite(payload.price)) {
      price = payload.price
      pending = true
    }

    if (typeof payload?.is_available === 'boolean') {
      isAvailable = payload.is_available
      pending = true
    }

    failed = failed || row.state === 'failed' || row.state === 'needs_auth'
  }

  return { price, isAvailable, pending, failed }
}

export function backoffSeconds(attempts: number): number {
  const index = Math.max(0, Math.min(attempts - 1, OUTBOX_BACKOFF_SECONDS.length - 1))

  return OUTBOX_BACKOFF_SECONDS[index]
}

export function nextAttemptAt(attempts: number, now = Date.now()): number {
  return now + backoffSeconds(attempts) * 1000
}

export function shouldMarkFailed(attempts: number): boolean {
  return attempts >= OUTBOX_MAX_ATTEMPTS
}
