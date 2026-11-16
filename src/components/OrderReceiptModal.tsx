import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { formatCurrency, parseReservationTimestamp } from '../lib/format';
import { exportReceiptPdf } from '../services/receiptPdf';
import { Branch, Order } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { StatusBadge } from './StatusBadge';

export interface OrderReceiptModalProps {
  order: Order | null;
  branch?: Branch | null;
  onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function splitTimestamp(iso: string): { date: string; time: string } {
  const parsed = parseReservationTimestamp(iso);
  if (!parsed) return { date: iso, time: '' };
  const hours24 = parsed.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return {
    date: `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`,
    time: `${hours}:${minutes} ${hours24 < 12 ? 'AM' : 'PM'}`,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** Digital receipt for a ticket, with on-device PDF export / print. */
export function OrderReceiptModal({ order, branch, onClose }: OrderReceiptModalProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedUri, setExportedUri] = useState<string | null>(null);

  if (!order) return null;

  const { date, time } = splitTimestamp(order.createdAt);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const result = await exportReceiptPdf(order, branch);
      setExportedUri(result.uri);
    } catch (error) {
      setExportError('Could not generate the PDF on this device. Try again.');
      console.warn('[receipt] PDF export failed', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ModalShell
      visible={order !== null}
      title={`Receipt #${order.orderNumber}`}
      subtitle={branch?.name ?? 'Digital receipt'}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}
          {!exportError && exportedUri ? (
            <Text style={styles.exportDone}>PDF saved on this device.</Text>
          ) : null}
          <ActionButton
            label={exporting ? 'GENERATING PDF…' : 'EXPORT PDF / PRINT'}
            variant="primary"
            fullWidth
            disabled={exporting}
            onPress={() => void handleExport()}
            testID={`btn_receipt_export_${order.orderNumber}`}
          />
        </View>
      }
    >
      <View style={styles.badgeRow}>
        <StatusBadge status={order.status} />
        {order.pickupCode ? (
          <View style={styles.pinPill}>
            <Text style={styles.pinText}>PIN {order.pickupCode}</Text>
          </View>
        ) : null}
        <View style={styles.pinPill}>
          <Text style={styles.pinText}>{order.channel === 'online' ? 'ONLINE' : 'WALK-IN'}</Text>
        </View>
      </View>

      <DetailRow label="Customer Name" value={order.customerName} />
      <DetailRow label="Email" value={order.customerEmail || 'Not provided'} />
      <DetailRow label="Phone" value={order.customerPhone || 'Not provided'} />
      <DetailRow label="Date" value={date} />
      {time ? <DetailRow label="Time" value={time} /> : null}
      <DetailRow label="Transaction Amount" value={formatCurrency(order.totalAmount)} />

      <View style={styles.itemsHeader}>
        <Text style={styles.itemsTitle}>Itemized Receipt</Text>
      </View>
      {order.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemQty}>
              {item.quantity} × {formatCurrency(item.unitPrice)}
            </Text>
            {item.specialInstructions ? (
              <Text style={styles.itemNote}>{item.specialInstructions}</Text>
            ) : null}
          </View>
          <Text style={styles.itemTotal}>
            {formatCurrency(item.unitPrice * item.quantity)}
          </Text>
        </View>
      ))}
      <View style={styles.grandRow}>
        <Text style={styles.grandLabel}>TOTAL</Text>
        <Text style={styles.grandValue}>{formatCurrency(order.totalAmount)}</Text>
      </View>

      {order.notes ? <Text style={styles.notes}>Note: {order.notes}</Text> : null}
      {exporting ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.busyText}>Rendering the thermal receipt…</Text>
        </View>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  pinPill: {
    backgroundColor: Colors.glassFillStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pinText: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorderSubtle,
  },
  rowLabel: {
    ...Typography.sectionLabel,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  itemsHeader: {
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  itemsTitle: {
    ...Typography.sectionLabel,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorderSubtle,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  itemQty: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  itemTotal: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: Colors.textSecondary,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.primaryBorder,
  },
  grandLabel: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  grandValue: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    color: Colors.primaryText,
  },
  notes: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
    marginTop: Spacing.sm,
  },
  footer: {
    gap: Spacing.sm,
  },
  exportError: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.error,
    textAlign: 'center',
  },
  exportDone: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.success,
    textAlign: 'center',
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  busyText: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
});