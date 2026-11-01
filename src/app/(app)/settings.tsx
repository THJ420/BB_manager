import Constants from 'expo-constants'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { PB_URL } from '@/lib/config'
import { initials } from '@/lib/format'
import { formatRelativeTimestamp } from '@/lib/time'
import { AppHeader } from '@/components/AppHeader'
import { ConnectionBadge } from '@/components/ConnectionBadge'
import { Screen } from '@/components/Screen'
import { useAlerts } from '@/providers/AlertsProvider'
import { useOutbox } from '@/providers/OutboxProvider'
import { useSession } from '@/providers/SessionProvider'
import { useSync } from '@/providers/SyncProvider'
import { useToast } from '@/providers/ToastProvider'
import { useSyncStore } from '@/stores/syncStore'
import { colors, radii, spacing, typography } from '@/theme/tokens'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'danger' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[
        styles.rowValue,
        accent === 'success' && { color: colors.success },
        accent === 'danger' && { color: colors.danger },
      ]}>
        {value}
      </Text>
    </View>
  )
}

export default function SettingsScreen() {
  const { staff, branch, signOut } = useSession()
  const { refreshing, refresh, lastSyncAt } = useSync()
  const { flushing, retryNow } = useOutbox()
  const { testSiren } = useAlerts()
  const { showToast } = useToast()
  const outbox = useSyncStore((state) => state.outbox)

  const failedCount = outbox.filter((row) => row.state === 'failed' || row.state === 'needs_auth').length
  const queuedCount = outbox.length
  const version = Constants.expoConfig?.version ?? '1.0.0'

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out?',
      queuedCount > 0
        ? `${queuedCount} queued change(s) will be discarded. Cached orders and menu data will be removed from this device.`
        : 'Cached orders and menu data will be removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    )
  }

  const handleRetry = async () => {
    await retryNow()
    showToast('Retrying queued changes…', 'info')
  }

  return (
    <Screen>
      <AppHeader title="Settings" subtitle="Branch workspace and sync health" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(staff?.name, staff?.email)}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{staff?.name || 'Staff member'}</Text>
            <Text style={styles.email}>{staff?.email}</Text>
            <Text style={styles.role}>{(staff?.role ?? 'staff').toUpperCase()}</Text>
          </View>
        </View>

        <Section title="BRANCH">
          <Row label="Name" value={branch?.name ?? 'Unknown'} />
          <Row label="Slug" value={branch?.slug || '—'} />
          <Row
            label="Accepting orders"
            value={branch?.is_accepting_orders === false ? 'Paused' : 'Yes'}
            accent={branch?.is_accepting_orders === false ? 'danger' : 'success'}
          />
          <Row label="Pickup delay" value={`${branch?.pickup_delay_minutes ?? 0} min`} />
          <Row label="Branch ID" value={branch?.id ?? '—'} />
        </Section>

        <Section title="SYNC">
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Connection</Text>
            <ConnectionBadge />
          </View>
          <Row
            label="Last full sync"
            value={lastSyncAt ? formatRelativeTimestamp(new Date(lastSyncAt).toISOString()) : 'never'}
          />
          <Row label="Queued changes" value={String(queuedCount)} accent={queuedCount > 0 ? 'danger' : 'success'} />
          <Row label="Needs attention" value={String(failedCount)} accent={failedCount > 0 ? 'danger' : undefined} />

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              disabled={refreshing}
              style={({ pressed }) => [styles.button, (pressed || refreshing) && styles.pressed]}
            >
              <Text style={styles.buttonText}>{refreshing ? 'Syncing…' : 'Sync now'}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleRetry()}
              disabled={flushing || queuedCount === 0}
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                (pressed || flushing || queuedCount === 0) && styles.pressed,
              ]}
            >
              <Text style={styles.buttonText}>{flushing ? 'Sending…' : 'Retry queued'}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title="ALERTS">
          <Text style={styles.helper}>
            New orders trigger a looping siren, a full-screen alert and an Android notification while the app is running.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void testSiren()
              showToast('Playing the test siren.', 'info')
            }}
            style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Test siren</Text>
          </Pressable>
          <Text style={styles.helper}>
            Keep this device on the Orders tab at the counter. Android may pause background connections.
          </Text>
        </Section>

        <Section title="QUEUED CHANGES">
          {outbox.length === 0 ? (
            <Text style={styles.helper}>Nothing queued. All changes are synced.</Text>
          ) : (
            outbox.slice(0, 8).map((row) => (
              <View key={row.id} style={styles.queueRow}>
                <View style={styles.queueMain}>
                  <Text style={styles.queueTitle}>
                    {row.kind === 'order_status' ? 'Order status' : 'Menu update'} · {row.entityId.slice(-6).toUpperCase()}
                  </Text>
                  {row.lastError ? <Text style={styles.queueError}>{row.lastError}</Text> : null}
                </View>
                <Text style={[
                  styles.queueState,
                  (row.state === 'failed' || row.state === 'needs_auth') && styles.queueStateFailed,
                ]}>
                  {row.state.replace('_', ' ')}
                </Text>
              </View>
            ))
          )}
          {outbox.length > 8 ? <Text style={styles.helper}>+{outbox.length - 8} more…</Text> : null}
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>BB Manager {version}</Text>
          <Text style={styles.footerText}>PocketBase: {PB_URL}</Text>
          <Text style={styles.footerText}>Branch-scoped employee app</Text>
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.heading,
    color: colors.accentText,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.heading,
    color: colors.text,
  },
  email: {
    ...typography.label,
    color: colors.textMuted,
  },
  role: {
    ...typography.caption,
    color: colors.accent,
    letterSpacing: 1,
    marginTop: 2,
  },
  section: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textFaint,
    letterSpacing: 1.2,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.bodyStrong,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    flexGrow: 1,
    minHeight: 48,
    minWidth: 130,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  buttonText: {
    ...typography.label,
    color: colors.text,
  },
  helper: {
    ...typography.label,
    color: colors.textMuted,
    lineHeight: 20,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  queueMain: {
    flex: 1,
    gap: 2,
  },
  queueTitle: {
    ...typography.label,
    color: colors.text,
  },
  queueError: {
    ...typography.caption,
    color: colors.danger,
  },
  queueState: {
    ...typography.caption,
    color: colors.info,
    textTransform: 'capitalize',
  },
  queueStateFailed: {
    color: colors.danger,
  },
  signOut: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    ...typography.bodyStrong,
    color: colors.danger,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
})
