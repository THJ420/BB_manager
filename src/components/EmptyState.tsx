import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/theme/tokens'

interface EmptyStateProps {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <View style={styles.markLine} />
        <View style={[styles.markLine, styles.markLineShort]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  markLine: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  markLineShort: {
    width: 18,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 420,
  },
  action: {
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.label,
    color: colors.text,
  },
  pressed: {
    opacity: 0.75,
  },
})
