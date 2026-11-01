import { Pressable, StyleSheet, Text, View } from 'react-native'

import { nextActions, type StatusActionTone } from '@/lib/orderStatus'
import type { OrderStatus } from '@/types/models'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface StatusActionsProps {
  status: OrderStatus
  busy?: boolean
  onAction: (target: OrderStatus) => void
}

const toneStyles: Record<StatusActionTone, { background: string; border: string; text: string }> = {
  primary: {
    background: colors.accent,
    border: colors.accent,
    text: colors.accentText,
  },
  success: {
    background: colors.success,
    border: colors.success,
    text: '#04140A',
  },
  danger: {
    background: colors.dangerSoft,
    border: colors.danger,
    text: colors.danger,
  },
  neutral: {
    background: colors.surfaceRaised,
    border: colors.borderStrong,
    text: colors.text,
  },
}

export function StatusActions({ status, busy, onAction }: StatusActionsProps) {
  const actions = nextActions(status)

  if (actions.length === 0) {
    return (
      <View style={styles.done}>
        <Text style={styles.doneText}>This order is closed. No further actions.</Text>
      </View>
    )
  }

  return (
    <View style={styles.actions}>
      {actions.map((action) => {
        const tone = toneStyles[action.tone]

        return (
          <Pressable
            key={action.status}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onAction(action.status)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: tone.background, borderColor: tone.border },
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: tone.text }]}>
              {busy ? 'Saving…' : action.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  button: {
    minHeight: 56,
    minWidth: 150,
    flexGrow: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    ...typography.bodyStrong,
  },
  pressed: {
    opacity: 0.7,
  },
  done: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  doneText: {
    ...typography.label,
    color: colors.textMuted,
  },
})
