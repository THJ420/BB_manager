import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';
import {
  CreateBranchInput,
  normalizeBranchCode,
  storeNameSuggestion,
} from '../services/branches';
import { Colors, Spacing } from '../theme/colors';

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
  phone: '',
  openingHours: '',
  facebookUrl: '',
  menuDownloadUrl: '',
  mapsEmbed: '',
};

/**
 * Provisions a new Enjoy Doner Kebab branch in PocketBase; the sync hook
 * mirrors it to the WordPress storefront. EDK is the only multi-branch brand,
 * so there is no brand picker — Radhuni and Crispy Chicken are single-unit.
 */
export function AddStoreModal({
  visible,
  existingCodes,
  onClose,
  onSubmit,
}: AddStoreModalProps) {
  const [values, setValues] = useState<CreateBranchInput>(EMPTY);
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValues(EMPTY);
    setNameTouched(false);
    setError(null);
    setBusy(false);
  }, [visible]);

  const patch = (next: Partial<CreateBranchInput>) => {
    setValues((current) => ({ ...current, ...next }));
    setError(null);
  };

  const code = normalizeBranchCode(values.code);

  // Until the owner edits the name directly, it tracks the branch code with
  // the brand suffix: EDK-MOSINA -> "Mosina Enjoy Doner Kebab".
  const handleCodeChange = (value: string) => {
    const suggestion = storeNameSuggestion(value);
    setValues((current) => ({
      ...current,
      code: value,
      name: nameTouched ? current.name : suggestion,
    }));
    setError(null);
  };

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
        label="Branch Code"
        value={values.code}
        onChangeText={handleCodeChange}
        placeholder="e.g. EDK-MOSINA"
        autoCapitalize="characters"
        maxLength={40}
        testID="input_store_code"
      />
      {code ? <Text style={styles.preview}>Registers as: {code}</Text> : null}

      <TextField
        label="Store Name"
        value={values.name}
        onChangeText={(value) => {
          setNameTouched(true);
          patch({ name: value });
        }}
        placeholder="e.g. Mosina Enjoy Doner Kebab"
        testID="input_store_name"
      />

      <TextField
        label="Address"
        value={values.address}
        onChangeText={(value) => patch({ address: value })}
        placeholder="e.g. Poznańska 3, 62-050 Mosina"
        testID="input_store_address"
      />

      <TextField
        label="Phone Number"
        value={values.phone}
        onChangeText={(value) => patch({ phone: value })}
        placeholder="e.g. +48 61 123 45 67"
        keyboardType="phone-pad"
        testID="input_store_phone"
      />

      <TextField
        label="Opening Hours"
        value={values.openingHours}
        onChangeText={(value) => patch({ openingHours: value })}
        placeholder="e.g. Mon–Sun 11:00–22:00"
        testID="input_store_hours"
      />

      <TextField
        label="Facebook Page Link"
        value={values.facebookUrl}
        onChangeText={(value) => patch({ facebookUrl: value })}
        placeholder="https://facebook.com/yourstore"
        autoCapitalize="none"
        keyboardType="url"
        testID="input_store_facebook"
      />

      <TextField
        label="Download Menu Link"
        value={values.menuDownloadUrl}
        onChangeText={(value) => patch({ menuDownloadUrl: value })}
        placeholder="https://yourstore.pl/menu.pdf"
        autoCapitalize="none"
        keyboardType="url"
        testID="input_store_menu"
      />

      <TextField
        label="Google Maps Embed Code"
        value={values.mapsEmbed}
        onChangeText={(value) => patch({ mapsEmbed: value })}
        placeholder='Paste the <iframe …> from Google Maps → Share → Embed a map'
        autoCapitalize="none"
        multiline
        numberOfLines={4}
        testID="input_store_maps"
      />
      <Text style={styles.hint}>
        The embed code powers the live map preview on the store page.
      </Text>

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
  preview: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  hint: {
    fontSize: 10,
    lineHeight: 14,
    color: Colors.textMuted,
    marginTop: -Spacing.xs,
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