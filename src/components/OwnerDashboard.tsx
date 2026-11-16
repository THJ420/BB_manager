import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from './ActionButton';
import { AddStoreModal } from './AddStoreModal';
import { AnalyticsDateRangeModal } from './AnalyticsDateRangeModal';
import { HorizontalFilterChips } from './HorizontalFilterChips';
import { MetricCard } from './MetricCard';
import { ScreenHeader } from './ScreenHeader';
import { UpdateCheckButton } from './UpdateCheckButton';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useNow } from '../hooks/useNow';
import {
  AnalyticsDateRange,
  AnalyticsRangePreset,
  computeAnalytics,
  filterOrdersByRange,
  getDefaultCustomRange,
  mergeAnalyticsOrders,
  resolveAnalyticsRange,
} from '../lib/analytics';
import { formatCurrency, formatPercent } from '../lib/format';
import {
  branchCity,
  branchDisplayName,
  branchSearchKey,
  decodeHtmlEntities,
} from '../lib/branchLabel';
import { useApp } from '../state/AppProvider';
import { CreateBranchInput, createOwnerBranch } from '../services/branches';
import { Colors, Layout, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { AnalyticsMetric, FilterChipOption, Reservation } from '../types';

const RANGE_OPTIONS: Array<FilterChipOption<AnalyticsRangePreset>> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

function reservationTimestamp(reservation: Reservation): number {
  return Date.parse(reservation.reservationAt ?? reservation.reservationTime);
}

export function OwnerDashboard() {
  const router = useRouter();
  const { state, refreshData, refreshOwnerData, logout, enterOwnerBranch } = useApp();
  const now = useNow(60_000);
  const { refreshing, onRefresh } = usePullToRefresh(refreshData);
  const [rangePreset, setRangePreset] = useState<AnalyticsRangePreset>('today');
  const [customRange, setCustomRange] = useState<AnalyticsDateRange | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [storeQuery, setStoreQuery] = useState('');
  const [addStoreVisible, setAddStoreVisible] = useState(false);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  const range = useMemo(
    () => resolveAnalyticsRange(rangePreset, customRange, now),
    [rangePreset, customRange, now]
  );
  const defaultCustomRange = useMemo(() => getDefaultCustomRange(now), [now]);

  const rangeOrders = useMemo(() => {
    const allOrders = mergeAnalyticsOrders(state.orders, state.analyticsHistory);
    return filterOrdersByRange(allOrders, range);
  }, [state.orders, state.analyticsHistory, range]);

  const scopedOrders = useMemo(
    () =>
      branchFilter === 'all'
        ? rangeOrders
        : rangeOrders.filter((order) => order.branchId === branchFilter),
    [rangeOrders, branchFilter]
  );
  const summary = useMemo(() => computeAnalytics(scopedOrders), [scopedOrders]);

  const rangeReservations = useMemo(
    () =>
      state.reservations.filter((reservation) => {
        if (reservation.status === 'cancelled') return false;
        const timestamp = reservationTimestamp(reservation);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= range.start &&
          timestamp <= range.end
        );
      }),
    [state.reservations, range]
  );
  const scopedReservations = useMemo(
    () =>
      branchFilter === 'all'
        ? rangeReservations
        : rangeReservations.filter(
            (reservation) => reservation.branchId === branchFilter
          ),
    [rangeReservations, branchFilter]
  );

  const selectedBranch = state.branches.find((branch) => branch.id === branchFilter);
  const scopeLabel = selectedBranch ? branchDisplayName(selectedBranch) : 'All Branches';

  const visibleBranches = useMemo(() => {
    const query = branchSearchKey(storeQuery);
    if (!query) return state.branches;
    return state.branches.filter((branch) =>
      branchSearchKey(
        [
          branch.name,
          branch.code,
          branchCity(branch),
          branch.address,
          branchDisplayName(branch),
        ].join(' ')
      ).includes(query)
    );
  }, [state.branches, storeQuery]);

  const applyStoreQuery = (value: string) => {
    setStoreQuery(value);
    if (branchFilter === 'all') return;
    const query = branchSearchKey(value);
    const stillVisible =
      !query ||
      visibleBranches.some(
        (branch) =>
          branch.id === branchFilter &&
          branchSearchKey(
            [branch.name, branch.code, branchCity(branch), branch.address].join(' ')
          ).includes(query)
      );
    if (!stillVisible) setBranchFilter('all');
  };

  const branchChips = useMemo<Array<FilterChipOption<string>>>(() => {
    const byBranch = new Map<string, number>();
    for (const order of rangeOrders) {
      byBranch.set(order.branchId, (byBranch.get(order.branchId) ?? 0) + 1);
    }
    return [
      { id: 'all', label: 'All Branches', count: rangeOrders.length },
      ...visibleBranches.map((branch) => ({
        id: branch.id,
        label: branch.code ? branch.code.toLowerCase() : branch.name,
        count: byBranch.get(branch.id) ?? 0,
      })),
    ];
  }, [visibleBranches, rangeOrders]);

  const networkStats = useMemo(() => {
    const tradingIds = new Set(rangeOrders.map((order) => order.branchId));
    const trading = state.branches.filter((branch) => tradingIds.has(branch.id)).length;
    return {
      activeStores: state.branches.filter((branch) => branch.isActive).length,
      totalStores: state.branches.length,
      trading,
      idle: state.branches.length - trading,
    };
  }, [state.branches, rangeOrders]);

  const syncMeta = useMemo(() => {
    const pending = state.outbox.length;
    const suffix = pending > 0 ? ` • ${pending} queued` : '';
    if (!state.lastSyncedAt) return `Awaiting first sync${suffix}`;
    const minutes = Math.max(0, Math.round((now - state.lastSyncedAt) / 60_000));
    const age = minutes < 1 ? 'just now' : `${minutes}m ago`;
    return `Synced ${age}${suffix}`;
  }, [state.lastSyncedAt, state.outbox.length, now]);

  const healthLabel =
    state.connection === 'live'
      ? 'LIVE'
      : state.connection === 'polling'
        ? 'POLLING'
        : 'OFFLINE';
  const healthColor =
    state.connection === 'live'
      ? Colors.success
      : state.connection === 'polling'
        ? Colors.warning
        : Colors.error;

  const branchRows = useMemo(
    () =>
      visibleBranches
        .map((branch) => {
          const orders = rangeOrders.filter((order) => order.branchId === branch.id);
          const analytics = computeAnalytics(orders);
          const reservations = rangeReservations.filter(
            (reservation) => reservation.branchId === branch.id
          ).length;
          return {
            branch,
            orders: analytics.totalOrders,
            revenue: analytics.salesTotal,
            reservations,
            cancellationRate: analytics.cancellationRate,
            activeTickets: analytics.activeTickets,
          };
        })
        .sort((a, b) => b.revenue - a.revenue),
    [visibleBranches, rangeOrders, rangeReservations]
  );

  const metrics = useMemo<AnalyticsMetric[]>(
    () => [
      {
        key: 'owner-revenue',
        title: 'NETWORK REVENUE',
        value: formatCurrency(summary.salesTotal),
        subtitle: `${scopeLabel} • ${range.label}`,
        accentColor: Colors.success,
        badge: 'GROSS',
        icon: '💵',
      },
      {
        key: 'owner-orders',
        title: 'TOTAL ORDERS',
        value: String(summary.totalOrders),
        subtitle: `${summary.completedCount} completed • ${summary.statusCounts.cancelled} rejected`,
        accentColor: Colors.primary,
        badge: 'ORDERS',
        icon: '🧾',
      },
      {
        key: 'owner-reservations',
        title: 'RESERVATIONS',
        value: String(scopedReservations.length),
        subtitle: `${
          scopedReservations.filter((entry) => entry.status === 'upcoming').length
        } upcoming • ${scopeLabel}`,
        accentColor: Colors.warning,
        badge: 'BOOKINGS',
        icon: '📅',
      },
      {
        key: 'owner-average-ticket',
        title: 'AVG ORDER',
        value: formatCurrency(summary.averageTicket),
        subtitle: `${summary.totalOrders} tickets in range`,
        accentColor: Colors.primary,
        badge: 'ARPT',
        icon: '📈',
      },
      {
        key: 'owner-cancel-rate',
        title: 'REJECTION RATE',
        value: formatPercent(summary.cancellationRate),
        subtitle: 'Threshold: < 5.0%',
        accentColor: summary.cancellationRate > 5 ? Colors.error : Colors.success,
        badge: 'HEALTH',
        icon: '⚠️',
      },
      {
        key: 'owner-live',
        title: 'LIVE TICKETS',
        value: String(summary.activeTickets),
        subtitle: `${summary.statusCounts.ready} ready for pickup`,
        accentColor: Colors.warning,
        badge: 'NOW',
        icon: '🔥',
      },
    ],
    [summary, scopedReservations, range.label, scopeLabel]
  );

  const handleRangeSelect = (preset: AnalyticsRangePreset) => {
    if (preset === 'custom') {
      setDateModalVisible(true);
      return;
    }
    setRangePreset(preset);
  };

  const handleCreateStore = async (values: CreateBranchInput) => {
    const created = await createOwnerBranch(
      values,
      state.branches.map((branch) => branch.code)
    );
    await refreshOwnerData();
    setStoreNotice(`${created.code} created — syncing to the storefront.`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Owner Command Center"
        subtitle={`${scopeLabel} • ${range.label}`}
        right={
          <View style={styles.ownerBadge}>
            <View style={styles.ownerDot} />
            <Text style={styles.ownerBadgeText}>SUPER ADMIN</Text>
          </View>
        }
      />

      <View style={styles.searchShell}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={storeQuery}
              onChangeText={applyStoreQuery}
              placeholder="Search store, city or branch code"
              placeholderTextColor={Colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search stores by name, city or branch code"
              testID="owner_store_search"
            />
            {storeQuery.length > 0 ? (
              <Pressable
                onPress={() => applyStoreQuery('')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear store search"
                testID="btn_owner_store_search_clear"
                style={({ pressed }) => [styles.searchClear, pressed && styles.searchClearPressed]}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <ActionButton
            label="+ ADD STORE"
            variant="primary"
            compact
            onPress={() => {
              setStoreNotice(null);
              setAddStoreVisible(true);
            }}
            testID="btn_owner_add_store"
          />
        </View>
        {storeNotice ? (
          <Text style={styles.storeNotice} testID="owner_store_notice">
            {storeNotice}
          </Text>
        ) : null}
        {storeQuery.trim() ? (
          <Text style={styles.searchMeta} testID="owner_store_search_count">
            {visibleBranches.length} of {state.branches.length} stores match
          </Text>
        ) : null}
      </View>

      <HorizontalFilterChips
        options={RANGE_OPTIONS}
        selectedId={rangePreset}
        onSelect={handleRangeSelect}
      />

      <HorizontalFilterChips
        options={branchChips}
        selectedId={branchFilter}
        onSelect={setBranchFilter}
      />

      <View style={styles.rangeSummary}>
        <View style={styles.rangeSummaryText}>
          <Text style={styles.rangeSummaryLabel}>REPORTING WINDOW</Text>
          <Text style={styles.rangeSummaryValue}>{range.label}</Text>
        </View>
        <ActionButton
          label="EDIT DATES"
          variant="outline"
          compact
          onPress={() => setDateModalVisible(true)}
          testID="btn_owner_date_range"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surfaceElevated}
            tintColor={Colors.primary}
            title="Refreshing network…"
          />
        }
      >
        <View style={styles.statStrip}>
          <View style={styles.statStripCell}>
            <Text style={styles.statStripLabel}>ACTIVE STORES</Text>
            <Text style={styles.statStripValue}>{networkStats.activeStores}</Text>
            <Text style={styles.statStripMeta}>
              {networkStats.totalStores} in network
            </Text>
          </View>
          <View style={styles.statStripCell}>
            <Text style={styles.statStripLabel}>TRADING</Text>
            <Text style={styles.statStripValue}>{networkStats.trading}</Text>
            <Text style={styles.statStripMeta}>{networkStats.idle} idle in range</Text>
          </View>
          <View style={styles.statStripCell}>
            <Text style={styles.statStripLabel}>NETWORK</Text>
            <Text style={[styles.statStripValue, { color: healthColor }]}>
              {healthLabel}
            </Text>
            <Text style={styles.statStripMeta} numberOfLines={1}>
              {syncMeta}
            </Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricCell}>
              <MetricCard metric={metric} />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>BRANCH LEADERBOARD</Text>
            <Text style={styles.cardMeta}>
              {branchFilter === 'all' ? 'TAP A BRANCH TO MANAGE' : 'DRILLED DOWN'}
            </Text>
          </View>

          {branchRows.map((row) => {
            const selected = branchFilter === row.branch.id;
            const displayName = branchDisplayName(row.branch);
            const address = decodeHtmlEntities(row.branch.address ?? '')
              .replace(/\s+/g, ' ')
              .trim();
            const rejected =
              row.cancellationRate > 0
                ? `${formatPercent(row.cancellationRate)} rejected`
                : '';
            const detail = [address, rejected].filter(Boolean).join(' • ');
            return (
              <Pressable
                key={row.branch.id}
                onPress={() => void enterOwnerBranch(row.branch)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${displayName} management, ${row.orders} orders, ${formatCurrency(
                  row.revenue
                )} revenue`}
                testID={`owner_branch_${row.branch.code || row.branch.id}`}
                style={({ pressed }) => [
                  styles.branchRow,
                  selected && styles.branchRowSelected,
                  pressed && styles.branchRowPressed,
                ]}
              >
                <View style={styles.branchIdentity}>
                  <Text style={styles.branchCode} numberOfLines={1}>
                    {row.branch.code || '—'}
                  </Text>
                  <Text style={styles.branchName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {detail ? (
                    <Text style={styles.branchMeta} numberOfLines={1}>
                      {detail}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.branchStats}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>ORDERS</Text>
                    <Text style={styles.numberValue}>{row.orders}</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>RES.</Text>
                    <Text style={styles.numberValue}>{row.reservations}</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>LIVE</Text>
                    <Text style={styles.numberValue}>{row.activeTickets}</Text>
                  </View>
                  <View style={[styles.statCell, styles.statCellRevenue]}>
                    <Text style={styles.statLabel}>REVENUE</Text>
                    <Text style={styles.revenueValue} numberOfLines={1}>
                      {formatCurrency(row.revenue)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}

          {branchRows.length === 0 ? (
            <Text style={styles.emptyText}>
              {storeQuery.trim()
                ? `No store matches “${storeQuery.trim()}”. Try a city or branch code such as EDK-POZNAN.`
                : 'No branches are available for this account yet.'}
            </Text>
          ) : null}
        </View>

        {branchFilter !== 'all' ? (
          <ActionButton
            label="‹  SHOW ALL BRANCHES"
            variant="outline"
            fullWidth
            onPress={() => setBranchFilter('all')}
            testID="btn_owner_clear_branch"
          />
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>SYSTEM INFO</Text>
          </View>
          <UpdateCheckButton />
        </View>

        <ActionButton
          label="SIGN OUT"
          variant="dangerOutline"
          fullWidth
          onPress={() => {
            void logout().then(() => router.replace('/login'));
          }}
          testID="btn_owner_logout"
        />
      </ScrollView>

      <AnalyticsDateRangeModal
        visible={dateModalVisible}
        now={now}
        initialStart={customRange?.start ?? defaultCustomRange.start}
        initialEnd={customRange?.end ?? defaultCustomRange.end}
        onClose={() => setDateModalVisible(false)}
        onApply={(next) => {
          setCustomRange(next);
          setRangePreset('custom');
          setDateModalVisible(false);
        }}
      />

      <AddStoreModal
        visible={addStoreVisible}
        existingCodes={state.branches.map((branch) => branch.code)}
        onClose={() => setAddStoreVisible(false)}
        onSubmit={handleCreateStore}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ownerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  ownerBadgeText: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: Colors.primaryText,
  },
  searchShell: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: 4,
    backgroundColor: Colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: Layout.minTouch,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.glassBorderStrong,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    minHeight: Layout.minTouch,
    paddingVertical: 0,
    fontFamily: Fonts.interMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassFillStrong,
  },
  searchClearPressed: {
    opacity: 0.7,
  },
  searchClearText: {
    fontFamily: Fonts.interBold,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchMeta: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  storeNotice: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.success,
    paddingHorizontal: 4,
  },
  rangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  rangeSummaryText: {
    flex: 1,
    gap: 2,
  },
  rangeSummaryLabel: {
    ...Typography.sectionLabel,
    fontSize: 9,
  },
  rangeSummaryValue: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Layout.bottomClearance,
    gap: Spacing.md,
  },
  statStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statStripCell: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 10,
    gap: 2,
  },
  statStripLabel: {
    ...Typography.sectionLabel,
    fontSize: 9,
  },
  statStripValue: {
    fontFamily: Fonts.jakartaExtraBold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  statStripMeta: {
    fontFamily: Fonts.interRegular,
    fontSize: 9,
    color: Colors.textMuted,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 160,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.sectionLabel,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardMeta: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  branchRow: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorderSubtle,
  },
  branchIdentity: {
    gap: 2,
  },
  branchStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  statCell: {
    flex: 1,
    gap: 1,
  },
  statCellRevenue: {
    flex: 1.6,
  },
  statLabel: {
    fontFamily: Fonts.interBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  branchRowSelected: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  branchRowPressed: {
    opacity: 0.8,
  },
  branchCode: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.primaryText,
  },
  branchName: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
  },
  branchMeta: {
    fontFamily: Fonts.interRegular,
    fontSize: 9,
    color: Colors.textMuted,
  },
  numberValue: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  revenueValue: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: Colors.success,
  },
  emptyText: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    paddingVertical: Spacing.md,
  },
});
