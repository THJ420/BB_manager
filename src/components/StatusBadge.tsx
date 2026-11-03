import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { orderStatusBadge } from '../lib/domain';
import { OrderStatus } from '../types';

export interface StatusBadgeProps {
  status: OrderStatus;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const meta = orderStatusBadge(status);

  return (
    <View style={[styles.badge, { backgroundColor: meta.background }, style]}>
      <View style={[styles.dot, { backgroundColor: meta.foreground }]} />
      <Text style={[styles.label, { color: meta.foreground }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
