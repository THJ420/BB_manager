import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { AnalyticsMetric } from '../types';

export interface MetricCardProps {
  metric: AnalyticsMetric;
}

/** Bento KPI tile: uppercase descriptor, accent trend pill, Jakarta metric figure. */
export function MetricCard({ metric }: MetricCardProps) {
  return (
    <View style={styles.card} testID={`metric_${metric.key}`}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {metric.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: `${metric.accentColor}1F` }]}>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 14,
    gap: 8,
    minHeight: 116,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  title: {
    ...Typography.sectionLabel,
    flex: 1,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '52%',
  },
  badgeText: {
    fontFamily: Fonts.interBold,
    fontSize: 8,
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  value: {
    ...Typography.metricValue,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
});