import * as Haptics from 'expo-haptics'
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

import { markAlerted } from '@/db/alerted'
import { acknowledgeOrder, type CachedOrder } from '@/db/orders'
import { describeError } from '@/lib/errors'
import { startSiren, stopSiren } from '@/services/audio'
import { setOrderAlertHandler } from '@/services/ingest'
import { queueOrderStatus } from '@/services/actions'
import { showOrderNotification } from '@/services/notifications'
import { useSession } from '@/providers/SessionProvider'
import { useToast } from '@/providers/ToastProvider'

interface AlertState {
  order: CachedOrder
  count: number
}

interface AlertsContextValue {
  alert: AlertState | null
  acknowledge: () => Promise<void>
  accept: () => Promise<void>
  testSiren: () => Promise<void>
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function AlertsProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext()
  const { status } = useSession()
  const { showToast } = useToast()
  const [alert, setAlert] = useState<AlertState | null>(null)
  const alertRef = useRef<AlertState | null>(null)
  const statusRef = useRef(status)
  const testTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    alertRef.current = alert
  }, [alert])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status !== 'signedIn') {
      stopSiren()
      // The auth status is an external transition; hide any alert immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlert(null)
    }
  }, [status])

  useEffect(() => {
    setOrderAlertHandler(async (order) => {
      if (statusRef.current !== 'signedIn') {
        return
      }

      const isNew = await markAlerted(db, order.id)

      if (!isNew) {
        return
      }

      setAlert((previous) => previous
        ? { order, count: previous.count + 1 }
        : { order, count: 1 })

      try {
        await startSiren()
      } catch (error) {
        console.warn('Siren playback failed', error)
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})

      if (AppState.currentState !== 'active') {
        void showOrderNotification(order).catch(() => {})
      }
    })

    return () => setOrderAlertHandler(null)
  }, [db])

  useEffect(() => () => {
    stopSiren()

    if (testTimer.current) {
      clearTimeout(testTimer.current)
    }
  }, [])

  const acknowledge = useCallback(async () => {
    const current = alertRef.current

    if (!current) {
      return
    }

    await acknowledgeOrder(db, current.order.id)
    stopSiren()
    setAlert(null)
  }, [db])

  const accept = useCallback(async () => {
    const current = alertRef.current

    if (!current) {
      return
    }

    try {
      await queueOrderStatus(db, current.order, 'accepted')
      await acknowledgeOrder(db, current.order.id)
      stopSiren()
      setAlert(null)
    } catch (error) {
      showToast(describeError(error), 'error')
    }
  }, [db, showToast])

  const testSiren = useCallback(async () => {
    if (testTimer.current) {
      clearTimeout(testTimer.current)
    }

    await startSiren()
    testTimer.current = setTimeout(() => stopSiren(), 3000)
  }, [])

  const value = useMemo<AlertsContextValue>(() => ({
    alert,
    acknowledge,
    accept,
    testSiren,
  }), [accept, acknowledge, alert, testSiren])

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts(): AlertsContextValue {
  const context = useContext(AlertsContext)

  if (!context) {
    throw new Error('useAlerts must be used inside AlertsProvider')
  }

  return context
}
