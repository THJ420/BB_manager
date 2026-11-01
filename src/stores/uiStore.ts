import { create } from 'zustand'

import type { OrderStatus } from '@/types/models'

export type ConnectionMode = 'booting' | 'live' | 'polling' | 'offline' | 'auth'
export type OrderFilter = 'active' | 'all' | OrderStatus

interface UiState {
  connection: ConnectionMode
  lastEventAt: number | null
  orderFilter: OrderFilter
  selectedOrderId: string | null
  setConnection: (connection: ConnectionMode) => void
  noteEvent: () => void
  setOrderFilter: (filter: OrderFilter) => void
  selectOrder: (orderId: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  connection: 'booting',
  lastEventAt: null,
  orderFilter: 'active',
  selectedOrderId: null,
  setConnection: (connection) => set({ connection }),
  noteEvent: () => set({ lastEventAt: Date.now() }),
  setOrderFilter: (orderFilter) => set({ orderFilter }),
  selectOrder: (selectedOrderId) => set({ selectedOrderId }),
}))
