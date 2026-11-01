import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useState } from 'react'

import type { CachedOrder } from '@/db/orders'
import { describeError } from '@/lib/errors'
import type { OrderStatus } from '@/types/models'
import { queueOrderStatus } from '@/services/actions'
import { useToast } from '@/providers/ToastProvider'

export function useOrderActions() {
  const db = useSQLiteContext()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  const setStatus = useCallback(async (order: CachedOrder, target: OrderStatus) => {
    setBusy(true)

    try {
      await queueOrderStatus(db, order, target)
      showToast('Saved. Syncing with the server…', 'info')
    } catch (error) {
      showToast(describeError(error), 'error')
    } finally {
      setBusy(false)
    }
  }, [db, showToast])

  return { busy, setStatus }
}
