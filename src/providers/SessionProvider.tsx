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

import { getJsonMeta, META_SESSION, setJsonMeta } from '@/db/meta'
import { requeueAuthPausedOutbox, resetStuckSending } from '@/db/outbox'
import { clearLocalData } from '@/db/schema'
import { normalizeError } from '@/lib/errors'
import { useMenuStore } from '@/stores/menuStore'
import { useOrdersStore } from '@/stores/ordersStore'
import { useSyncStore } from '@/stores/syncStore'
import {
  AuthRequiredError,
  ensureFreshAuth,
  getStaff,
  loadBranch,
  login as loginService,
  logout as logoutService,
} from '@/services/auth'
import { configureNotificationChannel, requestNotificationPermission } from '@/services/notifications'
import { getPb, initPocketBase } from '@/services/pocketbase'
import type { BranchRecord, SessionSnapshot, StaffRecord } from '@/types/models'

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn' | 'offline'

interface SessionContextValue {
  status: SessionStatus
  staff: StaffRecord | null
  branch: BranchRecord | null
  branchId: string | null
  canContinueOffline: boolean
  lastError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  continueOffline: () => void
  requireReauth: (message?: string) => void
  recover: () => Promise<void>
  clearError: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function placeholderBranch(staff: StaffRecord): BranchRecord {
  return {
    id: staff.branch_id,
    name: 'Your branch',
    slug: '',
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext()
  const [status, setStatus] = useState<SessionStatus>('booting')
  const [staff, setStaff] = useState<StaffRecord | null>(null)
  const [branch, setBranch] = useState<BranchRecord | null>(null)
  const [canContinueOffline, setCanContinueOffline] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const statusRef = useRef<SessionStatus>('booting')
  const snapshotRef = useRef<SessionSnapshot | null>(null)
  const recoveringRef = useRef(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const persistSnapshot = useCallback(
    async (nextStaff: StaffRecord, nextBranch: BranchRecord) => {
      const snapshot: SessionSnapshot = {
        staff: {
          id: nextStaff.id,
          email: nextStaff.email,
          name: nextStaff.name,
          role: nextStaff.role,
          branch_id: nextStaff.branch_id,
        },
        branch: nextBranch,
        loginAt: new Date().toISOString(),
      }

      snapshotRef.current = snapshot
      setCanContinueOffline(true)
      await setJsonMeta(db, META_SESSION, snapshot)
    },
    [db],
  )

  const clearStores = useCallback(() => {
    useOrdersStore.getState().setOrders([])
    useMenuStore.getState().setMenu([])
    useSyncStore.getState().setOutbox([])
    useSyncStore.getState().setLastSyncAt(null)
  }, [])

  const applySnapshot = useCallback((snapshot: SessionSnapshot) => {
    snapshotRef.current = snapshot
    setStaff(snapshot.staff as StaffRecord)
    setBranch(snapshot.branch)
    setCanContinueOffline(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      try {
        await initPocketBase()
      } catch (error) {
        if (!cancelled) {
          setStatus('signedOut')
          setLastError(normalizeError(error).message)
        }

        return
      }

      try {
        await resetStuckSending(db)
        await configureNotificationChannel()
      } catch (error) {
        console.warn('Local database or notification setup failed', error)
      }

      const snapshot = await getJsonMeta<SessionSnapshot>(db, META_SESSION)

      if (cancelled) {
        return
      }

      snapshotRef.current = snapshot
      setCanContinueOffline(snapshot !== null)

      const currentStaff = getStaff()
      const pb = getPb()

      if (pb.authStore.isValid && currentStaff) {
        try {
          await ensureFreshAuth()
          const freshStaff = getStaff() ?? currentStaff
          const freshBranch = await loadBranch(freshStaff.branch_id)

          if (cancelled) {
            return
          }

          setStaff(freshStaff)
          setBranch(freshBranch)
          setStatus('signedIn')
          setLastError(null)
          await persistSnapshot(freshStaff, freshBranch)
        } catch (error) {
          if (cancelled) {
            return
          }

          const normalized = normalizeError(error)

          if (normalized.kind === 'network') {
            if (snapshot && snapshot.staff.branch_id === currentStaff.branch_id) {
              applySnapshot(snapshot)
            } else {
              setStaff(currentStaff)
              setBranch(placeholderBranch(currentStaff))
            }

            setStatus('offline')

            return
          }

          logoutService()
          setStatus('signedOut')
          setLastError(normalized.message)
        }

        return
      }

      if (snapshot) {
        applySnapshot(snapshot)
        setStatus('offline')

        return
      }

      setStatus('signedOut')
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [applySnapshot, db, persistSnapshot])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLastError(null)

      const result = await loginService(email, password)
      const previous = snapshotRef.current

      if (previous && previous.staff.branch_id !== result.staff.branch_id) {
        await clearLocalData(db)
        clearStores()
        snapshotRef.current = null
      }

      setStaff(result.staff)
      setBranch(result.branch)
      setStatus('signedIn')
      setCanContinueOffline(true)
      await persistSnapshot(result.staff, result.branch)
      await requeueAuthPausedOutbox(db)
      useSyncStore.getState().requestFlush()

      void requestNotificationPermission().catch(() => false)
    },
    [clearStores, db, persistSnapshot],
  )

  const signOut = useCallback(async () => {
    logoutService()
    await clearLocalData(db)
    clearStores()
    snapshotRef.current = null
    setStaff(null)
    setBranch(null)
    setLastError(null)
    setCanContinueOffline(false)
    setStatus('signedOut')
  }, [clearStores, db])

  const continueOffline = useCallback(() => {
    const snapshot = snapshotRef.current

    if (!snapshot) {
      return
    }

    applySnapshot(snapshot)
    setStatus('offline')
    setLastError(null)
  }, [applySnapshot])

  const requireReauth = useCallback((message = 'Your session expired. Sign in again to sync.') => {
    logoutService()
    setLastError(message)
    setStatus('signedOut')
  }, [])

  const recover = useCallback(async () => {
    if (recoveringRef.current) {
      return
    }

    const currentStaff = getStaff()

    if (!currentStaff) {
      setStatus('signedOut')

      return
    }

    recoveringRef.current = true

    try {
      await ensureFreshAuth()
      const freshStaff = getStaff() ?? currentStaff
      const freshBranch = await loadBranch(freshStaff.branch_id)
      setStaff(freshStaff)
      setBranch(freshBranch)
      setStatus('signedIn')
      setLastError(null)
      await persistSnapshot(freshStaff, freshBranch)
      useSyncStore.getState().requestFlush()
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        requireReauth()
      }
    } finally {
      recoveringRef.current = false
    }
  }, [persistSnapshot, requireReauth])

  useEffect(() => {
    if (status !== 'signedIn') {
      return
    }

    const interval = setInterval(() => {
      void ensureFreshAuth().catch((error) => {
        if (error instanceof AuthRequiredError) {
          requireReauth()
        }
      })
    }, 6 * 60 * 60 * 1000)

    return () => clearInterval(interval)
  }, [requireReauth, status])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return
      }

      if (statusRef.current === 'signedIn') {
        void ensureFreshAuth().catch((error) => {
          if (error instanceof AuthRequiredError) {
            requireReauth()
            return
          }

          if (normalizeError(error).kind === 'network') {
            setStatus('offline')
          }
        })
      } else if (statusRef.current === 'offline') {
        void recover()
      }
    })

    return () => subscription.remove()
  }, [recover, requireReauth])

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false

      if (!online || statusRef.current !== 'offline') {
        return
      }

      void recover()
    })

    return () => subscription.remove()
  }, [recover])

  const clearError = useCallback(() => setLastError(null), [])

  const value = useMemo<SessionContextValue>(() => ({
    status,
    staff,
    branch,
    branchId: staff?.branch_id ?? null,
    canContinueOffline,
    lastError,
    signIn,
    signOut,
    continueOffline,
    requireReauth,
    recover,
    clearError,
  }), [
    branch,
    canContinueOffline,
    clearError,
    continueOffline,
    lastError,
    recover,
    requireReauth,
    signIn,
    signOut,
    staff,
    status,
  ])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider')
  }

  return context
}
