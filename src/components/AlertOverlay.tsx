import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { itemSummary, formatPrice } from '@/lib/format'
import { formatCountdown, formatTime } from '@/lib/time'
import { useAlerts } from '@/providers/AlertsProvider'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export function AlertOverlay() {
  const { alert, acknowledge, accept } = useAlerts()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  if (!alert) {
    return null
  }

  const order = alert.order

  const viewOrder = () => {
    const orderId = order.id
    void acknowledge().then(() => {
      router.push({ pathname: '/order/[id]', params: { id: orderId } })
    })
  }

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.card,
          {
            paddingTop: Math.max(insets.top, spacing.xl),
            paddingBottom: Math.max(insets.bottom, spacing.xl),
          },
        ]}
      >
        <View style={styles.kickerRow}>
          <View style={styles.pulse} />
          <Text style={styles.kicker}>NEW PICKUP ORDER</Text>
          {alert.count > 1 ? <Text style={styles.count}>+{alert.count - 1} more</Text> : null}
        </View>

        <Text style={styles.customer}>{order.customerName || 'Customer'}</Text>

        <Text style={styles.meta}>
          {formatPrice(order.totalPrice)} · pickup {formatTime(order.pickupTime)} · {formatCountdown(order.pickupTime)}
        </Text>

        <Text style={styles.items}>{itemSummary(order.items)}</Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void accept()}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Accept order</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => void acknowledge()}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Acknowledge</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={viewOrder}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        >
          <Text style={styles.linkText}>View order details</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.danger,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  kicker: {
    ...typography.caption,
    color: colors.danger,
    letterSpacing: 1.4,
    flex: 1,
  },
  count: {
    ...typography.caption,
    color: colors.text,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  customer: {
    ...typography.display,
    color: colors.text,
  },
  meta: {
    ...typography.bodyStrong,
    color: colors.accent,
  },
  items: {
    ...typography.body,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  primary: {
    minHeight: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...typography.heading,
    color: colors.accentText,
  },
  secondary: {
    minHeight: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  linkButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    ...typography.label,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.75,
  },
})
