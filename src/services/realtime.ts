import type PocketBase from 'pocketbase'

import type { OrderRecord } from '@/types/models'

export type RealtimeState = 'live' | 'polling' | 'offline'

export interface RealtimeHandlers {
  onOrder: (record: OrderRecord) => void
  onMenu: () => void
  onState: (state: RealtimeState) => void
}

const MAX_RETRY_MS = 30_000

export class RealtimeWatcher {
  private started = false
  private stopped = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private menuTimer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0

  constructor(
    private readonly pb: PocketBase,
    private readonly branchId: string,
    private readonly handlers: RealtimeHandlers,
  ) {}

  async start(): Promise<void> {
    if (this.started) {
      return
    }

    this.started = true
    this.stopped = false
    await this.connect()
  }

  private async connect(): Promise<void> {
    if (this.stopped) {
      return
    }

    try {
      const filter = this.pb.filter('branch_id = {:branchId}', { branchId: this.branchId })

      await this.pb.collection('orders').subscribe('*', (event: { record?: OrderRecord }) => {
        if (event.record) {
          this.handlers.onOrder(event.record)
        }
      }, { filter })

      await this.pb.collection('menu').subscribe('*', () => {
        this.scheduleMenuSync()
      }, { filter })

      this.attempt = 0
      this.handlers.onState('live')
    } catch (error) {
      console.warn('Realtime connection failed', error)
      await this.stopSubscriptions()
      this.handlers.onState('offline')
      this.scheduleRetry()
    }
  }

  private scheduleMenuSync(): void {
    if (this.menuTimer) {
      clearTimeout(this.menuTimer)
    }

    this.menuTimer = setTimeout(() => {
      this.handlers.onMenu()
    }, 400)
  }

  private scheduleRetry(): void {
    if (this.stopped) {
      return
    }

    const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** this.attempt)
    this.attempt++

    this.retryTimer = setTimeout(() => {
      this.started = false
      void this.start()
    }, delay)
  }

  private async stopSubscriptions(): Promise<void> {
    try {
      await this.pb.collection('orders').unsubscribe('*')
    } catch {
      // The SSE connection may already be closed.
    }

    try {
      await this.pb.collection('menu').unsubscribe('*')
    } catch {
      // The SSE connection may already be closed.
    }
  }

  async restart(): Promise<void> {
    await this.stop()
    this.stopped = false
    this.attempt = 0
    await this.start()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.started = false

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (this.menuTimer) {
      clearTimeout(this.menuTimer)
      this.menuTimer = null
    }

    await this.stopSubscriptions()
  }
}
