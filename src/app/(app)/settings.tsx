import { Redirect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { AlertTonePickerModal } from '../../components/AlertTonePickerModal';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { DialogModal } from '../../components/DialogModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SectionCard } from '../../components/SectionCard';
import { SwitchRow } from '../../components/SwitchRow';
import { TextField } from '../../components/TextField';
import { WeeklyHoursModal } from '../../components/WeeklyHoursModal';
import { BRANCHES } from '../../constants/branches';
import { NOTIFICATION_EVENT_CATEGORIES } from '../../constants/notificationEvents';
import { getAlertTone } from '../../lib/alertTones';
import { storeHoursSummary } from '../../lib/domain';
import { initials, roleLabel } from '../../lib/format';
import { useApp } from '../../state/AppProvider';
import type { SyncDiagnosticsReport } from '../../state/AppProvider';
import { Colors, Radius, Spacing } from '../../theme/colors';
import {
  AlertToneId,
  Branch,
  ConnectionStatus,
  NotificationRoute,
  NotificationSettings,
  SmtpEncryption,
  SmtpSettings,
  StaffRole,
  TerminalSettings,
} from '../../types';

const CONNECTION_MODES: Array<{ id: ConnectionStatus; label: string }> = [
  { id: 'live', label: 'ONLINE' },
  { id: 'polling', label: 'SYNCING' },
  { id: 'offline', label: 'OFFLINE' },
];

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'OWNER',
  manager: 'MANAGER',
  kitchen_lead: 'KITCHEN LEAD',
  floor_staff: 'FLOOR STAFF',
};

const STAFF_ROLES: StaffRole[] = ['floor_staff', 'kitchen_lead', 'manager'];

