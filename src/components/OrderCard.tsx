import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { formatCurrency } from '../lib/format';
import { orderAction, orderTiming } from '../lib/domain';
import { Order, OrderStatus } from '../types';
import { ActionButton, ButtonVariant } from './ActionButton';
import { StatusBadge } from './StatusBadge';

export interface OrderCardProps {
  order: Order;
  now: number;
  onAdvance: (orderId: string, status: OrderStatus) => void;
  onReject?: (order: Order) => void;
  onSelect?: (order: Order) => void;
  selected?: boolean;
  /** Recently arrived over SSE; the Orders Board clears this after a few seconds. */
  highlighted?: boolean;
  /** Owner console: show the ticket without terminal actions. */
  readOnly?: boolean;
  /** Branch code shown on cross-branch (owner) boards. */
  branchLabel?: string;
}

const ACTION_VARIANT: Record<'new' | 'preparing' | 'ready', ButtonVariant> = {
  new: 'primary',
  preparing: 'success',
  ready: 'slate',
};

export function OrderCard({
  order,
  now,
  onAdvance,
  onReject,
  onSelect,
  selected,
  highlighted = false,
  readOnly = false,
  branchLabel,
}: OrderCardProps) {
  const timing = orderTiming(order, now);
  const action = readOnly ? null : orderAction(order.status);
  const variant = action && order.status !== 'completed' && order.status !== 'cancelled'
    ? ACTION_VARIANT[order.status as 'new' | 'preparing' | 'ready']
    : 'primary';
  const canReject =
    !readOnly &&
    Boolean(onReject) &&
    order.status !== 'completed' &&
    order.status !== 'cancelled';

  const content = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.idGroup}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <View style={styles.pinPill}>
            <Text style={styles.pinText}>PIN {order.pickupCode}</Text>
          </View>
          {branchLabel ? (
            <View style={styles.pinPill}>
              <Text style={styles.pinText}>{branchLabel}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          {highlighted ? (
            <View style={styles.justInPill}>
              <Text style={styles.justInText}>JUST IN</Text>
            </View>
          ) : null}
          <StatusBadge status={order.status} />
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.customerBlock}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customerName}
          </Text>
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>
        <View style={styles.timingBlock}>
          <Text style={styles.receivedLabel}>RECEIVED</Text>
          <Text style={styles.elapsed}>{timing.elapsed}</Text>
          {timing.countdown && order.status !== 'completed' && order.status !== 'cancelled' ? (
            <Text
              style={[styles.countdown, timing.countdown.overdue && styles.countdownOverdue]}
            >
              {timing.countdown.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.items}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.qtyBox}>
              <Text style={styles.qtyText}>{item.quantity}x</Text>
            </View>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.itemPrice}>
              {formatCurrency(item.unitPrice * item.quantity)}
            </Text>
          </View>
        ))}
      </View>

      {order.notes ? <Text style={styles.notes}>Note: {order.notes}</Text> : null}

      {order.status === 'cancelled' && order.cancellationReason ? (
        <Text style={styles.rejectionReason}>
          Rejected: {order.cancellationReason}
        </Text>
      ) : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total: {formatCurrency(order.totalAmount)}</Text>
        <View style={styles.channelPill}>
          <Text style={styles.channelText}>
            {order.channel === 'online' ? 'ONLINE' : 'WALK-IN'}
          </Text>
        </View>
      </View>

      {readOnly ? (
        <Text style={styles.readOnlyNote}>Owner view · read-only</Text>
      ) : action || canReject ? (
        <View style={styles.actionRow}>
          {action ? (
            <ActionButton
              label={action.label}
              variant={variant}
              onPress={() => onAdvance(order.id, action.next)}
              style={styles.advanceButton}
              testID={`btn_${action.next}_${order.orderNumber}`}
              accessibilityHint={`Move order ${order.orderNumber} to ${action.next}`}
            />
          ) : null}
          {canReject && onReject ? (
            <ActionButton
              label="REJECT"
              variant="dangerOutline"
              onPress={() => onReject(order)}
              style={styles.rejectButton}
              testID={`btn_reject_${order.orderNumber}`}
              accessibilityHint={`Reject order ${order.orderNumber} with a reason`}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <Pressable
        onPress={() => onSelect(order)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.orderNumber}, ${order.status}${highlighted ? ', just arrived' : ''}`}
        testID={`order_card_${order.orderNumber}`}
        style={({ pressed }) => [
          styles.card,
          highlighted && styles.cardHighlighted,
          selected && styles.cardSelected,
          pressed && styles.cardPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.card, highlighted && styles.cardHighlighted]}
      testID={`order_card_${order.orderNumber}`}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 10,
  },
  cardSelected: {
    borderColor: Colors.primary,
  },
  cardHighlighted: {
    borderColor: Colors.info,
    borderWidth: 2,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceHighlight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  justInPill: {
    backgroundColor: Colors.infoMuted,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  justInText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: Colors.info,
  },
  idGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  pinPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pinText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: Colors.textSecondary,
  },
  readOnlyNote: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  customerBlock: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  customerPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timingBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  receivedLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  elapsed: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.warning,
  },
  countdown: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  countdownOverdue: {
    color: Colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  items: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBox: {
    width: 26,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  notes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  rejectionReason: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.error,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  channelPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  channelText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  advanceButton: {
    flex: 1,
  },
  rejectButton: {
    minWidth: 96,
  },
});
