import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { DialogModal } from './DialogModal';
import { TextField } from './TextField';
import { formatCurrency } from '../lib/format';
import {
  BulkPriceDirection,
  BulkPriceMode,
  computeAdjustedPrice,
} from '../services/bulkPrice';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

export interface BulkPriceAdjustModalProps {
  visible: boolean;
  /** Number of selected items the adjustment will apply to. */
  itemCount: number;
  /** Optional sample price (first selected item) for a live before → after preview. */
  samplePrice?: number;
  onClose: () => void;
  onApply: (mode: BulkPriceMode, direction: BulkPriceDirection, value: number) => void;
}

interface ChoiceProps<T extends string> {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  testIDPrefix: string;
}

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: ChoiceProps<T>) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <ActionButton
            key={option.id}
            label={option.label}
            variant={active ? 'primary' : 'outline'}
            compact
            onPress={() => onChange(option.id)}
            style={styles.choice}
            testID={`${testIDPrefix}_${option.id}`}
          />
        );
      })}
    </View>
  );
}

/**
 * Bulk price adjustment dialog: fixed amount or percentage, increase or
 * decrease. The math itself lives in the pure computeAdjustedPrice helper
 * (clamp >= 0, 2-decimal rounding) so it is unit-testable.
 */
export function BulkPriceAdjustModal({
  visible,
  itemCount,
  samplePrice,
  onClose,
  onApply,
}: BulkPriceAdjustModalProps) {
  const [mode, setMode] = useState<BulkPriceMode>('fixed');
  const [direction, setDirection] = useState<BulkPriceDirection>('increase');
  const [valueText, setValueText] = useState('');

  // Fresh dialog state every time it opens.
  useEffect(() => {
    if (visible) {
      setMode('fixed');
      setDirection('increase');
      setValueText('');
    }
  }, [visible]);

  const trimmed = valueText.trim().replace(',', '.');
  const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const showError = trimmed !== '' && !valid;

  const preview =
    valid && samplePrice !== undefined
      ? computeAdjustedPrice(samplePrice, mode, direction, parsed)
      : null;

  return (
    <DialogModal
      visible={visible}
      title="Adjust Price"
      message={`${itemCount} selected item(s) will be updated.`}
      onRequestClose={onClose}
      actions={[
        { label: 'Cancel', variant: 'outline', onPress: onClose },
        {
          label: 'Apply',
          variant: 'primary',
          onPress: () => {
            if (!valid || itemCount === 0) return;
            onApply(mode, direction, parsed);
          },
        },
      ]}
    >
      <Text style={styles.label}>Mode</Text>
      <ChoiceRow
        options={[
          { id: 'fixed', label: 'Fixed amount (zł)' },
          { id: 'percent', label: 'Percentage (%)' },
        ]}
        value={mode}
        onChange={setMode}
        testIDPrefix="bulk_price_mode"
      />

      <Text style={styles.label}>Direction</Text>
      <ChoiceRow
        options={[
          { id: 'increase', label: '+ Increase' },
          { id: 'decrease', label: '− Decrease' },
        ]}
        value={direction}
        onChange={setDirection}
        testIDPrefix="bulk_price_direction"
      />

      <TextField
        label={mode === 'fixed' ? 'Amount (zł)' : 'Percent (%)'}
        value={valueText}
        onChangeText={setValueText}
        placeholder={mode === 'fixed' ? 'e.g. 2.50' : 'e.g. 10'}
        keyboardType="decimal-pad"
        errorText={showError ? 'Enter a number greater than 0.' : undefined}
        testID="bulk_price_value"
      />

      <Text style={styles.preview} testID="bulk_price_preview">
        {preview !== null && samplePrice !== undefined
          ? `Preview: ${formatCurrency(samplePrice)} → ${formatCurrency(preview)}`
          : 'Prices are clamped to 0 and rounded to 2 decimals.'}
      </Text>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.sectionLabel,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  choice: {
    flex: 1,
    borderRadius: Radius.md,
  },
  preview: {
    ...Typography.cardDescription,
    color: Colors.textMuted,
  },
});