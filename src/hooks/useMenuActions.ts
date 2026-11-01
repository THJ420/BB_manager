import { useSQLiteContext } from 'expo-sqlite'
import { useCallback } from 'react'

import { describeError } from '@/lib/errors'
import type { MenuPatch } from '@/lib/outboxPolicy'
import { queueMenuUpdate } from '@/services/actions'
import { useToast } from '@/providers/ToastProvider'

export function useMenuActions() {
  const db = useSQLiteContext()
  const { showToast } = useToast()

  const updateMenu = useCallback(async (menuId: string, patch: MenuPatch, successMessage: string) => {
    try {
      await queueMenuUpdate(db, menuId, patch)
      showToast(successMessage, 'success')
    } catch (error) {
      showToast(describeError(error), 'error')
    }
  }, [db, showToast])

  const setAvailability = useCallback((menuId: string, isAvailable: boolean) => {
    return updateMenu(
      menuId,
      { is_available: isAvailable },
      isAvailable ? 'Marked as available.' : 'Marked as out of stock.',
    )
  }, [updateMenu])

  const setPrice = useCallback((menuId: string, price: number) => {
    return updateMenu(menuId, { price }, 'Price saved. Syncing…')
  }, [updateMenu])

  return { setAvailability, setPrice }
}
