import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMemo } from 'react'

import type { CachedOrder } from '@/db/orders'
import { formatPrice } from '@/lib/format'
import { useMenuStore } from '@/stores/menuStore'
import { formatCountdown, formatPickupDay, formatTime } from '@/lib/time'
import type { OrderItem, OrderStatus } from '@/types/models'
import { StatusActions } from '@/components/StatusActions'
import { StatusPill } from '@/components/StatusPill'
import { useOrderActions } from '@/hooks/useOrderActions'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface OrderDetailProps {
  order: CachedOrder
  status: OrderStatus
  pending: boolean
  failed: boolean
}

function itemLine(item: OrderItem): string | null {
  if (typeof item.line_total === 'number') {
    return formatPrice(item.line_total)
  }

  if (typeof item.unit_price === 'number') {
    return formatPrice(item.unit_price * item.quantity)
  }

  return null
}

export function OrderDetail({ order, status, pending, failed }: OrderDetailProps) {
  const menu = useMenuStore((state) => state.menu)
  const { busy, setStatus } = useOrderActions()

  const menuNames = useMemo(
    () => Object.fromEntries(menu.map((item) => [item.id, item.name])),
    [menu],
  )

  const callCustomer = () => {
    const phone = order.customerPhone.trim()

    if (phone) {
      void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <StatusPill status={status} pending={pending} failed={failed} />
        <Text style={styles.orderRef}>#{order.id.slice(-6).toUpperCase()}</Text>
      </View>

      {failed ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>This change is not synced yet</Text>
          <Text style={styles.errorText}>
            Open Settings to retry, or pull to refresh after the connection returns.
          </Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.customer}>{order.customerName || 'Customer'}</Text>
        {order.customerPhone ? (
          <Pressable
            accessibilityRole="button"
            onPress={callCustomer}
            style={({ pressed }) => [styles.phone, pressed && styles.pressed]}
          >
            <Text style={styles.phoneText}>{order.customerPhone}</Text>
            <Text style={styles.callLabel}>Call</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pickupCard}>
        <View>
          <Text style={styles.sectionLabel}>PICKUP</Text>
          <Text style={styles.pickupTime}>{formatTime(order.pickupTime)}</Text>
          <Text style={styles.pickupDay}>{formatPickupDay(order.pickupTime)}</Text>
        </View>
        <View style={styles.countdownBox}>
          <Text style={styles.sectionLabel}>IN</Text>
          <Text style={styles.countdown}>{formatCountdown(order.pickupTime)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ITEMS</Text>

        {order.items.length === 0 ? (
          <Text style={styles.muted}>No item details were included in this order.</Text>
        ) : (
          order.items.map((item, index) => {
            const name = item.name
              || (item.menu_id ? menuNames[String(item.menu_id)] : undefined)
              || `Item #${item.menu_id ?? '?'}`
            const line = itemLine(item)

            return (
              <View key={`${order.id}-${index}`} style={styles.itemRow}>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantity}>{item.quantity}×</Text>
                </View>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName}>{name}</Text>
                  {item.options && item.options.length > 0 ? (
                    <Text style={styles.itemOptions}>{item.options.join(' · ')}</Text>
                  ) : null}
                </View>
                <Text style={styles.itemPrice}>{line ?? '—'}</Text>
              </View>
            )
          })
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatPrice(order.totalPrice)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
        <StatusActions status={status} busy={busy} onAction={(target) => void setStatus(order, target)} />
      </View>

      <Text style={styles.footerNote}>
        Source: {order.sourceWebsite || 'pickup order'} · Updated {formatTime(order.updated)}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderRef: {
    ...typography.caption,
    color: colors.textFaint,
    letterSpacing: 1,
  },
  errorBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    gap: 4,
  },
  errorTitle: {
    ...typography.bodyStrong,
    color: colors.danger,
  },
  errorText: {
    ...typography.label,
    color: colors.textMuted,
  },
  hero: {
    gap: spacing.sm,
  },
  customer: {
    ...typography.display,
    color: colors.text,
  },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  phoneText: {
    ...typography.body,
    color: colors.info,
  },
  callLabel: {
    ...typography.caption,
    color: colors.info,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  section: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textFaint,
    letterSpacing: 1.2,
  },
  pickupTime: {
    ...typography.title,
    color: colors.text,
  },
  pickupDay: {
    ...typography.label,
    color: colors.textMuted,
  },
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdown: {
    ...typography.heading,
    color: colors.accent,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quantityBox: {
    minWidth: 38,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
  },
  quantity: {
    ...typography.label,
    color: colors.text,
  },
  itemMain: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  itemOptions: {
    ...typography.caption,
    color: colors.textMuted,
  },
  itemPrice: {
    ...typography.label,
    color: colors.text,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyStrong,
    color: colors.textMuted,
  },
  total: {
    ...typography.title,
    color: colors.accent,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textFaint,
  },
  pressed: {
    opacity: 0.7,
  },
})
