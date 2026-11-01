import { StyleSheet, Text, View } from 'react-native'

import { ORDER_STATUS_COLOR, ORDER_STATUS_SHORT_LABEL } from '@/lib/orderStatus'
import type { OrderStatus } from '@/types/models'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface StatusPillProps {
  status: OrderStatus
  pending?: boolean
  failed?: boolean
}

export function StatusPill({ status, pending, failed }: StatusPillProps) {
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: ORDER_STATUS_COLOR[status] }]} />
        <Text style={[styles.text, { color: ORDER_STATUS_COLOR[status] }]}>
          {ORDER_STATUS_SHORT_LABEL[status]}
        </Text>
      </View>

      {pending ? (
        <View style={[styles.syncPill, failed && styles.syncPillFailed]}>
          <Text style={[styles.syncText, failed && styles.syncTextFailed]}>
            {failed ? 'Not synced' : 'Syncing'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    ...typography.caption,
    letterSpacing: 0.3,
  },
  syncPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  syncPillFailed: {
    backgroundColor: colors.dangerSoft,
  },
  syncText: {
    ...typography.caption,
    color: colors.info,
  },
  syncTextFailed: {
    color: colors.danger,
  },
})
