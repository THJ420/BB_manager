import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency } from '../lib/format';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Order } from '../types';
import { ActionButton } from './ActionButton';

export interface IncomingOrderCallModalProps {
  order: Order | null;
  onAccept: (order: Order) => void;
  onReject: (order: Order) => void;
}

/**
 * Full-screen incoming-call treatment for a new SSE ticket. The alarm loops
 * until Accept or Reject is tapped; Android back cannot dismiss it silently.
 */
export function IncomingOrderCallModal({
  order,
  onAccept,
  onReject,
}: IncomingOrderCallModalProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!order) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [order, pulse]);

  if (!order) return null;

  const itemsSummary =
    order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ') ||
    'No items listed';

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}
    >
      <SafeAreaView style={styles.safe} accessibilityViewIsModal>
        <View style={styles.topBar}>
          <View style={styles.liveDot} />
          <Text style={styles.topLabel}>RADHUNI TERMINAL · INCOMING ORDER</Text>
        </View>

        <View style={styles.hero}>
          <Animated.View style={[styles.ringOuter, { transform: [{ scale: pulse }] }]}>
            <View style={styles.ringInner}>
              <Text style={styles.ringIcon}>🔔</Text>
            </View>
          </Animated.View>

          <Text style={styles.callingLabel}>INCOMING PICKUP ORDER</Text>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customerName}
          </Text>
          <Text style={styles.customerPhone}>{order.customerPhone}</Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ORDER TOTAL</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>ITEMS</Text>
          <Text style={styles.items} numberOfLines={4}>
            {itemsSummary}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>PIN {order.pickupCode}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>
                {order.channel === 'online' ? 'ONLINE' : 'WALK-IN'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionButton
            label="REJECT"
            variant="danger"
            icon="✕"
            onPress={() => onReject(order)}
            style={styles.action}
            testID="incoming_reject"
            accessibilityHint="Open the mandatory rejection reason list"
          />
          <ActionButton
            label="ACCEPT"
            variant="success"
            icon="✓"
            onPress={() => onAccept(order)}
            style={styles.action}
            testID="incoming_accept"
            accessibilityHint="Accept this order and start kitchen preparation"
          />
        </View>

        <Text style={styles.hint}>
          Accept starts kitchen prep · Reject requires a reason
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#09090B',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  topLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: Colors.textSecondary,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ringOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  ringInner: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringIcon: {
    fontSize: 52,
  },
  callingLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: Colors.info,
  },
  orderNumber: {
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: Colors.textPrimary,
  },
  customerName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    maxWidth: '90%',
  },
  customerPhone: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  items: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  metaPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.md,
  },
  action: {
    flex: 1,
    minHeight: 62,
  },
  hint: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
