import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { CachedOrder } from '@/db/orders'
import { itemSummary, formatPrice } from '@/lib/format'
import { ORDER_STATUS_COLOR } from '@/lib/orderStatus'
import { formatCountdown, formatTime } from '@/lib/time'
import type { OrderStatus } from '@/types/models'
import { StatusPill } from '@/components/StatusPill'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface OrderCardProps {
  order: CachedOrder
  status: OrderStatus
  pending: boolean
  failed: boolean
  menuNames: Record<string, string>
  selected?: boolean
  onPress: () => void
}

export function OrderCard({ order, status, pending, failed, menuNames, selected, onPress }: OrderCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pending && styles.pending,
        (pressed) && styles.pressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: ORDER_STATUS_COLOR[status] }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <StatusPill status={status} pending={pending} failed={failed} />
          <Text style={styles.time}>{formatTime(order.pickupTime)}</Text>
        </View>

        <Text style={styles.customer} numberOfLines={1}>
          {order.customerName || 'Customer'}
        </Text>

        <Text style={styles.items} numberOfLines={2}>
          {itemSummary(order.items, menuNames)}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.countdown}>{formatCountdown(order.pickupTime)}</Text>
          <Text style={styles.total}>{formatPrice(order.totalPrice)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.accent,
  },
  pending: {
    borderColor: colors.borderStrong,
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  time: {
    ...typography.label,
    color: colors.textMuted,
  },
  customer: {
    ...typography.heading,
    color: colors.text,
  },
  items: {
    ...typography.body,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  countdown: {
    ...typography.caption,
    color: colors.textFaint,
  },
  total: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  pressed: {
    opacity: 0.78,
  },
})
