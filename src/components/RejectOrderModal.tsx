import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Order } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';

export const REJECTION_REASON_TEMPLATES = [
  'Kitchen is too busy / overloaded',
  'Item currently out of stock',
  'Store closing soon / outside operating hours',
  'Invalid delivery/pickup address or contact info',
] as const;

export interface RejectOrderModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * A rejection cannot be submitted without a reason: templates reject on the
 * first tap, while the custom option requires non-empty text.
 */
export function RejectOrderModal({
  visible,
  order,
  onClose,
  onConfirm,
}: RejectOrderModalProps) {
  const [customMode, setCustomMode] = useState(false);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCustomMode(false);
    setCustomReason('');
  }, [visible, order?.id]);

  const submit = (reason: string) => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <ModalShell
      visible={visible}
      title="Reject Order"
      subtitle={
        order
          ? `Order #${order.orderNumber} — choose a reason. It is recorded with the cancellation.`
          : 'Choose why this order cannot be fulfilled.'
      }
      onClose={onClose}
      footer={
        <ActionButton
          label="Keep Order"
          variant="outline"
          fullWidth
          onPress={onClose}
          testID="reject_cancel"
        />
      }
    >
      <Text style={styles.hint}>Tap a template to reject immediately.</Text>

      <View style={styles.templates}>
        {REJECTION_REASON_TEMPLATES.map((reason, index) => (
          <ActionButton
            key={reason}
            label={reason}
            variant="dangerOutline"
            onPress={() => submit(reason)}
            testID={`reject_reason_${index}`}
            accessibilityHint="Reject this order with this reason"
          />
        ))}
      </View>

      {customMode ? (
        <>
          <TextField
            label="Custom reason"
            value={customReason}
            onChangeText={setCustomReason}
            placeholder="Explain why this order cannot be fulfilled"
            multiline
            numberOfLines={3}
            maxLength={500}
            testID="reject_custom_reason"
          />
          <ActionButton
            label="CONFIRM REJECTION"
            variant="danger"
            fullWidth
            disabled={customReason.trim().length === 0}
            onPress={() => submit(customReason)}
            testID="reject_confirm_custom"
          />
        </>
      ) : (
        <ActionButton
          label="CUSTOM REASON…"
          variant="outline"
          onPress={() => setCustomMode(true)}
          testID="reject_custom_toggle"
        />
      )}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  templates: {
    gap: 8,
  },
});
