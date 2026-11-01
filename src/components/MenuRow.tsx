import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import type { CachedMenu } from '@/db/menu'
import { formatPrice } from '@/lib/format'
import type { ProjectedMenu } from '@/lib/outboxPolicy'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface MenuRowProps {
  item: CachedMenu
  projection: ProjectedMenu
  onToggle: (value: boolean) => void
  onEditPrice: () => void
}

export function MenuRow({ item, projection, onToggle, onEditPrice }: MenuRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {projection.pending ? (
            <View style={[styles.syncPill, projection.failed && styles.syncPillFailed]}>
              <Text style={[styles.syncText, projection.failed && styles.syncTextFailed]}>
                {projection.failed ? 'Not synced' : 'Syncing'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.category}>{item.category}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={onEditPrice}
          style={({ pressed }) => [styles.priceButton, pressed && styles.pressed]}
        >
          <Text style={styles.price}>{formatPrice(projection.price)}</Text>
          <Text style={styles.editPrice}>Edit price</Text>
        </Pressable>
      </View>

      <View style={styles.switchBlock}>
        <Switch
          accessibilityLabel={`Availability for ${item.name}`}
          value={projection.isAvailable}
          onValueChange={onToggle}
          trackColor={{ false: colors.surfaceSoft, true: colors.successSoft }}
          thumbColor={projection.isAvailable ? colors.success : colors.textFaint}
          ios_backgroundColor={colors.surfaceSoft}
        />
        <Text style={[styles.availability, { color: projection.isAvailable ? colors.success : colors.danger }]}>
          {projection.isAvailable ? 'In stock' : 'Out of stock'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
  },
  category: {
    ...typography.caption,
    color: colors.textFaint,
  },
  priceButton: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingVertical: spacing.xs,
  },
  price: {
    ...typography.heading,
    color: colors.accent,
  },
  editPrice: {
    ...typography.caption,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  switchBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 90,
  },
  availability: {
    ...typography.caption,
  },
  syncPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.infoSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
  pressed: {
    opacity: 0.7,
  },
})
