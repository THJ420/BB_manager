import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { ConnectionStatus } from '../types';

const STATUS_META: Record<ConnectionStatus, { label: string; color: string; background: string }> = {
  live: { label: 'ONLINE', color: Colors.success, background: Colors.successMuted },
  polling: { label: 'SYNCING', color: Colors.warning, background: Colors.warningMuted },
  offline: { label: 'OFFLINE', color: Colors.error, background: Colors.errorMuted },
};

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
  pendingOutboxCount: number;
}

export function ConnectionBadge({ status, pendingOutboxCount }: ConnectionBadgeProps) {
  const meta = STATUS_META[status];

  return (
    <View style={styles.row}>
      <View
        style={[styles.badge, { backgroundColor: meta.background, borderColor: meta.color }]}
        accessibilityLabel={`Connection ${meta.label}`}
        testID="connection_badge"
      >
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        <Text style={[styles.label, { color: meta.color }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </View>

      {pendingOutboxCount > 0 ? (
        <View style={styles.queueBadge}>
          <Text style={styles.queueText}>{pendingOutboxCount} queued</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  queueBadge: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  queueText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.warning,
  },
});
