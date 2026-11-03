import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { filterLedger, OrderFilter } from '../../lib/domain';
import { formatCurrency } from '../../lib/format';
import { useApp } from '../../state/AppProvider';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { FilterChipOption } from '../../types';

function ledgerStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PickupOrdersScreen() {
  const router = useRouter();
  const { state } = useApp();
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`ledger_card_${item.orderNumber}`}>
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
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordsText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  searchWrap: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 8,
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
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  pinPill: {
    backgroundColor: Colors.surfaceHighlight,
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  customerPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  total: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  itemsBox: {
    backgroundColor: Colors.surfaceHighlight,
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
    fontSize: 11,
    fontWeight: '800',
    width: 22,
    color: Colors.primary,
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: Colors.textMuted,
  },
  archiveMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
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
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
