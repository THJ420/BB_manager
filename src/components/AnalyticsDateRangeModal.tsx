import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AnalyticsDateRange,
  addLocalDays,
  formatDateInput,
  startOfLocalDay,
  validateCustomAnalyticsRange,
} from '../lib/analytics';
import { Colors, Radius } from '../theme/colors';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';

export interface AnalyticsDateRangeModalProps {
  visible: boolean;
  now: number;
  initialStart: number;
  initialEnd: number;
  onClose: () => void;
  onApply: (range: AnalyticsDateRange) => void;
}

const TRAILING_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
];

export function AnalyticsDateRangeModal({
  visible,
  now,
  initialStart,
  initialEnd,
  onClose,
  onApply,
}: AnalyticsDateRangeModalProps) {
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStartText(formatDateInput(initialStart));
    setEndText(formatDateInput(initialEnd));
    setError(null);
  }, [visible, initialStart, initialEnd]);

  const applyTrailingRange = (days: number) => {
    const end = startOfLocalDay(now);
    const start = addLocalDays(end, -(days - 1));
    setStartText(formatDateInput(start));
    setEndText(formatDateInput(end));
    setError(null);
  };

  const handleApply = () => {
    const result = validateCustomAnalyticsRange(startText, endText, now);
    if (!result.range) {
      setError(result.error ?? 'Choose a valid date range.');
      return;
    }
    onApply(result.range);
  };

  return (
    <ModalShell
      visible={visible}
      title="Custom Date Range"
      subtitle="Filter every metric and chart to a window within the last 12 months."
      onClose={onClose}
      footer={
        <>
          <ActionButton
            label="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.footerButton}
          />
          <ActionButton
            label="Apply Range"
            variant="primary"
            onPress={handleApply}
            style={styles.footerButton}
            testID="analytics_apply_range"
          />
        </>
      }
    >
      <Text style={styles.hint}>
        Dates are inclusive. The earliest available analytics day is one year ago.
      </Text>

      <View style={styles.quickSection}>
        <Text style={styles.quickLabel}>QUICK TRAILING RANGES</Text>
        <View style={styles.quickRow}>
          {TRAILING_RANGES.map((preset) => (
            <ActionButton
              key={preset.label}
              label={preset.label}
              variant="subtle"
              compact
              onPress={() => applyTrailingRange(preset.days)}
              style={styles.quickButton}
            />
          ))}
        </View>
      </View>

      <View style={styles.dateRow}>
        <TextField
          label="Start Date *"
          value={startText}
          onChangeText={(value) => {
            setStartText(value);
            setError(null);
          }}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          maxLength={10}
          testID="analytics_start_date"
          style={styles.dateField}
        />
        <TextField
          label="End Date *"
          value={endText}
          onChangeText={(value) => {
            setEndText(value);
            setError(null);
          }}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          maxLength={10}
          testID="analytics_end_date"
          style={styles.dateField}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  quickSection: {
    gap: 6,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: Colors.errorMuted,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    borderRadius: Radius.md,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: Colors.error,
  },
  footerButton: {
    flex: 1,
  },
});
