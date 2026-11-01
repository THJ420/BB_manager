import { useRouter } from 'expo-router'
import { useKeepAwake } from 'expo-keep-awake'
import { useSQLiteContext } from 'expo-sqlite'
import { useMemo } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { CachedOrder } from '@/db/orders'
import { markOrderSeen } from '@/db/orders'
import { formatRelativeTimestamp } from '@/lib/time'
import { isTerminal, statusSortValue } from '@/lib/orderStatus'
import { projectOrderStatus } from '@/lib/outboxPolicy'
import type { OrderStatus } from '@/types/models'
import { AppHeader } from '@/components/AppHeader'
import { ConnectionBadge } from '@/components/ConnectionBadge'
import { EmptyState } from '@/components/EmptyState'
import { OrderCard } from '@/components/OrderCard'
import { OrderDetail } from '@/components/OrderDetail'
import { Screen } from '@/components/Screen'
import { useResponsive } from '@/hooks/useResponsive'
import { useMenuStore } from '@/stores/menuStore'
import { useOrdersStore } from '@/stores/ordersStore'
import { useSyncStore } from '@/stores/syncStore'
import { useUiStore, type OrderFilter } from '@/stores/uiStore'
import { useSession } from '@/providers/SessionProvider'
import { useSync } from '@/providers/SyncProvider'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface EnrichedOrder {
  order: CachedOrder
  status: OrderStatus
  pending: boolean
  failed: boolean
}

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'New' },
  { key: 'accepted', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'all', label: 'All' },
]

function matchesFilter(status: OrderStatus, filter: OrderFilter): boolean {
  if (filter === 'all') {
    return true
  }

  if (filter === 'active') {
    return !isTerminal(status)
  }

  return status === filter
}

export default function OrdersScreen() {
  useKeepAwake('bb-manager-orders')
  const router = useRouter()
  const db = useSQLiteContext()
  const { branch } = useSession()
  const { isWide } = useResponsive()
  const { refreshing, refresh, lastSyncAt } = useSync()

  const orders = useOrdersStore((state) => state.orders)
  const hydrated = useOrdersStore((state) => state.hydrated)
  const menu = useMenuStore((state) => state.menu)
  const outbox = useSyncStore((state) => state.outbox)
  const filter = useUiStore((state) => state.orderFilter)
  const setFilter = useUiStore((state) => state.setOrderFilter)
  const selectedOrderId = useUiStore((state) => state.selectedOrderId)
  const selectOrder = useUiStore((state) => state.selectOrder)

  const menuNames = useMemo(
    () => Object.fromEntries(menu.map((item) => [item.id, item.name])),
    [menu],
  )

  const enriched = useMemo<EnrichedOrder[]>(() => {
    return orders
      .map((order) => {
        const projection = projectOrderStatus(order.status, order.id, outbox)

        return {
          order,
          status: projection.status,
          pending: projection.pending,
          failed: projection.failed,
        }
      })
      .filter((entry) => matchesFilter(entry.status, filter))
      .sort((left, right) => {
        const statusDiff = statusSortValue(left.status) - statusSortValue(right.status)

        return statusDiff !== 0
          ? statusDiff
          : (right.order.created || '').localeCompare(left.order.created || '')
      })
  }, [filter, orders, outbox])

  const pendingCount = useMemo(
    () => orders.filter((order) => projectOrderStatus(order.status, order.id, outbox).status === 'pending').length,
    [orders, outbox],
  )

  const selected = isWide
    ? enriched.find((entry) => entry.order.id === selectedOrderId) ?? enriched[0] ?? null
    : null

  const openOrder = (order: CachedOrder) => {
    if (isWide) {
      selectOrder(order.id)
      void markOrderSeen(db, order.id)
      return
    }

    void markOrderSeen(db, order.id)
    router.push({ pathname: '/order/[id]', params: { id: order.id } })
  }

  const subtitle = `${branch?.name ?? 'Branch'} · ${pendingCount} new${
    lastSyncAt ? ` · synced ${formatRelativeTimestamp(new Date(lastSyncAt).toISOString())}` : ''
  }`

  const list = (
    <FlatList
      data={enriched}
      keyExtractor={(entry) => entry.order.id}
      style={styles.list}
      contentContainerStyle={[styles.listContent, enriched.length === 0 && styles.listEmpty]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title={hydrated ? 'No orders here' : 'Loading orders…'}
          message={hydrated
            ? 'New pickup orders for your branch will appear here automatically.'
            : 'Reading the local order cache.'}
          actionLabel={hydrated ? 'Refresh' : undefined}
          onAction={hydrated ? () => void refresh() : undefined}
        />
      }
      renderItem={({ item }) => (
        <OrderCard
          order={item.order}
          status={item.status}
          pending={item.pending}
          failed={item.failed}
          menuNames={menuNames}
          selected={isWide && selected?.order.id === item.order.id}
          onPress={() => openOrder(item.order)}
        />
      )}
    />
  )

  return (
    <Screen>
      <AppHeader
        title="Orders"
        subtitle={subtitle}
        right={(
          <View style={styles.headerRight}>
            <ConnectionBadge />
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              disabled={refreshing}
              style={({ pressed }) => [styles.syncButton, (pressed || refreshing) && styles.pressed]}
            >
              <Text style={styles.syncButtonText}>{refreshing ? 'Syncing…' : 'Sync'}</Text>
            </Pressable>
          </View>
        )}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {FILTERS.map((entry) => {
          const active = filter === entry.key

          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(entry.key)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isWide ? (
        <View style={styles.split}>
          <View style={styles.listPane}>{list}</View>
          <View style={styles.detailPane}>
            {selected ? (
              <OrderDetail
                order={selected.order}
                status={selected.status}
                pending={selected.pending}
                failed={selected.failed}
              />
            ) : (
              <EmptyState
                title="Select an order"
                message="Choose an order from the list to see its items and update its status."
              />
            )}
          </View>
        </View>
      ) : (
        list
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  listEmpty: {
    justifyContent: 'center',
  },
  separator: {
    height: spacing.md,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  syncButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.label,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.accentText,
    fontWeight: '700',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
  },
  listPane: {
    width: 420,
    flexShrink: 0,
  },
  detailPane: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
})
