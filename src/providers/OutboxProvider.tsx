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

import { reloadOutbox } from '@/services/outboxState'
import { flushOutbox } from '@/services/outboxFlush'
import { useToast } from '@/providers/ToastProvider'
import { useSession } from '@/providers/SessionProvider'
import { OUTBOX_INTERVAL_MS } from '@/lib/config'
import { retryFailedOutbox, resetStuckSending } from '@/db/outbox'
import { useSyncStore } from '@/stores/syncStore'

interface OutboxContextValue {
  flushing: boolean
  retryNow: () => Promise<void>
}

const OutboxContext = createContext<OutboxContextValue | null>(null)

export function OutboxProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext()
  const { status, requireReauth } = useSession()
  const { showToast } = useToast()
  const [flushing, setFlushing] = useState(false)
  const flushingRef = useRef(false)
  const mountedRef = useRef(true)
  const flushTick = useSyncStore((state) => state.flushTick)

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

  const runFlush = useCallback(async () => {
    if (status !== 'signedIn' || flushingRef.current) {
      return
    }

    flushingRef.current = true

    if (mountedRef.current) {
      setFlushing(true)
    }

    try {
      await flushOutbox(db, {
        onToast: (message) => showToast(message, 'error'),
        onAuthRequired: () => {
          requireReauth()
          showToast('Sign in again to sync queued changes.', 'error')
        },
      })
    } finally {
      flushingRef.current = false

      if (mountedRef.current) {
        setFlushing(false)
      }

      await reloadOutbox(db)
    }
  }, [db, requireReauth, showToast, status])

  useEffect(() => {
    if (status !== 'signedIn') {
      return
    }

    void (async () => {
      await resetStuckSending(db)
      await reloadOutbox(db)
      await runFlush()
    })()
  }, [db, runFlush, status])

  useEffect(() => {
    if (!flushTick) {
      return
    }

    const timer = setTimeout(() => {
      void runFlush()
    }, 1200)

    return () => clearTimeout(timer)
  }, [flushTick, runFlush])

  useEffect(() => {
    if (status !== 'signedIn') {
      return
    }

    const interval = setInterval(() => {
      void reloadOutbox(db)
      void runFlush()
    }, OUTBOX_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [db, runFlush, status])

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected === true && state.isInternetReachable !== false) {
        void runFlush()
      }
    })

    return () => subscription.remove()
  }, [runFlush])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void runFlush()
      }
    })

    return () => subscription.remove()
  }, [runFlush])

  const retryNow = useCallback(async () => {
    await retryFailedOutbox(db)
    await reloadOutbox(db)
    useSyncStore.getState().requestFlush()
    await runFlush()
  }, [db, runFlush])

  const value = useMemo<OutboxContextValue>(() => ({ flushing, retryNow }), [flushing, retryNow])

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
}

export function useOutbox(): OutboxContextValue {
  const context = useContext(OutboxContext)

  if (!context) {
    throw new Error('useOutbox must be used inside OutboxProvider')
  }

  return context
}
