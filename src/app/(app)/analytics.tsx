import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { AnalyticsDateRangeModal } from '../../components/AnalyticsDateRangeModal';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { MetricCard } from '../../components/MetricCard';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useNow } from '../../hooks/useNow';
import {
  analyticsMetrics,
  AnalyticsDateRange,
  AnalyticsRangePreset,
  computeAnalytics,
  EfficiencyGradeTone,
  filterOrdersByRange,
  getDefaultCustomRange,
  getEfficiencyGrade,
  mergeAnalyticsOrders,
  resolveAnalyticsRange,
} from '../../lib/analytics';
import { formatCurrency, formatPercent } from '../../lib/format';
import { useApp } from '../../state/AppProvider';
import { OwnerDashboard } from '../../components/OwnerDashboard';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { FilterChipOption } from '../../types';

const RANGE_OPTIONS: Array<FilterChipOption<AnalyticsRangePreset>> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const EFFICIENCY_TONES: Record<
  EfficiencyGradeTone,
  { accent: string; background: string; border: string }
> = {
  success: {
    accent: Colors.success,
    background: Colors.successMuted,
    border: Colors.successBorder,
  },
  primary: {
    accent: Colors.primary,
    background: Colors.primaryMuted,
    border: Colors.primaryBorder,
  },
  warning: {
    accent: Colors.warning,
    background: Colors.warningMuted,
    border: Colors.warningBorder,
  },
  error: {
    accent: Colors.error,
    background: Colors.errorMuted,
    border: Colors.errorBorder,
  },
  neutral: {
    accent: Colors.textSecondary,
    background: Colors.surfaceHighlight,
    border: Colors.surfaceBorder,
  },
};

