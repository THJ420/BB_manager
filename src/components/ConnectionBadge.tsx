import { StyleSheet, Text, View } from 'react-native'

import { useUiStore, type ConnectionMode } from '@/stores/uiStore'
import { colors, radii, spacing, typography } from '@/theme/tokens'

const labels: Record<ConnectionMode, string> = {
  booting: 'Starting',
  live: 'Live',
  polling: 'Polling',
  offline: 'Offline',
  auth: 'Sign in',
}

const tones: Record<ConnectionMode, string> = {
  booting: colors.textMuted,
  live: colors.success,
  polling: colors.warning,
  offline: colors.danger,
  auth: colors.danger,
}

export function ConnectionBadge() {
  const connection = useUiStore((state) => state.connection)

  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: tones[connection] }]} />
      <Text style={[styles.text, { color: tones[connection] }]}>{labels[connection]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    ...typography.caption,
  },
})
