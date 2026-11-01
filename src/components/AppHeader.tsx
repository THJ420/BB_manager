import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/theme/tokens'

interface AppHeaderProps {
  title: string
  subtitle?: string
  right?: ReactNode
  left?: ReactNode
  onBack?: () => void
}

export function AppHeader({ title, subtitle, right, left, onBack }: AppHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      ) : null}

      {left}

      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>

      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -4,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.label,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
})
