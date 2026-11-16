import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BackgroundPermissionResult,
  markBackgroundRationaleCompleted,
  requestBackgroundPermissions,
  snoozeBackgroundRationale,
} from '../services/backgroundPermissions';
import { Colors, Radius } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';

export interface BackgroundPermissionModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const RATIONALE_POINTS = [
  {
    icon: '🔔',
    title: 'Loud order alarms',
    body: 'Online orders from Radhuni, Crispy Chicken and Enjoy Doner Kebab ring at full volume and open the ticket screen instantly — even with the screen off.',
  },
  {
    icon: '⚡',
    title: 'Always-on connection',
    body: 'A foreground service keeps the live order feed running while the phone is locked or you are using other apps.',
  },
  {
    icon: '🔋',
    title: 'Battery optimisation exemption',
    body: 'Stops Android from putting this terminal to sleep, which would delay or silence incoming tickets.',
  },
];

export function BackgroundPermissionModal({
  visible,
  onDismiss,
}: BackgroundPermissionModalProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BackgroundPermissionResult | null>(null);

  const handleSnooze = () => {
    void snoozeBackgroundRationale();
    setResult(null);
    onDismiss();
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await requestBackgroundPermissions();
      await markBackgroundRationaleCompleted();
      setResult(outcome);
    } finally {
      setBusy(false);
    }
  };

  const handleDone = () => {
    setResult(null);
    onDismiss();
  };

  return (
    <ModalShell
      visible={visible}
      title="Never Miss an Online Order"
      subtitle="BB Manager needs background access to protect every incoming ticket."
      onClose={result ? handleDone : handleSnooze}
      footer={
        result ? (
          <ActionButton
            label="DONE"
            variant="primary"
            fullWidth
            onPress={handleDone}
            testID="btn_background_permissions_done"
          />
        ) : (
          <View style={styles.actions}>
            <ActionButton
              label="NOT NOW"
              variant="outline"
              onPress={handleSnooze}
              style={styles.action}
              testID="btn_background_permissions_snooze"
            />
            <ActionButton
              label={busy ? 'REQUESTING…' : 'ENABLE PROTECTIONS'}
              variant="primary"
              disabled={busy}
              onPress={() => void handleEnable()}
              style={styles.action}
              testID="btn_background_permissions_enable"
            />
          </View>
        )
      }
    >
      {result ? (
        <View style={styles.body}>
          <ResultRow
            ok={result.notifications === 'granted'}
            label={
              result.notifications === 'granted'
                ? 'Notifications allowed — alarms and banners can ring.'
                : 'Notifications were denied. Allow them in system settings so locked phones still ring.'
            }
          />
          <ResultRow
            ok={result.batteryExemption !== 'unsupported'}
            label={
              result.batteryExemption === 'requested'
                ? 'Confirm “Allow” in the system dialog to exempt BB Manager from battery optimisation.'
                : result.batteryExemption === 'settings-opened'
                  ? 'Find BB Manager in the battery-optimisation list and set it to “Don’t optimise”.'
                  : 'This device does not expose the battery-optimisation dialog. Keep the app open during service.'
            }
          />
          {result.fullScreenIntent !== 'unsupported' ? (
            <ResultRow
              ok={result.fullScreenIntent === 'granted'}
              label={
                result.fullScreenIntent === 'granted'
                  ? 'Lock-screen popups allowed — order alarms open over the lock screen.'
                  : 'Allow “Full screen notifications” for BB Manager in the settings page that just opened so orders pop up over the lock screen.'
              }
            />
          ) : null}
          <Text style={styles.note}>
            You can review these choices any time in Terminal Settings → Background & Alarm
            Reliability.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          {RATIONALE_POINTS.map((point) => (
            <View key={point.title} style={styles.point}>
              <View style={styles.pointIcon}>
                <Text style={styles.pointIconText}>{point.icon}</Text>
              </View>
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.note}>
            “Enable protections” asks for notification permission, opens the system
            battery-optimisation dialog and, on Android 14+, the full-screen notification
            access page. Nothing else on this device is changed.
          </Text>
        </View>
      )}
    </ModalShell>
  );
}

function ResultRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View
      style={[
        styles.resultRow,
        {
          backgroundColor: ok ? Colors.successMuted : Colors.warningMuted,
          borderColor: ok ? Colors.successBorder : Colors.glassBorder,
        },
      ]}
    >
      <Text style={[styles.resultIcon, { color: ok ? Colors.success : Colors.warning }]}>
        {ok ? '✓' : '!'}
      </Text>
      <Text style={styles.resultLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
  },
  body: {
    gap: 10,
  },
  point: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.glassFill,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    padding: 12,
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointIconText: {
    fontSize: 16,
  },
  pointText: {
    flex: 1,
    gap: 2,
  },
  pointTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  pointBody: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  note: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  resultIcon: {
    fontFamily: Fonts.interBold,
    fontSize: 15,
  },
  resultLabel: {
    flex: 1,
    fontFamily: Fonts.interMedium,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textPrimary,
  },
});