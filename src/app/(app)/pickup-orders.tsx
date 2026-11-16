import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { filterLedger, orderStatusBadge, OrderFilter } from '../../lib/domain';
import { formatCurrency } from '../../lib/format';
import { useApp } from '../../state/AppProvider';
import { Colors, Layout, Radius, Spacing } from '../../theme/colors';
import { Fonts, Typography } from '../../theme/typography';
import { FilterChipOption } from '../../types';

function ledgerStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PickupOrdersScreen() {
  const router = useRouter();
  const { state, refreshData } = useApp();
  const { refreshing, onRefresh } = usePullToRefresh(refreshData);
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filterOptions = useMemo<Array<FilterChipOption<OrderFilter>>>(() => {
    const count = (status: OrderFilter) =>
      state.orders.filter((order) => order.status === status).length;
    return [
      { id: 'all', label: 'All Ledger', count: state.orders.length },
      { id: 'new', label: 'Pending', count: count('new') },
      { id: 'preparing', label: 'Preparing', count: count('preparing') },
      { id: 'ready', label: 'Ready', count: count('ready') },
      { id: 'completed', label: 'Completed', count: count('completed') },
    ];
  }, [state.orders]);

  const filteredOrders = useMemo(
    () => filterLedger(state.orders, selectedFilter, searchQuery),
    [state.orders, selectedFilter, searchQuery]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Pickup Orders Ledger"
        subtitle={`${state.activeBranch.name} • Historical audit`}
        right={
          <View style={styles.recordsPill}>
            <Text style={styles.recordsText}>{state.orders.length} Records</Text>
          </View>
        }
        bottom={
          <ActionButton
            label="‹  BACK TO ORDERS"
            variant="outline"
            onPress={() => router.back()}
            testID="btn_ledger_back"
          />
        }
      />

      <View style={styles.searchWrap}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by #Order, Customer, or PIN..."
          testID="ledger_search_input"
        />
      </View>

      <HorizontalFilterChips
        options={filterOptions}
        selectedId={selectedFilter}
        onSelect={setSelectedFilter}
      />

      <FlatList
        data={filteredOrders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.listContent}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surfaceElevated}
            tintColor={Colors.primary}
            title="Refreshing ledger…"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`ledger_card_${item.orderNumber}`}>
            <View
              style={[
                styles.accent,
                { backgroundColor: orderStatusBadge(item.status).foreground },
              ]}
            />
            <View style={styles.headerRow}>
              <View style={styles.idGroup}>
                <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
                <View style={styles.pinPill}>
                  <Text style={styles.pinText}>PIN {item.pickupCode}</Text>
                </View>
              </View>
              <StatusBadge status={item.status} />
            </View>

            <View style={styles.customerRow}>
              <View style={styles.customerBlock}>
                <Text style={styles.customerName}>{item.customerName}</Text>
                <Text style={styles.customerPhone}>{item.customerPhone}</Text>
              </View>
              <Text style={styles.total}>{formatCurrency(item.totalAmount)}</Text>
            </View>

            <View style={styles.itemsBox}>
              {item.items.map((line) => (
                <View key={line.id} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{line.quantity}x</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(line.unitPrice * line.quantity)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.archiveLabel}>READ-ONLY ARCHIVE</Text>
              <Text style={styles.archiveMeta}>
                {item.channel === 'online' ? 'ONLINE' : 'WALK-IN'} •{' '}
                {ledgerStamp(item.createdAt)}
              </Text>
            </View>

            {item.status === 'cancelled' && item.cancellationReason ? (
              <Text style={styles.rejectionReason}>
                Rejected: {item.cancellationReason}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛍️</Text>
            <Text style={styles.emptyTitle}>No ledger records</Text>
            <Text style={styles.emptySub}>
              Pickup tickets matching this filter will be archived here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  recordsPill: {
    backgroundColor: Colors.glassFillStrong,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordsText: {
    fontFamily: Fonts.interBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    color: Colors.textSecondary,
  },
  searchWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Layout.bottomClearance,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    paddingLeft: Spacing.md + 4,
    gap: 8,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
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
    fontFamily: Fonts.jakartaExtraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
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
  customerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  total: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  itemsBox: {
    backgroundColor: Colors.glassFill,
    borderWidth: 1,
    borderColor: Colors.surfaceBorderSubtle,
    borderRadius: Radius.md,
    padding: 8,
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemQty: {
    fontFamily: Fonts.interBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    width: 22,
    color: Colors.primaryText,
  },
  itemName: {
    flex: 1,
    fontFamily: Fonts.interMedium,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: Colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 2,
  },
  archiveLabel: {
    ...Typography.sectionLabel,
    fontSize: 9,
  },
  archiveMeta: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    color: Colors.textMuted,
  },
  rejectionReason: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.error,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    ...Typography.cardTitle,
  },
  emptySub: {
    ...Typography.cardDescription,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
