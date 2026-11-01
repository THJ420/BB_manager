import type { OrderStatus } from '@/types/models'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  accepted: 'Preparing',
  ready: 'Ready for pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_SHORT_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  accepted: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#F2B544',
  accepted: '#38BDF8',
  ready: '#22C55E',
  completed: '#8B96A5',
  cancelled: '#EF4444',
}

export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export type StatusActionTone = 'primary' | 'success' | 'danger' | 'neutral'

export interface StatusAction {
  status: OrderStatus
  label: string
  tone: StatusActionTone
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled'
}

export function isActive(status: OrderStatus): boolean {
  return !isTerminal(status)
}

export function nextActions(status: OrderStatus): StatusAction[] {
  return ALLOWED_TRANSITIONS[status].map((target): StatusAction => {
    if (target === 'accepted') {
      return { status: target, label: 'Accept order', tone: 'primary' }
    }

    if (target === 'ready') {
      return { status: target, label: 'Mark ready', tone: 'success' }
    }

    if (target === 'completed') {
      return { status: target, label: 'Complete', tone: 'neutral' }
    }

    return { status: target, label: 'Cancel', tone: 'danger' }
  })
}

export function statusSortValue(status: OrderStatus): number {
  switch (status) {
    case 'pending':
      return 0
    case 'accepted':
      return 1
    case 'ready':
      return 2
    case 'completed':
      return 3
    case 'cancelled':
      return 4
  }
}
