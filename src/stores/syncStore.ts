import { create } from 'zustand'

import type { OutboxRow } from '@/db/outbox'

interface SyncState {
  outbox: OutboxRow[]
  flushTick: number
  lastSyncAt: number | null
  setOutbox: (outbox: OutboxRow[]) => void
  setLastSyncAt: (value: number | null) => void
  requestFlush: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  outbox: [],
  flushTick: 0,
  lastSyncAt: null,
  setOutbox: (outbox) => set({ outbox }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  requestFlush: () => set((state) => ({ flushTick: state.flushTick + 1 })),
}))
