import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { getOrder, markOrderSeen, type CachedOrder } from '@/db/orders'
import { projectOrderStatus } from '@/lib/outboxPolicy'
import { AppHeader } from '@/components/AppHeader'
import { EmptyState } from '@/components/EmptyState'
import { OrderDetail } from '@/components/OrderDetail'
import { Screen } from '@/components/Screen'
import { useOrdersStore } from '@/stores/ordersStore'
import { useSyncStore } from '@/stores/syncStore'
import { spacing } from '@/theme/tokens'

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const db = useSQLiteContext()
  const liveOrder = useOrdersStore((state) => state.orders.find((order) => order.id === id))
  const outbox = useSyncStore((state) => state.outbox)
  const [fallback, setFallback] = useState<CachedOrder | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!id) {
      return
    }

    if (liveOrder) {
      void markOrderSeen(db, liveOrder.id)

      return
    }

    void getOrder(db, id).then((cached) => {
      if (!cancelled) {
        setFallback(cached)
      }
    })

    return () => {
      cancelled = true
    }
  }, [db, id, liveOrder])

  const order = liveOrder ?? fallback

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <AppHeader title="Order" subtitle={order?.customerName || undefined} onBack={() => router.back()} />

      <View style={styles.body}>
        {order ? (
          (() => {
            const projection = projectOrderStatus(order.status, order.id, outbox)

            return (
              <OrderDetail
                order={order}
                status={projection.status}
                pending={projection.pending}
                failed={projection.failed}
              />
            )
          })()
        ) : (
          <EmptyState
            title="Order not found"
            message="This order is not in the local cache. Go back and refresh the order list."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.sm,
  },
})
