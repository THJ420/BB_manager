import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';
import {
  ASSIGNABLE_STAFF_ROLES,
  AssignableStaffRole,
  StaffAccount,
  normalizeStaffUsername,
  staffEmailFor,
} from '../services/staff';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';

export interface StaffFormValues {
  username: string;
  password: string;
  name: string;
  email: string;
  role: AssignableStaffRole;
}

export interface StaffAccountModalProps {
  visible: boolean;
  mode: 'create' | 'reset';
  branchLabel: string;
  account: StaffAccount | null;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => Promise<void>;
}

const ROLE_LABELS: Record<AssignableStaffRole, string> = {
  floor_staff: 'FLOOR STAFF',
  kitchen_lead: 'KITCHEN LEAD',
  manager: 'MANAGER',
};

const EMPTY: StaffFormValues = {
  username: '',
  password: '',
  name: '',
  email: '',
  role: 'floor_staff',
};

/** Issues a real PocketBase login, or resets an existing employee's password. */
export function StaffAccountModal({
  visible,
  mode,
  branchLabel,
  account,
  onClose,
  onSubmit,
}: StaffAccountModalProps) {
  const [values, setValues] = useState<StaffFormValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValues(EMPTY);
    setError(null);
    setBusy(false);
  }, [visible, account?.id, mode]);

  const patch = (next: Partial<StaffFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  const username = normalizeStaffUsername(values.username);
  const emailPreview = values.email.trim() || (username ? staffEmailFor(username) : '');

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, username });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'The change could not be saved.'
      );
    } finally {
      setBusy(false);
    }
  };

  const isReset = mode === 'reset';

  return (
    <ModalShell
      visible={visible}
      title={isReset ? 'Reset Password' : 'Create Employee Account'}
      subtitle={
        isReset
          ? `${account?.username ?? ''} • ${branchLabel}`
          : `Terminal login locked to ${branchLabel}`
      }
      onClose={onClose}
      footer={
        <ActionButton
          label={busy ? 'SAVING…' : isReset ? 'SET NEW PASSWORD' : 'CREATE ACCOUNT'}
          variant="primary"
          fullWidth
          disabled={busy}
          onPress={() => void submit()}
          testID={isReset ? 'btn_staff_reset_submit' : 'btn_staff_create_submit'}
        />
      }
    >
      {isReset ? (
        <Text style={styles.note}>
          The employee keeps their username, role and store. Only the password changes.
        </Text>
      ) : (
        <>
          <TextField
            label="Username"
            value={values.username}
            onChangeText={(value) => patch({ username: value })}
            placeholder="e.g. edk-mosina-2"
            autoCapitalize="none"
            maxLength={64}
            testID="input_staff_username"
          />
          {username ? <Text style={styles.preview}>Signs in as: {username}</Text> : null}

          <TextField
            label="Employee Name"
            value={values.name}
            onChangeText={(value) => patch({ name: value })}
            placeholder="e.g. Anna Kowalska"
            testID="input_staff_name"
          />

          <Text style={styles.label}>ROLE</Text>
          <View style={styles.roleRow}>
            {ASSIGNABLE_STAFF_ROLES.map((role) => {
              const selected = values.role === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => patch({ role })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`staff_role_${role}`}
                  style={[styles.roleChip, selected ? styles.roleChipOn : styles.roleChipOff]}
                >
                  <Text style={[styles.roleText, selected && styles.roleTextOn]}>
                    {ROLE_LABELS[role]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Email (optional)"
            value={values.email}
            onChangeText={(value) => patch({ email: value })}
            placeholder={emailPreview || 'name@restaurant.pl'}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input_staff_email"
          />
          <Text style={styles.note}>
            Left blank, the terminal gets the internal address {emailPreview || '…'} — no
            mailbox is created.
          </Text>
        </>
      )}

      <TextField
        label={isReset ? 'New Password' : 'Password'}
        value={values.password}
        onChangeText={(value) => patch({ password: value })}
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        testID="input_staff_password"
      />

      {error ? (
        <Text style={styles.error} testID="staff_modal_error">
          {error}
        </Text>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.sectionLabel,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipOn: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryBorder,
  },
  roleChipOff: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.glassBorder,
  },
  roleText: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  roleTextOn: {
    color: Colors.primaryText,
  },
  preview: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.primaryText,
  },
  note: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  error: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.error,
  },
});