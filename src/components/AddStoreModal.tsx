import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';
import {
  BRANCH_SELECT_OPTIONS,
  BranchSelect,
  CreateBranchInput,
  normalizeBranchCode,
} from '../services/branches';
import { Colors, Radius, Spacing } from '../theme/colors';

export interface AddStoreModalProps {
  visible: boolean;
  existingCodes: string[];
  onClose: () => void;
  onSubmit: (values: CreateBranchInput) => Promise<void>;
}

const EMPTY: CreateBranchInput = {
  name: '',
  code: '',
  address: '',
  select: 'enjoydonerkebab',
};

/** Provisions a new branch in PocketBase; the sync hook mirrors it to the web. */
export function AddStoreModal({
  visible,
  existingCodes,
  onClose,
  onSubmit,
}: AddStoreModalProps) {
  const [values, setValues] = useState<CreateBranchInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValues(EMPTY);
    setError(null);
    setBusy(false);
  }, [visible]);

  const patch = (next: Partial<CreateBranchInput>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  const code = normalizeBranchCode(values.code);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, code });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'The store could not be created.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      title="Add Store"
      subtitle="Creates the branch in PocketBase and on the storefront"
      onClose={onClose}
      footer={
        <ActionButton
          label={busy ? 'CREATING…' : 'CREATE STORE'}
          variant="primary"
          fullWidth
          disabled={busy}
          onPress={() => void submit()}
          testID="btn_store_create_submit"
        />
      }
    >
      <TextField
        label="Store Name"
        value={values.name}
        onChangeText={(value) => patch({ name: value })}
        placeholder="e.g. Enjoy Doner Kebab Mosina"
        testID="input_store_name"
      />

      <TextField
        label="Branch Code"
        value={values.code}
        onChangeText={(value) => patch({ code: value })}
        placeholder="e.g. EDK-MOSINA"
        autoCapitalize="characters"
        maxLength={40}
        testID="input_store_code"
      />
      {code ? <Text style={styles.preview}>Registers as: {code}</Text> : null}

      <TextField
        label="Address (optional)"
        value={values.address}
        onChangeText={(value) => patch({ address: value })}
        placeholder="e.g. Poznańska 3, 62-050 Mosina"
        testID="input_store_address"
      />

      <Text style={styles.label}>BRAND</Text>
      <View style={styles.brandRow}>
        {BRANCH_SELECT_OPTIONS.map((option) => {
          const selected = values.select === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => patch({ select: option.id as BranchSelect })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`store_brand_${option.id.replace(/\s+/g, '_')}`}
              style={[styles.brandChip, selected ? styles.brandChipOn : styles.brandChipOff]}
            >
              <Text style={[styles.brandText, selected && styles.brandTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        The storefront sync picks the new branch up automatically and links it back to this
        terminal. Menu, hours and staff are configured afterwards from the store workspace.
      </Text>

      {error ? (
        <Text style={styles.error} testID="store_modal_error">
          {error}
        </Text>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  brandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  brandChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandChipOn: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryBorder,
  },
  brandChipOff: {
    backgroundColor: Colors.surfaceHighlight,
    borderColor: Colors.surfaceBorder,
  },
  brandText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  brandTextOn: {
    color: Colors.primary,
  },
  preview: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.error,
  },
});