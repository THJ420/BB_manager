import { create } from 'zustand'

import type { CachedOrder } from '@/db/orders'

interface OrdersState {
  orders: CachedOrder[]
  hydrated: boolean
  setOrders: (orders: CachedOrder[]) => void
  hydrate: (orders: CachedOrder[]) => void
  upsert: (order: CachedOrder) => void
}

function sortOrders(orders: CachedOrder[]): CachedOrder[] {
  return [...orders].sort((left, right) => (right.created || '').localeCompare(left.created || ''))
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  hydrated: false,
  setOrders: (orders) => set({ orders: sortOrders(orders) }),
  hydrate: (orders) => set({ orders: sortOrders(orders), hydrated: true }),
  upsert: (order) => set((state) => {
    const index = state.orders.findIndex((entry) => entry.id === order.id)

    if (index === -1) {
      return { orders: sortOrders([order, ...state.orders]) }
    }

    const next = [...state.orders]
    next[index] = order

    return { orders: sortOrders(next) }
  }),
}))
