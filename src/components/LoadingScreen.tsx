import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/theme/tokens'

export function LoadingScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.mark} />
      <Text style={styles.title}>BB Manager</Text>
      <Text style={styles.subtitle}>Preparing your branch workspace…</Text>
      <ActivityIndicator color={colors.accent} style={styles.spinner} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accent,
    marginBottom: spacing.lg,
    transform: [{ rotate: '12deg' }],
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.xl,
  },
})
