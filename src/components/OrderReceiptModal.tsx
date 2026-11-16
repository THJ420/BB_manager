import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
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
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pinText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  itemsHeader: {
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  itemsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  itemQty: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemNote: {
    fontSize: 10,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  grandLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  grandValue: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.primary,
  },
  notes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
    marginTop: Spacing.sm,
  },
  footer: {
    gap: Spacing.sm,
  },
  exportError: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  exportDone: {
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 11,
    color: Colors.textMuted,
  },
});