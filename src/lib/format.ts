import type { OrderItem } from '@/types/models'

const priceFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
})

export function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)

  return priceFormatter.format(Number.isFinite(amount) ? amount : 0)
}

export function parsePriceInput(input: string): number | null {
  if (input.includes('-')) {
    return null
  }

  const normalized = input.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')

  if (normalized === '' || normalized === '.') {
    return null
  }

  const value = Number(normalized)

  if (!Number.isFinite(value) || value < 0 || value > 999_999.99) {
    return null
  }

  return Math.round(value * 100) / 100
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function itemName(item: OrderItem, menuName?: string): string {
  return item.name?.trim() || menuName || `Item #${item.menu_id ?? '?'}`
}

export function itemSummary(items: OrderItem[], menuNames: Record<string, string> = {}): string {
  if (items.length === 0) {
    return 'No items'
  }

  const parts = items.slice(0, 3).map((item) => {
    const name = itemName(item, item.menu_id ? menuNames[String(item.menu_id)] : undefined)

    return `${formatQuantity(item.quantity)}× ${name}`
  })

  if (items.length > 3) {
    parts.push(`+${items.length - 3} more`)
  }

  return parts.join(', ')
}

export function initials(name?: string, email?: string): string {
  const source = name?.trim() || email?.split('@')[0] || '?'

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