export default function TerminalSettingsScreen() {
  const router = useRouter();
  const {
    state,
    isLiveBackend,
    logout,
    toggleStoreOpen,
    setSlotInterval,
    updateWeeklySchedule,
    saveTerminalSettings,
    syncOutboxNow,
    clearOutbox,
    runSyncDiagnostics,
    setConnectionStatus,
    setBranch,
  } = useApp();

  const [draft, setDraft] = useState<TerminalSettings>(state.settings);
  const [weeklyVisible, setWeeklyVisible] = useState(false);
  const [tonePickerVisible, setTonePickerVisible] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SyncDiagnosticsReport | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [clearQueueVisible, setClearQueueVisible] = useState(false);

  const [recipientInput, setRecipientInput] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('floor_staff');
  const [staffError, setStaffError] = useState<string | null>(null);

  const [activeRouteCategoryId, setActiveRouteCategoryId] = useState(
    NOTIFICATION_EVENT_CATEGORIES[0]?.id ?? 'orders'
  );
  const [routeInputs, setRouteInputs] = useState<Record<string, string>>({});
  const [feeInputs, setFeeInputs] = useState(() => ({
    takeout: String(state.settings.fees.takeout),
    packaging: String(state.settings.fees.packaging),
    deliveryPerKm: String(state.settings.fees.deliveryPerKm),
  }));

  useEffect(() => {
    setDraft(state.settings);
    setFeeInputs({
      takeout: String(state.settings.fees.takeout),
      packaging: String(state.settings.fees.packaging),
      deliveryPerKm: String(state.settings.fees.deliveryPerKm),
    });
  }, [state.settings]);

  const session = state.session;
  const storeOpen = state.storeConfig.isOpenForOrders;
  const pendingCount = state.outbox.length;

  const updateSmtp = (patch: Partial<SmtpSettings>) => {
    setDraft((current) => ({ ...current, smtp: { ...current.smtp, ...patch } }));
  };

  const updateNotifications = (patch: Partial<NotificationSettings>) => {
    setDraft((current) => ({
      ...current,
      notifications: { ...current.notifications, ...patch },
    }));
  };

  const persistSoundSettings = (patch: {
    alertToneId?: AlertToneId;
    soundAlertsEnabled?: boolean;
  }) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void saveTerminalSettings(next);
  };

  const selectedTone = getAlertTone(draft.alertToneId);

  const activeRouteCategory =
    NOTIFICATION_EVENT_CATEGORIES.find((entry) => entry.id === activeRouteCategoryId) ??
    NOTIFICATION_EVENT_CATEGORIES[0];

  const activeRouteCount = NOTIFICATION_EVENT_CATEGORIES.reduce(
    (total, category) =>
      total +
      category.events.filter((event) => draft.notificationRoutes[event.key]?.enabled).length,
    0
  );

  const updateDelivery = (
    key: keyof TerminalSettings['deliveryUrls'],
    value: string
  ) => {
    setDraft((current) => ({
      ...current,
      deliveryUrls: { ...current.deliveryUrls, [key]: value },
    }));
  };

  const addRecipient = () => {
    const value = recipientInput.trim();
    if (!value) return;
    if (draft.notifications.recipients.includes(value)) {
      setRecipientInput('');
      return;
    }
    updateNotifications({
      recipients: [...draft.notifications.recipients, value],
    });
    setRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    updateNotifications({
      recipients: draft.notifications.recipients.filter((entry) => entry !== email),
    });
  };

  const addStaffMember = () => {
    if (!newStaffName.trim() || !newStaffEmail.trim()) {
      setStaffError('Provide a staff name and email address.');
      return;
    }
    setDraft((current) => ({
      ...current,
      staff: [
        ...current.staff,
        {
          id: `staff_${Date.now()}`,
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          role: newStaffRole,
        },
      ],
    }));
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffPassword('');
    setStaffError(null);
  };

  const removeStaffMember = (staffId: string) => {
    if (draft.staff.length <= 1) return;
    setDraft((current) => ({
      ...current,
      staff: current.staff.filter((member) => member.id !== staffId),
    }));
  };

  const handleBranchSwitch = async (branch: Branch) => {
    await setBranch(branch);
  };

  const updateContact = (patch: Partial<TerminalSettings['contact']>) => {
    setDraft((current) => ({ ...current, contact: { ...current.contact, ...patch } }));
  };

  const updateSocial = (patch: Partial<TerminalSettings['social']>) => {
    setDraft((current) => ({ ...current, social: { ...current.social, ...patch } }));
  };

  const updateFee = (key: keyof TerminalSettings['fees'], raw: string) => {
    // Keep the raw text so a trailing dot or comma survives editing; the
    // numeric value only reaches the draft when it parses.
    setFeeInputs((current) => ({ ...current, [key]: raw }));
    const parsed = Number(raw.replace(',', '.'));
    setDraft((current) => ({
      ...current,
      fees: { ...current.fees, [key]: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 },
    }));
  };

  const routeFor = (key: string): NotificationRoute =>
    draft.notificationRoutes[key] ?? { enabled: false, recipients: [] };

  const updateRoute = (key: string, patch: Partial<NotificationRoute>) => {
    setDraft((current) => ({
      ...current,
      notificationRoutes: {
        ...current.notificationRoutes,
        [key]: { ...(current.notificationRoutes[key] ?? { enabled: false, recipients: [] }), ...patch },
      },
    }));
  };

  const addRouteRecipient = (key: string) => {
    const value = (routeInputs[key] ?? '').trim();
    if (!value) return;
    const current = routeFor(key);
    setRouteInputs((inputs) => ({ ...inputs, [key]: '' }));
    if (current.recipients.includes(value)) return;
    updateRoute(key, { enabled: true, recipients: [...current.recipients, value] });
  };

  const removeRouteRecipient = (key: string, email: string) => {
    updateRoute(key, { recipients: routeFor(key).recipients.filter((entry) => entry !== email) });
  };

  const setCategoryEnabled = (categoryId: string, enabled: boolean) => {
    const category = NOTIFICATION_EVENT_CATEGORIES.find((entry) => entry.id === categoryId);
    if (!category) return;
    setDraft((current) => {
      const next = { ...current.notificationRoutes };
      for (const event of category.events) {
        next[event.key] = {
          ...(next[event.key] ?? { enabled: false, recipients: [] }),
          enabled,
        };
      }
      return { ...current, notificationRoutes: next };
    });
  };

  const handleSave = async () => {
    await saveTerminalSettings({
      ...draft,
      branchName: draft.branchName.trim() || state.activeBranch.name,
    });
    setSavedVisible(true);
  };

  const handleSync = async () => {
    if (pendingCount === 0 || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOutboxNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = async () => {
    setClearQueueVisible(false);
    await clearOutbox();
  };

  const handleDiagnostics = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      setDiagnostics(await runSyncDiagnostics());
      setDiagnosticsVisible(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const outboxTone = useMemo(
    () => (pendingCount > 0 ? Colors.warning : Colors.success),
    [pendingCount]
  );

  // Branch settings require a branch; the owner console is aggregate-only.
  if (state.session?.role === 'owner') {
    return <Redirect href="/(app)/analytics" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Terminal Settings"
        subtitle={`${state.activeBranch.name} • ${state.activeBranch.code}`}
        right={
          <ConnectionBadge status={state.connection} pendingOutboxCount={pendingCount} />
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionCard title="STAFF SESSION">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(session?.name ?? 'BB')}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.userName}>{session?.name ?? 'Alex Vance'}</Text>
              <Text style={styles.userRole}>
                {session ? roleLabel(session.role) : 'Store Operations Lead'}
              </Text>
              <Text style={styles.userEmail}>
                {session?.email ?? 'manager@bbmanager.internal'}
              </Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard
          title="STORE OPERATIONS & WORKING HOURS"
          tone={storeOpen ? 'default' : 'danger'}
          right={
            <View
              style={[
                styles.statusPill,
                { backgroundColor: storeOpen ? Colors.successMuted : Colors.errorMuted },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: storeOpen ? Colors.success : Colors.error },
                ]}
              >
                {storeOpen ? 'OPEN FOR ORDERS' : 'SHOP CLOSED'}
              </Text>
            </View>
          }
        >
          <Text style={styles.bodyText}>
            Control real-time availability across the web checkout and pickup portals. Turning
            store operations off immediately suspends incoming online pickups and table bookings.
          </Text>

          <View style={styles.masterBox}>
            <SwitchRow
              title="Master Order Reception Switch"
              subtitle={
                storeOpen
                  ? 'Accepting digital pickups and bookings'
                  : 'Emergency pause: web orders disabled'
              }
              value={storeOpen}
              onValueChange={(value) => void toggleStoreOpen(value)}
              activeColor={Colors.success}
              activeMuted={Colors.successMuted}
              inactiveColor={Colors.error}
              inactiveMuted={Colors.errorMuted}
              testID="master_reception_switch"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.subLabel}>DAILY OPERATING SCHEDULE</Text>
          <ActionButton
            label="🗓️  Manage Weekly Operating Hours"
            variant="primary"
            fullWidth
            onPress={() => setWeeklyVisible(true)}
            testID="btn_manage_weekly_hours"
          />
          <Text style={styles.hintText}>{storeHoursSummary(state.storeConfig)}</Text>

          <Text style={styles.subLabel}>PICKUP SLOT INTERVALS</Text>
          <View style={styles.slotRow}>
            {[15, 30, 45, 60].map((minutes) => {
              const selected = state.storeConfig.slotIntervalMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => void setSlotInterval(minutes)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.slotChip,
                    selected ? styles.slotChipSelected : styles.slotChipIdle,
                  ]}
                >
                  <Text style={[styles.slotText, selected && styles.slotTextSelected]}>
                    {minutes}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard title="SYNC & DATA HEALTH">
          <Text style={styles.rowTitle}>Connection Protocol</Text>
          <View style={styles.segmentTrack}>
            {CONNECTION_MODES.map((mode) => {
              const selected = state.connection === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => setConnectionStatus(mode.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text
                    style={[styles.segmentText, selected && styles.segmentTextSelected]}
                    numberOfLines={1}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <View style={styles.outboxRow}>
            <View style={styles.outboxText}>
              <Text style={styles.rowTitle}>Offline Outbox Queue</Text>
              <Text style={[styles.rowSubtitle, { color: outboxTone }]}>
                {pendingCount === 0
                  ? 'All actions synced to the cloud'
                  : `${pendingCount} pending mutations`}
              </Text>
            </View>
            <ActionButton
              label={isSyncing ? 'SYNCING…' : 'SYNC NOW'}
              variant="warning"
              disabled={pendingCount === 0 || isSyncing}
              onPress={() => void handleSync()}
              testID="btn_sync_outbox"
            />
          </View>

          <ActionButton
            label="RUN SYNC DIAGNOSTICS"
            variant="outline"
            compact
            disabled={isSyncing}
            onPress={() => void handleDiagnostics()}
            testID="btn_sync_diagnostics"
            style={styles.diagnosticsButton}
          />
          <Text style={styles.rowSubtitle}>
            Force-flushes the queue and prints the failure details to the console.
          </Text>

          <ActionButton
            label="CLEAR STUCK QUEUE"
            variant="danger"
            compact
            onPress={() => setClearQueueVisible(true)}
            testID="btn_clear_outbox"
            style={styles.diagnosticsButton}
          />
          <Text style={styles.rowSubtitle}>
            Deletes every pending local mutation and reconnects immediately. Use it when
            a deleted record keeps the queue jammed.
          </Text>

          <View style={styles.divider} />

          <SwitchRow
            title="Audible New Ticket Chime"
            subtitle={
              draft.soundAlertsEnabled
                ? `Plays “${selectedTone.label}” for incoming tickets`
                : 'Muted: incoming orders stay silent'
            }
            value={draft.soundAlertsEnabled}
            onValueChange={(enabled) => persistSoundSettings({ soundAlertsEnabled: enabled })}
            activeColor={Colors.primary}
            activeMuted={Colors.primaryMuted}
            inactiveColor={Colors.textSecondary}
            testID="sound_alerts_switch"
          />

          <View style={styles.divider} />

          <View style={styles.alertToneRow}>
            <View style={styles.alertToneText}>
              <Text style={styles.rowTitle}>Order Alert Tone</Text>
              <Text style={styles.rowSubtitle}>
                {selectedTone.label} • {selectedTone.description}
              </Text>
            </View>
            <ActionButton
              label="CHOOSE"
              variant="subtle"
              compact
              onPress={() => setTonePickerVisible(true)}
              testID="btn_choose_alert_tone"
            />
          </View>
          <Text style={styles.hintText}>
            Preview any preset in the picker. The selected tone saves immediately for this
            terminal.
          </Text>
        </SectionCard>

        <SectionCard title="SMTP EMAIL CONFIGURATION">
          <Text style={styles.bodyText}>
            Placeholders for the outgoing mail server used by dispatch receipts, customer
            notifications and kitchen incident reports.
          </Text>

          <TextField
            label="SMTP Host"
            value={draft.smtp.host}
            onChangeText={(host) => updateSmtp({ host })}
            placeholder="smtp.mailgun.org"
            autoCapitalize="none"
            testID="settings_smtp_host"
          />

          <View style={styles.fieldRow}>
            <TextField
              label="Port"
              value={draft.smtp.port}
              onChangeText={(port) => updateSmtp({ port: port.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              placeholder="587"
              style={styles.portField}
            />
            <View style={styles.encryptionGroup}>
              <Text style={styles.subLabel}>Encryption</Text>
              <View style={styles.encryptionRow}>
                {(['TLS', 'SSL', 'STARTTLS'] as SmtpEncryption[]).map((encryption) => {
                  const selected = draft.smtp.encryption === encryption;
                  return (
                    <Pressable
                      key={encryption}
                      onPress={() => updateSmtp({ encryption })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.encryptionChip,
                        selected ? styles.encryptionChipSelected : styles.encryptionChipIdle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.encryptionText,
                          selected && styles.encryptionTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {encryption}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <TextField
            label="Username"
            value={draft.smtp.username}
            onChangeText={(username) => updateSmtp({ username })}
            autoCapitalize="none"
            placeholder="postmaster@bbmanager.com"
          />

          <TextField
            label="Password"
            value={draft.smtp.password}
            onChangeText={(password) => updateSmtp({ password })}
            secureTextEntry
            autoCapitalize="none"
            placeholder="••••••••••••"
          />

          <View style={styles.fieldRow}>
            <TextField
              label="From Email"
              value={draft.smtp.fromEmail}
              onChangeText={(fromEmail) => updateSmtp({ fromEmail })}
              autoCapitalize="none"
              style={styles.halfField}
            />
            <TextField
              label="From Name"
              value={draft.smtp.fromName}
              onChangeText={(fromName) => updateSmtp({ fromName })}
              style={styles.halfField}
            />
          </View>
        </SectionCard>

        <SectionCard title="NOTIFICATIONS">
          <SwitchRow
            title="Automated Dispatch Notifications"
            subtitle={
              draft.notifications.active
                ? 'Active: dispatching order tickets and shift alerts'
                : 'Suspended: no alerts dispatched'
            }
            value={draft.notifications.active}
            onValueChange={(active) => updateNotifications({ active })}
            activeColor={Colors.success}
            activeMuted={Colors.successMuted}
            inactiveColor={Colors.error}
            inactiveMuted={Colors.errorMuted}
          />

          <View style={styles.divider} />

          <Text style={styles.subLabel}>NOTIFICATION RECIPIENT LIST</Text>
          <Text style={styles.bodyText}>
            Email addresses receiving automated ticket summaries and floor incident webhooks.
          </Text>

          {draft.notifications.recipients.map((email) => (
            <View key={email} style={styles.recipientRow}>
              <Text style={styles.recipientText} numberOfLines={1}>
                ✉️ {email}
              </Text>
              <Pressable
                onPress={() => removeRecipient(email)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${email}`}
                style={styles.removeTouch}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.addRow}>
            <TextField
              value={recipientInput}
              onChangeText={setRecipientInput}
              placeholder="lead.chef@bbmanager.internal"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.addField}
            />
            <ActionButton label="+ Add Tag" variant="primary" compact onPress={addRecipient} />
          </View>
        </SectionCard>

        <SectionCard
          title="NOTIFICATION ROUTING"
          right={<Text style={styles.routeBadge}>{activeRouteCount}/30 ACTIVE</Text>}
        >
          <Text style={styles.bodyText}>
            Every website event can be switched on independently and sent to its own inboxes.
            Saving here pushes straight to the storefront — no deploy needed.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {NOTIFICATION_EVENT_CATEGORIES.map((category) => {
              const selected = category.id === activeRouteCategoryId;
              const enabled = category.events.filter(
                (event) => draft.notificationRoutes[event.key]?.enabled
              ).length;

              return (
                <Pressable
                  key={category.id}
                  onPress={() => setActiveRouteCategoryId(category.id)}
                  style={[styles.chip, selected && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${category.title}, ${enabled} of ${category.events.length} active`}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                    {category.title}
                  </Text>
                  <Text style={[styles.chipCount, selected && styles.chipCountActive]}>
                    {enabled}/{category.events.length}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHint}>{activeRouteCategory.hint}</Text>
            <View style={styles.categoryActions}>
              <Pressable
                onPress={() => setCategoryEnabled(activeRouteCategory.id, true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Enable every event in this category"
              >
                <Text style={styles.categoryAction}>ENABLE ALL</Text>
              </Pressable>
              <Pressable
                onPress={() => setCategoryEnabled(activeRouteCategory.id, false)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Disable every event in this category"
              >
                <Text style={[styles.categoryAction, styles.categoryActionMuted]}>CLEAR</Text>
              </Pressable>
            </View>
          </View>

          {activeRouteCategory.events.map((event) => {
            const route = routeFor(event.key);

            return (
              <View key={event.key} style={styles.eventBlock}>
                <SwitchRow
                  title={event.label}
                  subtitle={event.description}
                  value={route.enabled}
                  onValueChange={(enabled) => updateRoute(event.key, { enabled })}
                  activeColor={Colors.success}
                  activeMuted={Colors.successMuted}
                  inactiveColor={Colors.switchThumbOff}
                  inactiveMuted={Colors.switchTrackOff}
                />

                {route.enabled ? (
                  <View style={styles.routeBody}>
                    {route.recipients.length === 0 ? (
                      <Text style={styles.routeEmpty}>
                        No recipients yet — this event will not send until you add one.
                      </Text>
                    ) : (
                      route.recipients.map((email) => (
                        <View key={email} style={styles.recipientRow}>
                          <Text style={styles.recipientText} numberOfLines={1}>
                            ✉️ {email}
                          </Text>
                          <Pressable
                            onPress={() => removeRouteRecipient(event.key, email)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${email} from ${event.label}`}
                            style={styles.removeTouch}
                          >
                            <Text style={styles.removeText}>✕</Text>
                          </Pressable>
                        </View>
                      ))
                    )}

                    <View style={styles.addRow}>
                      <TextField
                        value={routeInputs[event.key] ?? ''}
                        onChangeText={(value) =>
                          setRouteInputs((inputs) => ({ ...inputs, [event.key]: value }))
                        }
                        placeholder="kitchen@restaurant.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.addField}
                      />
                      <ActionButton
                        label="+ Add"
                        variant="primary"
                        compact
                        onPress={() => addRouteRecipient(event.key)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </SectionCard>

        <SectionCard title="DELIVERY PLATFORMS & STOREFRONT URLS">
          <Text style={styles.bodyText}>
            Manage the integration endpoints and storefront links for third-party courier
            channels.
          </Text>

          <TextField
            label="🛵 Wolt Food Storefront URL"
            value={draft.deliveryUrls.wolt}
            onChangeText={(wolt) => updateDelivery('wolt', wolt)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="🌐 Direct Web Ordering Portal URL"
            value={draft.deliveryUrls.web}
            onChangeText={(web) => updateDelivery('web', web)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="📦 Glovo Storefront URL"
            value={draft.deliveryUrls.glovo}
            onChangeText={(glovo) => updateDelivery('glovo', glovo)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="🍽️ Pyszne.pl Storefront URL"
            value={draft.deliveryUrls.pyszne}
            onChangeText={(pyszne) => updateDelivery('pyszne', pyszne)}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="🚗 Uber Eats Storefront URL"
            value={draft.deliveryUrls.uberEats}
            onChangeText={(uberEats) => updateDelivery('uberEats', uberEats)}
            autoCapitalize="none"
            keyboardType="url"
          />
        </SectionCard>

        <SectionCard title="STOREFRONT CONTACT & SOCIAL">
          <Text style={styles.bodyText}>
            Published in the website footer and on every customer email. Leave a field empty to
            hide that line on the storefront.
          </Text>

          <Text style={styles.subLabel}>LOCATION</Text>
          <TextField
            label="Address line 1"
            value={draft.contact.addressLine1}
            onChangeText={(addressLine1) => updateContact({ addressLine1 })}
          />
          <TextField
            label="Address line 2"
            value={draft.contact.addressLine2}
            onChangeText={(addressLine2) => updateContact({ addressLine2 })}
          />

          <View style={styles.divider} />

          <Text style={styles.subLabel}>REACHABILITY</Text>
          <TextField
            label="📞 Phone"
            value={draft.contact.phone}
            onChangeText={(phone) => updateContact({ phone })}
            keyboardType="phone-pad"
          />
          <TextField
            label="✉️ Contact email"
            value={draft.contact.email}
            onChangeText={(email) => updateContact({ email })}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={styles.divider} />

          <Text style={styles.subLabel}>SOCIAL PROFILES</Text>
          <TextField
            label="Facebook handle"
            value={draft.social.facebookHandle}
            onChangeText={(facebookHandle) => updateSocial({ facebookHandle })}
            placeholder="@restaurant"
            autoCapitalize="none"
          />
          <TextField
            label="Facebook URL"
            value={draft.social.facebookUrl}
            onChangeText={(facebookUrl) => updateSocial({ facebookUrl })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextField
            label="Instagram handle"
            value={draft.social.instagramHandle}
            onChangeText={(instagramHandle) => updateSocial({ instagramHandle })}
            placeholder="@restaurant"
            autoCapitalize="none"
          />
          <TextField
            label="Instagram URL"
            value={draft.social.instagramUrl}
            onChangeText={(instagramUrl) => updateSocial({ instagramUrl })}
            autoCapitalize="none"
            keyboardType="url"
          />
        </SectionCard>

        <SectionCard title="FEES & PRICING">
          <Text style={styles.bodyText}>
            Rendered in the storefront price strip. These are display values — the terminal still
            applies the final total at the counter.
          </Text>

          <View style={styles.feeRow}>
            <TextField
              label="Takeout"
              prefix="zł"
              value={feeInputs.takeout}
              onChangeText={(value) => updateFee('takeout', value)}
              keyboardType="decimal-pad"
              style={styles.feeField}
            />
            <TextField
              label="Packaging"
              prefix="zł"
              value={feeInputs.packaging}
              onChangeText={(value) => updateFee('packaging', value)}
              keyboardType="decimal-pad"
              style={styles.feeField}
            />
            <TextField
              label="Delivery / km"
              prefix="zł"
              value={feeInputs.deliveryPerKm}
              onChangeText={(value) => updateFee('deliveryPerKm', value)}
              keyboardType="decimal-pad"
              style={styles.feeField}
            />
          </View>
        </SectionCard>

        <SectionCard title="BRANCH & STAFF ACCESS CONTROL">
          <Text style={styles.bodyText}>
            Manage local unit parameters, database mapping and restaurant employee permissions.
          </Text>

          <Text style={styles.subLabel}>BRANCH TERMINAL</Text>
          <View style={styles.branchRow}>
            {(isLiveBackend ? state.branches : BRANCHES).map((branch) => {
              const selected = branch.id === state.activeBranch.id;
              return (
                <Pressable
                  key={branch.id}
                  onPress={() => void handleBranchSwitch(branch)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.branchChip,
                    selected ? styles.branchChipSelected : styles.branchChipIdle,
                  ]}
                >
                  <Text
                    style={[styles.branchText, selected && styles.branchTextSelected]}
                    numberOfLines={1}
                  >
                    {branch.code}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Physical Branch Name"
            value={draft.branchName}
            onChangeText={(branchName) =>
              setDraft((current) => ({ ...current, branchName }))
            }
          />

          <Text style={styles.subLabel}>BRANCH CODE</Text>
          <Text style={styles.rowSubtitle}>{state.activeBranch.code}</Text>

          <View style={styles.divider} />

          <Text style={styles.subLabel}>ACTIVE STAFF ROSTER</Text>
          {draft.staff.map((member) => (
            <View key={member.id} style={styles.staffRow}>
              <View style={styles.staffAvatar}>
                <Text style={styles.staffAvatarText}>{initials(member.name)}</Text>
              </View>
              <View style={styles.staffText}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {member.name}
                </Text>
                <Text style={styles.staffEmail} numberOfLines={1}>
                  {member.email}
                </Text>
              </View>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{ROLE_LABELS[member.role]}</Text>
              </View>
              {draft.staff.length > 1 ? (
                <Pressable
                  onPress={() => removeStaffMember(member.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${member.name}`}
                  style={styles.removeTouch}
                >
                  <Text style={styles.staffRemove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <Text style={styles.subLabel}>REGISTER NEW STAFF MEMBER</Text>
          <TextField
            label="Full Name"
            value={newStaffName}
            onChangeText={(value) => {
              setNewStaffName(value);
              setStaffError(null);
            }}
            placeholder="e.g. Jamie Rivera"
          />
          <TextField
            label="Staff Email"
            value={newStaffEmail}
            onChangeText={(value) => {
              setNewStaffEmail(value);
              setStaffError(null);
            }}
            placeholder="jamie@bbmanager.internal"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Temporary Password / PIN"
            value={newStaffPassword}
            onChangeText={setNewStaffPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Temporary credential"
          />

          <View style={styles.roleRow}>
            {STAFF_ROLES.map((role) => {
              const selected = newStaffRole === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => setNewStaffRole(role)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.roleChip,
                    selected ? styles.roleChipSelected : styles.roleChipIdle,
                  ]}
                >
                  <Text
                    style={[styles.roleChipText, selected && styles.roleChipTextSelected]}
                    numberOfLines={1}
                  >
                    {ROLE_LABELS[role]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {staffError ? <Text style={styles.staffError}>{staffError}</Text> : null}

          <ActionButton
            label="+ Register Staff Member"
            variant="primary"
            fullWidth
            onPress={addStaffMember}
            testID="btn_register_staff"
          />
        </SectionCard>

        <ActionButton
          label="SIGN OUT OF TERMINAL"
          variant="dangerOutline"
          fullWidth
          onPress={() => setLogoutVisible(true)}
          testID="btn_logout"
        />

        <Text style={styles.version}>
          BB Manager v{Constants.expoConfig?.version ?? '1.4.0'} · Store Operations Engine
        </Text>
      </ScrollView>

      <View style={styles.saveBar}>
        <ActionButton
          label="💾  SAVE TERMINAL SETTINGS"
          variant="primary"
          fullWidth
          onPress={() => void handleSave()}
          testID="btn_sticky_save_settings"
        />
      </View>

      <AlertTonePickerModal
        visible={tonePickerVisible}
        selectedToneId={draft.alertToneId}
        onClose={() => setTonePickerVisible(false)}
        onSave={(toneId) => {
          setTonePickerVisible(false);
          persistSoundSettings({ alertToneId: toneId });
        }}
      />

      <WeeklyHoursModal
        visible={weeklyVisible}
        schedule={state.storeConfig.weeklySchedule}
        onClose={() => setWeeklyVisible(false)}
        onSave={(schedule) => void updateWeeklySchedule(schedule)}
      />

      <DialogModal
        visible={savedVisible}
        title="Settings Saved"
        message="SMTP placeholders, audio alert preferences, notifications, delivery platform URLs and branch staff access were saved for this terminal."
        actions={[{ label: 'Done', onPress: () => setSavedVisible(false) }]}
        onRequestClose={() => setSavedVisible(false)}
      />

      <DialogModal
        visible={clearQueueVisible}
        title="Clear Stuck Queue"
        message={`Discard ${pendingCount} pending mutation(s)? They will not be sent again.`}
        onRequestClose={() => setClearQueueVisible(false)}
        actions={[
          { label: 'Cancel', variant: 'outline', onPress: () => setClearQueueVisible(false) },
          {
            label: 'Clear Queue',
            variant: 'danger',
            onPress: () => void handleClearQueue(),
          },
        ]}
      />

      <DialogModal
        visible={diagnosticsVisible}
        title="Sync Diagnostics"
        message="Server response for the queued actions"
        onRequestClose={() => setDiagnosticsVisible(false)}
        actions={[{ label: 'Close', onPress: () => setDiagnosticsVisible(false) }]}
      >
        {diagnostics ? (
          <View style={styles.diagnosticsBody}>
            <Text style={styles.diagLine}>
              Account: {diagnostics.pocketbase.role || 'staff'}
            </Text>
            <Text style={styles.diagLine}>
              Network health:{' '}
              {diagnostics.network.checks.find((check) => check.id === 'raw-health')?.status ||
                'no response'}
            </Text>
            <Text style={styles.diagLine}>
              {diagnostics.network.verdict.replace(/PocketBase/gi, 'service')}
            </Text>
            <Text style={styles.diagLine}>
              Queue: {diagnostics.queue.pending} pending • {diagnostics.result.synced} synced /{' '}
              {diagnostics.result.failed} rejected
            </Text>
            {diagnostics.discarded.length > 0 ? (
              <Text style={styles.diagError}>
                Dropped {diagnostics.discarded.length} permanently rejected action(s):{' '}
                {diagnostics.discarded
                  .slice(0, 3)
                  .map((entry) => `${entry.actionType} (${entry.kind} ${entry.status})`)
                  .join(', ')}
              </Text>
            ) : null}
            {diagnostics.failures.length === 0 ? (
              <Text style={styles.diagLine}>
                No rejection recorded. The full report is printed to the console.
              </Text>
            ) : (
              diagnostics.failures.slice(0, 4).map((failure) => (
                <Text
                  key={`${failure.actionType}-${failure.label}`}
                  style={styles.diagError}
                >
                  {failure.actionType}: {failure.kind} {failure.status} — {failure.hint}
                  {failure.detail ? ` (${failure.detail})` : ''}
                </Text>
              ))
            )}
          </View>
        ) : null}
      </DialogModal>

      <DialogModal
        visible={logoutVisible}
        title="Sign Out"
        message="Are you sure you want to end your kitchen session?"
        actions={[
          { label: 'Cancel', variant: 'outline', onPress: () => setLogoutVisible(false) },
          {
            label: 'Sign Out',
            variant: 'danger',
            onPress: () => {
              setLogoutVisible(false);
              void handleLogout();
            },
          },
        ]}
        onRequestClose={() => setLogoutVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  diagnosticsButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  diagnosticsBody: {
    gap: 6,
  },
  diagLine: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  diagError: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.error,
    fontWeight: '700',
  },
  routeBadge: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: Colors.primary,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceHighlight,
  },
  chipActive: {
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryMuted,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.primary,
  },
  chipCount: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
  },
  chipCountActive: {
    color: Colors.primary,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryHint: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryAction: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: Colors.primary,
  },
  categoryActionMuted: {
    color: Colors.textMuted,
  },
  eventBlock: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    paddingTop: 10,
    gap: 8,
  },
  routeBody: {
    gap: 8,
    paddingLeft: 2,
  },
  routeEmpty: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  feeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  feeField: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
  },
  profileText: {
    flex: 1,
    gap: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  userEmail: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statusPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  masterBox: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  hintText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  slotChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipIdle: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  slotChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  slotTextSelected: {
    color: Colors.white,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  alertToneRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertToneText: {
    flex: 1,
    gap: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  segmentSelected: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.textMuted,
  },
  segmentTextSelected: {
    color: Colors.white,
  },
  outboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  outboxText: {
    flex: 1,
    gap: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  portField: {
    flex: 1,
  },
  halfField: {
    flex: 1,
  },
  encryptionGroup: {
    flex: 2,
    gap: 6,
  },
  encryptionRow: {
    flexDirection: 'row',
    gap: 4,
  },
  encryptionChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encryptionChipIdle: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  encryptionChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  encryptionText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  encryptionTextSelected: {
    color: Colors.white,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingLeft: 10,
    paddingRight: 4,
    minHeight: 44,
  },
  recipientText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  removeTouch: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  addField: {
    flex: 1,
  },
  branchRow: {
    flexDirection: 'row',
    gap: 6,
  },
  branchChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchChipIdle: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  branchChipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  branchText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  branchTextSelected: {
    color: Colors.primary,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 8,
  },
  staffAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.white,
  },
  staffText: {
    flex: 1,
    gap: 1,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  staffEmail: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  rolePill: {
    backgroundColor: Colors.primaryMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  rolePillText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.primary,
  },
  staffRemove: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.error,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  roleChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  roleChipIdle: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  roleChipSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  roleChipText: {
    fontSize: 8,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  roleChipTextSelected: {
    color: Colors.primary,
  },
  staffError: {
    fontSize: 11,
    color: Colors.error,
  },
  version: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  saveBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
  },
});
