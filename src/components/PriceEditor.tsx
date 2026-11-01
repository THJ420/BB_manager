import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { describeError } from '@/lib/errors'
import { formatPrice, parsePriceInput } from '@/lib/format'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface PriceEditorProps {
  visible: boolean
  itemName: string
  currentPrice: number
  onCancel: () => void
  onSave: (price: number) => Promise<void>
}

export function PriceEditor({ visible, itemName, currentPrice, onCancel, onSave }: PriceEditorProps) {
  const [value, setValue] = useState(() => String(currentPrice).replace('.', ','))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const parsed = parsePriceInput(value)

    if (parsed === null) {
      setError('Enter a valid price between 0 and 999 999,99.')

      return
    }

    setSaving(true)
    setError(null)

    try {
      await onSave(parsed)
    } catch (saveError) {
      setError(describeError(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.kicker}>UPDATE PRICE</Text>
          <Text style={styles.title} numberOfLines={2}>{itemName}</Text>
          <Text style={styles.current}>Current price: {formatPrice(currentPrice)}</Text>

          <View style={styles.inputRow}>
            <TextInput
              value={value}
              onChangeText={(next) => {
                setValue(next)
                setError(null)
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
              autoFocus
              placeholder="0,00"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
            <Text style={styles.currency}>zł</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={saving}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void submit()}
              disabled={saving}
              style={({ pressed }) => [styles.save, pressed && styles.pressed]}
            >
              {saving ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={styles.saveText}>Save price</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  kicker: {
    ...typography.caption,
    color: colors.textFaint,
    letterSpacing: 1.2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  current: {
    ...typography.label,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 56,
    color: colors.text,
    ...typography.title,
  },
  currency: {
    ...typography.heading,
    color: colors.textMuted,
  },
  error: {
    ...typography.label,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancel: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  save: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    ...typography.bodyStrong,
    color: colors.accentText,
  },
  pressed: {
    opacity: 0.75,
  },
})
