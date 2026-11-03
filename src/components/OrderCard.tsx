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
  onSelect?: (order: Order) => void;
  selected?: boolean;
}

const ACTION_VARIANT: Record<'new' | 'preparing' | 'ready', ButtonVariant> = {
  new: 'primary',
  preparing: 'success',
  ready: 'slate',
};

export function OrderCard({ order, now, onAdvance, onSelect, selected }: OrderCardProps) {
  const timing = orderTiming(order, now);
  const action = orderAction(order.status);
  const variant = action && order.status !== 'completed' && order.status !== 'cancelled'
    ? ACTION_VARIANT[order.status as 'new' | 'preparing' | 'ready']
    : 'primary';

  const content = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.idGroup}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <View style={styles.pinPill}>
            <Text style={styles.pinText}>PIN {order.pickupCode}</Text>
          </View>
        </View>
        <StatusBadge status={order.status} />
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

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total: {formatCurrency(order.totalAmount)}</Text>
        <View style={styles.channelPill}>
          <Text style={styles.channelText}>
            {order.channel === 'online' ? 'ONLINE' : 'WALK-IN'}
          </Text>
        </View>
      </View>

      {action ? (
        <ActionButton
          label={action.label}
          variant={variant}
          fullWidth
          onPress={() => onAdvance(order.id, action.next)}
          testID={`btn_${action.next}_${order.orderNumber}`}
          accessibilityHint={`Move order ${order.orderNumber} to ${action.next}`}
        />
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <Pressable
        onPress={() => onSelect(order)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.orderNumber}, ${order.status}`}
        testID={`order_card_${order.orderNumber}`}
        style={({ pressed }) => [
          styles.card,
          selected && styles.cardSelected,
          pressed && styles.cardPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.card} testID={`order_card_${order.orderNumber}`}>
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
  cardPressed: {
    backgroundColor: Colors.surfaceHighlight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
});
