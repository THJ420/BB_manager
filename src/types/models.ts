export type OrderStatus = 'pending' | 'accepted' | 'ready' | 'completed' | 'cancelled'

export type Role = 'staff' | 'manager' | 'admin'

export interface OrderItem {
  menu_id?: string | number
  name?: string
  category?: string
  unit_price?: number
  quantity: number
  options?: string[]
  line_total?: number
}

export interface StaffRecord {
  id: string
  email: string
  name?: string
  role?: Role
  branch_id: string
  verified?: boolean
  collectionId?: string
  collectionName?: string
}

export interface BranchRecord {
  id: string
  name: string
  slug: string
  select?: string
  address?: string
  is_accepting_orders?: boolean
  pickup_delay_minutes?: number
}

export interface OrderRecord {
  id: string
  branch_id: string
  idempotency_key?: string
  customer_name: string
  customer_phone?: string
  pickup_time: string
  items: OrderItem[] | string
  total_price: number
  status: OrderStatus
  source_website?: string
  created: string
  updated: string
}

export interface MenuRecord {
  id: string
  branch_id: string
  name: string
  category: string
  description?: string
  price: number
  is_available?: boolean
  updated: string
}

export interface SessionSnapshot {
  staff: Pick<StaffRecord, 'id' | 'email' | 'name' | 'role' | 'branch_id'>
  branch: BranchRecord
  loginAt: string
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'ready',
  'completed',
  'cancelled',
]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus)
}

export function parseOrderItems(value: OrderRecord['items'] | null | undefined): OrderItem[] {
  let raw: unknown = value

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((entry): OrderItem | null => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const item = entry as Record<string, unknown>
      const quantity = Number(item.quantity ?? 0)

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null
      }

      const unitPrice = Number(item.unit_price ?? 0)

      return {
        menu_id: typeof item.menu_id === 'string' || typeof item.menu_id === 'number'
          ? item.menu_id
          : undefined,
        name: typeof item.name === 'string' ? item.name : undefined,
        category: typeof item.category === 'string' ? item.category : undefined,
        unit_price: Number.isFinite(unitPrice) ? unitPrice : undefined,
        quantity,
        options: Array.isArray(item.options)
          ? item.options.filter((option): option is string => typeof option === 'string')
          : [],
        line_total: Number.isFinite(Number(item.line_total)) ? Number(item.line_total) : undefined,
      }
    })
    .filter((item): item is OrderItem => item !== null)
}
