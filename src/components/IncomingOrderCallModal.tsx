import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatCurrency } from '../lib/format';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
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
    backgroundColor: Colors.background,
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
    shadowColor: Colors.success,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  topLabel: {
    ...Typography.sectionLabel,
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
    shadowColor: Colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  ringIcon: {
    fontSize: 52,
  },
  callingLabel: {
    fontFamily: Fonts.interBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.info,
  },
  orderNumber: {
    fontFamily: Fonts.jakartaExtraBold,
    fontSize: 46,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  customerName: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 22,
    color: Colors.textPrimary,
    maxWidth: '90%',
  },
  customerPhone: {
    ...Typography.mono,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
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
    ...Typography.sectionLabel,
    color: Colors.textSecondary,
  },
  totalValue: {
    ...Typography.metricValue,
    color: Colors.success,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorderSubtle,
  },
  sectionLabel: {
    ...Typography.sectionLabel,
    color: Colors.textSecondary,
  },
  items: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  metaPill: {
    backgroundColor: Colors.glassFillStrong,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
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
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
  },
});