export default function AnalyticsScreen() {
  const { state, isOwner } = useApp();
  const now = useNow(60_000);
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>('today');
  const [customRange, setCustomRange] = useState<AnalyticsDateRange | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const allOrders = useMemo(
    () => mergeAnalyticsOrders(state.orders, state.analyticsHistory),
    [state.orders, state.analyticsHistory]
  );
  const range = useMemo(
    () => resolveAnalyticsRange(rangePreset, customRange, now),
    [rangePreset, customRange, now]
  );
  const filteredOrders = useMemo(
    () => filterOrdersByRange(allOrders, range),
    [allOrders, range]
  );
  const summary = useMemo(() => computeAnalytics(filteredOrders), [filteredOrders]);
  const metrics = useMemo(
    () => analyticsMetrics(summary, { rangePreset, rangeLabel: range.label }),
    [summary, rangePreset, range.label]
  );
  const efficiencyGrade = useMemo(
    () => getEfficiencyGrade(summary.staffEfficiency, summary.totalOrders),
    [summary.staffEfficiency, summary.totalOrders]
  );
  const efficiencyTone = EFFICIENCY_TONES[efficiencyGrade.tone];
  const defaultCustomRange = useMemo(() => getDefaultCustomRange(now), [now]);

  if (isOwner) {
    return <OwnerDashboard />;
  }

  const handleRangeSelect = (preset: AnalyticsRangePreset) => {
    if (preset === 'custom') {
      setDateModalVisible(true);
      return;
    }
    setRangePreset(preset);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Floor Analytics"
        subtitle={`${state.activeBranch.name} • Shift Performance`}
        right={
          <View style={styles.shiftBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.shiftText}>LIVE SHIFT</Text>
          </View>
        }
      />

      <HorizontalFilterChips
        options={RANGE_OPTIONS}
        selectedId={rangePreset}
        onSelect={handleRangeSelect}
      />

      <View style={styles.rangeSummary}>
        <View style={styles.rangeSummaryText}>
          <Text style={styles.rangeSummaryLabel}>ANALYTICS WINDOW</Text>
          <Text style={styles.rangeSummaryValue}>{range.label}</Text>
        </View>
        <ActionButton
          label="EDIT DATES"
          variant="outline"
          compact
          onPress={() => setDateModalVisible(true)}
          testID="btn_analytics_date_range"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricCell}>
              <MetricCard metric={metric} />
            </View>
          ))}
        </View>

        <View style={styles.efficiencyCard}>
          <View style={styles.efficiencyRow}>
            <View style={styles.efficiencyText}>
              <Text style={styles.sectionLabel}>STAFF SHIFT EFFICIENCY SCORE</Text>
              <View style={styles.efficiencyValueRow}>
                <Text style={[styles.efficiencyValue, { color: efficiencyTone.accent }]}>
                  {summary.staffEfficiency.toFixed(1)}%
                </Text>
                <Text
                  style={[styles.efficiencyNote, { color: efficiencyTone.accent }]}
                >
                  {efficiencyGrade.status}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.gradePill,
                {
                  backgroundColor: efficiencyTone.background,
                  borderColor: efficiencyTone.border,
                },
              ]}
            >
              <Text style={[styles.gradeText, { color: efficiencyTone.accent }]}>
                {efficiencyGrade.letter ? `GRADE ${efficiencyGrade.letter}` : 'NO DATA'}
              </Text>
            </View>
          </View>
          <Text style={styles.efficiencySub}>
            Derived from prep SLA, void rate and live kitchen load across the selected range.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>PEAK ORDER HOURS BREAKDOWN</Text>
            <Text style={styles.cardMeta}>
              {summary.peakHour.orderCount > 0
                ? `🔥 ${summary.peakHour.orderCount} PEAK ORDERS`
                : 'NO PEAK DATA'}
            </Text>
          </View>

          <View style={styles.peakList}>
            {summary.peakBuckets.map((bucket) => (
              <View key={bucket.timeSlot} style={styles.peakRow}>
                <View style={styles.peakMetaRow}>
                  <View style={styles.peakLabelGroup}>
                    <Text style={[styles.peakSlot, bucket.isPeak && styles.peakSlotActive]}>
                      {bucket.timeSlot}
                    </Text>
                    {bucket.isPeak ? (
                      <View style={styles.peakBadge}>
                        <Text style={styles.peakBadgeText}>PEAK RUSH</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.peakVolume}>
                    {bucket.orderCount} orders • {formatCurrency(bucket.revenue)}
                  </Text>
                </View>

                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        flex: Math.max(1, bucket.percentage),
                        backgroundColor: bucket.isPeak ? Colors.warning : Colors.primary,
                      },
                    ]}
                  />
                  <View style={{ flex: Math.max(1, 100 - bucket.percentage) }} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>KITCHEN TICKET DISTRIBUTION</Text>
            <Text style={styles.cardMeta}>{summary.totalOrders} TOTAL TICKETS</Text>
          </View>

          <View style={styles.distributionBar}>
            {summary.totalOrders > 0 ? (
              <>
                <View
                  style={[
                    styles.distributionSegment,
                    { flex: summary.statusCounts.new, backgroundColor: Colors.info },
                  ]}
                />
                <View
                  style={[
                    styles.distributionSegment,
                    { flex: summary.statusCounts.preparing, backgroundColor: Colors.warning },
                  ]}
                />
                <View
                  style={[
                    styles.distributionSegment,
                    { flex: summary.statusCounts.ready, backgroundColor: Colors.success },
                  ]}
                />
                <View
                  style={[
                    styles.distributionSegment,
                    { flex: summary.statusCounts.completed, backgroundColor: Colors.slate },
                  ]}
                />
                <View
                  style={[
                    styles.distributionSegment,
                    { flex: summary.statusCounts.cancelled, backgroundColor: Colors.error },
                  ]}
                />
              </>
            ) : (
              <View
                style={[
                  styles.distributionSegment,
                  { flex: 1, backgroundColor: Colors.surfaceHighlight },
                ]}
              />
            )}
          </View>

          <View style={styles.breakdownList}>
            <BreakdownRow
              label="New Unacknowledged"
              count={summary.statusCounts.new}
              color={Colors.info}
            />
            <BreakdownRow
              label="In Kitchen Preparation"
              count={summary.statusCounts.preparing}
              color={Colors.warning}
            />
            <BreakdownRow
              label="Ready on Counter Shelf"
              count={summary.statusCounts.ready}
              color={Colors.success}
            />
            <BreakdownRow
              label="Completed & Picked Up"
              count={summary.statusCounts.completed}
              color={Colors.slate}
            />
            <BreakdownRow
              label="Voided / Cancelled"
              count={summary.statusCounts.cancelled}
              color={Colors.error}
              last
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SHIFT LEDGER SNAPSHOT</Text>
          <View style={styles.snapshotGrid}>
            <SnapshotTile label="Revenue" value={formatCurrency(summary.salesTotal)} />
            <SnapshotTile
              label="Void rate"
              value={formatPercent(summary.cancellationRate)}
            />
            <SnapshotTile
              label="Avg prep"
              value={`${summary.averagePrepMinutes.toFixed(1)}m`}
            />
            <SnapshotTile
              label="Net est."
              value={formatCurrency(summary.netProfitEstimate)}
            />
          </View>
        </View>

        <View style={styles.advisory}>
          <Text style={styles.advisoryLabel}>SPEED OF SERVICE ADVISORY</Text>
          <Text style={styles.advisoryText}>
            Current kitchen throughput is operating at {summary.staffEfficiency.toFixed(1)}%
            efficiency. Counter shelf turnaround time is under 3 minutes per ready pickup ticket.
          </Text>
        </View>
      </ScrollView>

      <AnalyticsDateRangeModal
        visible={dateModalVisible}
        now={now}
        initialStart={customRange?.start ?? defaultCustomRange.start}
        initialEnd={customRange?.end ?? defaultCustomRange.end}
        onClose={() => setDateModalVisible(false)}
        onApply={(nextRange) => {
          setCustomRange(nextRange);
          setRangePreset('custom');
          setDateModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

function BreakdownRow({
  label,
  count,
  color,
  last = false,
}: {
  label: string;
  count: number;
  color: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.breakdownRow, !last && styles.breakdownRowBorder]}>
      <View style={styles.breakdownLabelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.breakdownLabel}>{label}</Text>
      </View>
      <Text style={styles.breakdownValue}>{count} tickets</Text>
    </View>
  );
}

function SnapshotTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapshotTile}>
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  shiftText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: Colors.success,
  },
  rangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  rangeSummaryText: {
    flex: 1,
    gap: 2,
  },
  rangeSummaryLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  rangeSummaryValue: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 32,
    gap: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  metricCell: {
    width: '48%',
  },
  efficiencyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 6,
  },
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  efficiencyText: {
    flex: 1,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  efficiencyValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  efficiencyValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  efficiencyNote: {
    fontSize: 10,
    fontWeight: '800',
    paddingBottom: 3,
  },
  gradePill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gradeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  efficiencySub: {
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  peakList: {
    gap: 10,
  },
  peakRow: {
    gap: 5,
  },
  peakMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  peakLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  peakSlot: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  peakSlotActive: {
    color: Colors.warning,
    fontWeight: '900',
  },
  peakBadge: {
    backgroundColor: Colors.warningMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  peakBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: Colors.warning,
    letterSpacing: 0.4,
  },
  peakVolume: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceHighlight,
  },
  barFill: {
    height: '100%',
  },
  distributionBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceHighlight,
    marginVertical: 4,
  },
  distributionSegment: {
    height: '100%',
  },
  breakdownList: {
    gap: 2,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 8,
  },
  breakdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  snapshotTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
    gap: 2,
  },
  snapshotLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  snapshotValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  advisory: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    padding: 14,
    gap: 4,
  },
  advisoryLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.primary,
  },
  advisoryText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
