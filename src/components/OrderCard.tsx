import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { formatCurrency } from '../lib/format';
import { orderAction, orderStatusBadge, orderTiming } from '../lib/domain';
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

const tabular = ['tabular-nums'] as const;

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
  const accent = orderStatusBadge(order.status).foreground;

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

  const accentBar = <View style={[styles.accent, { backgroundColor: accent }]} />;

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
        {accentBar}
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.card, highlighted && styles.cardHighlighted]}
      testID={`order_card_${order.orderNumber}`}
    >
      {accentBar}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    paddingLeft: Spacing.md + 4,
    gap: 10,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardSelected: {
    borderColor: Colors.primary,
  },
  cardHighlighted: {
    borderColor: Colors.info,
    borderWidth: 2,
    shadowColor: Colors.info,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  cardPressed: {
    backgroundColor: Colors.surfaceElevated,
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
    borderColor: Colors.infoBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  justInText: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
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
    fontFamily: Fonts.jakartaExtraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    fontVariant: tabular,
    color: Colors.textPrimary,
  },
  pinPill: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pinText: {
    ...Typography.mono,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  readOnlyNote: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
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
    fontFamily: Fonts.interSemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  customerPhone: {
    ...Typography.mono,
    fontSize: 12,
    color: Colors.textMuted,
  },
  timingBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  receivedLabel: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  elapsed: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 12,
    fontVariant: tabular,
    color: Colors.warning,
  },
  countdown: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    fontVariant: tabular,
    color: Colors.textSecondary,
  },
  countdownOverdue: {
    color: Colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorderSubtle,
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.glassFillStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: Fonts.interBold,
    fontSize: 11,
    fontVariant: tabular,
    color: Colors.primaryText,
  },
  itemName: {
    flex: 1,
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    fontVariant: tabular,
    color: Colors.textSecondary,
  },
  notes: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  rejectionReason: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.error,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  totalLabel: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 15,
    fontVariant: tabular,
    color: Colors.textPrimary,
  },
  channelPill: {
    backgroundColor: Colors.glassFillStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  channelText: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
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