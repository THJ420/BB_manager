import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PB_URL } from '@/lib/config'
import { normalizeError } from '@/lib/errors'
import { BranchLinkError } from '@/services/auth'
import { useResponsive } from '@/hooks/useResponsive'
import { useSession } from '@/providers/SessionProvider'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export default function LoginScreen() {
  const { signIn, canContinueOffline, continueOffline, lastError, clearError } = useSession()
  const { isWide } = useResponsive()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(lastError ?? '')

  const submit = async () => {
    if (loading) {
      return
    }

    if (!email.trim() || !password) {
      setError('Enter your employee email and password.')

      return
    }

    setLoading(true)
    setError(null)
    clearError()

    try {
      await signIn(email, password)
    } catch (signInError) {
      if (signInError instanceof BranchLinkError) {
        setError(signInError.message)
      } else {
        const normalized = normalizeError(signInError)
        setError(
          normalized.kind === 'validation'
            ? 'Email or password is incorrect.'
            : normalized.message,
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.shell, isWide && styles.shellWide]}>
            <View style={[styles.brand, isWide && styles.brandWide]}>
              <View style={styles.mark}>
                <View style={styles.markInner} />
              </View>
              <Text style={styles.brandTitle}>BB Manager</Text>
              <Text style={styles.brandSubtitle}>
                Pickup orders, menu and stock for your branch.
              </Text>

              {isWide ? (
                <View style={styles.bullets}>
                  <Text style={styles.bullet}>• Live pickup order alerts</Text>
                  <Text style={styles.bullet}>• Offline queue for unstable Wi-Fi</Text>
                  <Text style={styles.bullet}>• Instant menu price and stock updates</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Staff sign in</Text>
              <Text style={styles.cardSubtitle}>Use the PocketBase account issued for your branch.</Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value)
                  setError(null)
                }}
                placeholder="you@restaurant.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                returnKeyType="next"
                style={styles.input}
                editable={!loading}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value)
                  setError(null)
                }}
                placeholder="Your password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                style={styles.input}
                editable={!loading}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => void submit()}
                disabled={loading}
                style={({ pressed }) => [styles.submit, (pressed || loading) && styles.pressed]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.accentText} />
                ) : (
                  <Text style={styles.submitText}>Sign in</Text>
                )}
              </Pressable>

              {canContinueOffline ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={continueOffline}
                  style={({ pressed }) => [styles.offline, pressed && styles.pressed]}
                >
                  <Text style={styles.offlineText}>Continue offline with cached data</Text>
                </Pressable>
              ) : null}

              <Text style={styles.footer}>{PB_URL}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  shell: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  shellWide: {
    maxWidth: 1040,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.huge,
  },
  brand: {
    gap: spacing.sm,
  },
  brandWide: {
    flex: 1,
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '10deg' }],
    marginBottom: spacing.sm,
  },
  markInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.accentText,
  },
  brandTitle: {
    ...typography.display,
    color: colors.text,
  },
  brandSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 460,
  },
  bullets: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  bullet: {
    ...typography.label,
    color: colors.textMuted,
  },
  card: {
    flex: 1,
    maxWidth: 460,
    width: '100%',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.title,
    color: colors.text,
  },
  cardSubtitle: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    letterSpacing: 0.4,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  error: {
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  submit: {
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  submitText: {
    ...typography.bodyStrong,
    color: colors.accentText,
  },
  offline: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  offlineText: {
    ...typography.label,
    color: colors.info,
    textDecorationLine: 'underline',
  },
  footer: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
})
