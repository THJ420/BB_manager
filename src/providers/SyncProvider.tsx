import * as Network from 'expo-network'
import { useSQLiteContext } from 'expo-sqlite'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { AppState } from 'react-native'

import { markManyAlerted } from '@/db/alerted'
import { listMenu } from '@/db/menu'
import { getMeta, META_FIRST_SYNC_DONE, META_LAST_SYNC_AT, setMeta } from '@/db/meta'
import { listOrders, pruneOrders } from '@/db/orders'
import { listOutbox } from '@/db/outbox'
import { ORDER_CACHE_DAYS, POLL_INTERVAL_MS } from '@/lib/config'
import { describeError, normalizeError } from '@/lib/errors'
import { toPbFilterDate } from '@/lib/time'
import { useMenuStore } from '@/stores/menuStore'
import { useOrdersStore } from '@/stores/ordersStore'
import { useSyncStore } from '@/stores/syncStore'
import { useUiStore } from '@/stores/uiStore'
import { ingestOrder } from '@/services/ingest'
import { getPb } from '@/services/pocketbase'
import { RealtimeWatcher } from '@/services/realtime'
import { syncMenu } from '@/services/syncMenu'
import { syncOrders } from '@/services/syncOrders'
import { useSession } from '@/providers/SessionProvider'
import { useToast } from '@/providers/ToastProvider'

interface SyncContextValue {
  refreshing: boolean
  lastSyncAt: number | null
  refresh: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext()
  const { status, branchId } = useSession()
  const { showToast } = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt)

  const lastSyncRef = useRef<number | null>(null)
  const syncingRef = useRef(false)
  const watcherRef = useRef<RealtimeWatcher | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

  const hydrateCache = useCallback(async (targetBranchId: string) => {
    const [orders, menu, outbox, lastSync] = await Promise.all([
      listOrders(db, targetBranchId),
      listMenu(db, targetBranchId),
      listOutbox(db),
      getMeta(db, META_LAST_SYNC_AT),
    ])

    useOrdersStore.getState().hydrate(orders)
    useMenuStore.getState().hydrate(menu)
    useSyncStore.getState().setOutbox(outbox)

    const timestamp = lastSync ? Number(lastSync) : null
    lastSyncRef.current = Number.isFinite(timestamp) ? timestamp : null
    useSyncStore.getState().setLastSyncAt(lastSyncRef.current)
  }, [db])

  const syncAll = useCallback(async () => {
    if (!branchId || syncingRef.current) {
      return
    }

    syncingRef.current = true

    try {
      const pb = getPb()
      const firstSyncDone = (await getMeta(db, META_FIRST_SYNC_DONE)) === '1'
      const since = firstSyncDone && lastSyncRef.current
        ? new Date(lastSyncRef.current - 120_000)
        : undefined

      await syncOrders(db, pb, branchId, {
        since,
        suppressAlert: !firstSyncDone,
      })

      if (!firstSyncDone) {
        const pendingIds = useOrdersStore.getState().orders
          .filter((order) => order.status === 'pending')
          .map((order) => order.id)

        await markManyAlerted(db, pendingIds)
        await setMeta(db, META_FIRST_SYNC_DONE, '1')
      }

      await syncMenu(db, pb, branchId)

      const now = Date.now()
      lastSyncRef.current = now
      useSyncStore.getState().setLastSyncAt(now)
      await setMeta(db, META_LAST_SYNC_AT, String(now))
      await pruneOrders(
        db,
        branchId,
        toPbFilterDate(new Date(now - ORDER_CACHE_DAYS * 86_400_000)),
      )

      useOrdersStore.getState().setOrders(await listOrders(db, branchId))
    } finally {
      syncingRef.current = false
    }
  }, [branchId, db])

  const refresh = useCallback(async () => {
    if (status !== 'signedIn' || !branchId) {
      return
    }

    setRefreshing(true)

    try {
      await syncAll()
    } catch (error) {
      showToast(describeError(error), 'error')
      useUiStore.getState().setConnection(
        normalizeError(error).kind === 'network' ? 'offline' : 'polling',
      )
    } finally {
      if (mountedRef.current) {
        setRefreshing(false)
      }
    }
  }, [branchId, showToast, status, syncAll])

  useEffect(() => {
    let cancelled = false

    if (status !== 'signedIn' || !branchId) {
      useUiStore.getState().setConnection(
        status === 'offline' ? 'offline' : status === 'signedOut' ? 'auth' : 'booting',
      )

      if (status === 'offline' && branchId) {
        void hydrateCache(branchId)
      }

      return () => {
        cancelled = true
      }
    }

    const pb = getPb()
    const watcher = new RealtimeWatcher(pb, branchId, {
      onOrder: (record) => {
        if (record.branch_id !== branchId) {
          return
        }

        useUiStore.getState().noteEvent()
        void ingestOrder(db, record, false).catch((error) => {
          console.warn('Realtime order ingest failed', error)
        })
      },
      onMenu: () => {
        void syncMenu(db, pb, branchId).catch((error) => {
          console.warn('Realtime menu sync failed', error)
        })
      },
      onState: (state) => {
        useUiStore.getState().setConnection(state === 'live' ? 'live' : 'polling')
      },
    })

    watcherRef.current = watcher

    const poll = async () => {
      if (useUiStore.getState().connection === 'offline' || syncingRef.current) {
        return
      }

      try {
        await syncAll()
      } catch (error) {
        useUiStore.getState().setConnection(
          normalizeError(error).kind === 'network' ? 'offline' : 'polling',
        )
      }
    }

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (state.isConnected !== true || state.isInternetReachable === false) {
          useUiStore.getState().setConnection('offline')
        }
      })
      .catch(() => {})

    void (async () => {
      useUiStore.getState().setConnection('polling')
      await hydrateCache(branchId)

      if (cancelled) {
        return
      }

      try {
        await syncAll()
      } catch (error) {
        useUiStore.getState().setConnection(
          normalizeError(error).kind === 'network' ? 'offline' : 'polling',
        )
      }

      if (cancelled) {
        return
      }

      await watcher.start()

      if (cancelled) {
        return
      }

      pollTimerRef.current = setInterval(() => {
        void poll()
      }, POLL_INTERVAL_MS)
    })()

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return
      }

      useSyncStore.getState().requestFlush()

      if (useUiStore.getState().connection !== 'live') {
        void watcher.restart()
      }

      void poll()
    })

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false

      if (!online) {
        useUiStore.getState().setConnection('offline')

        return
      }

      const wasLive = useUiStore.getState().connection === 'live'

      if (!wasLive) {
        useUiStore.getState().setConnection('polling')
        void watcher.restart()
      }

      void poll()
      useSyncStore.getState().requestFlush()
    })

    return () => {
      cancelled = true
      appStateSubscription.remove()
      networkSubscription.remove()

      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }

      void watcher.stop()

      if (watcherRef.current === watcher) {
        watcherRef.current = null
      }
    }
  }, [branchId, db, hydrateCache, status, syncAll])

  const value = useMemo<SyncContextValue>(() => ({
    refreshing,
    lastSyncAt,
    refresh,
  }), [lastSyncAt, refresh, refreshing])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)

  if (!context) {
    throw new Error('useSync must be used inside SyncProvider')
  }

  return context
}
