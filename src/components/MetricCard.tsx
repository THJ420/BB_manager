import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { AnalyticsMetric } from '../types';

export interface MetricCardProps {
  metric: AnalyticsMetric;
}

export function MetricCard({ metric }: MetricCardProps) {
  return (
    <View style={styles.card} testID={`metric_${metric.key}`}>
      <View style={[styles.stripe, { backgroundColor: metric.accentColor }]} />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {metric.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: `${metric.accentColor}26` }]}>
            <Text style={[styles.badgeText, { color: metric.accentColor }]} numberOfLines={1}>
              {metric.badge}
            </Text>
          </View>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {metric.value}
          </Text>
          <Text style={styles.icon}>{metric.icon}</Text>
        </View>

        <Text style={styles.subtitle} numberOfLines={2}>
          {metric.subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    minHeight: 116,
  },
  stripe: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
    gap: 4,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  title: {
    flex: 1,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: '52%',
  },
  badgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  value: {
    flex: 1,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
  },
  icon: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
