import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { OrderCard } from '../../components/OrderCard';
import { RejectOrderModal } from '../../components/RejectOrderModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useNow } from '../../hooks/useNow';
import { filterOrders, orderFilterOptions, OrderFilter } from '../../lib/domain';
import { formatCurrency } from '../../lib/format';
import { useApp } from '../../state/AppProvider';
import { Colors, Radius, Spacing } from '../../theme/colors';
import { Order } from '../../types';

export default function OrdersBoardScreen() {
  const router = useRouter();
  const {
    state,
    updateOrderStatus,
    rejectOrder,
    refreshData,
    isOwner,
  } = useApp();
  const { width } = useWindowDimensions();
  const now = useNow(30_000);
  const isTabletSplit = width >= 600;
  const { refreshing, onRefresh } = usePullToRefresh(refreshData);

  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersInitialisedRef = useRef(false);

  // SSE prepends new tickets. Highlight the newest unseen one briefly so the
  // kitchen eye is drawn to it without depending on the chime.
  useEffect(() => {
    if (!ordersInitialisedRef.current) {
      ordersInitialisedRef.current = true;
      state.orders.forEach((order) => knownOrderIdsRef.current.add(order.id));
      return;
    }

    const known = knownOrderIdsRef.current;
    const incoming = state.orders.find(
      (order) => !known.has(order.id) && order.status === 'new'
    );
    knownOrderIdsRef.current = new Set(state.orders.map((order) => order.id));

    if (!incoming) return;

    setHighlightedOrderId(incoming.id);
    const timer = setTimeout(() => setHighlightedOrderId(null), 10_000);
    return () => clearTimeout(timer);
  }, [state.orders]);

  const filterOptions = useMemo(() => orderFilterOptions(state.orders), [state.orders]);
  const filteredOrders = useMemo(
    () => filterOrders(state.orders, selectedFilter),
    [state.orders, selectedFilter]
  );
  const branchCodes = useMemo(() => {
    const byId = new Map<string, string>();
    for (const branch of state.branches) {
      byId.set(branch.id, branch.code || branch.name);
    }
    return byId;
  }, [state.branches]);

  useEffect(() => {
    if (selectedOrderId && state.orders.some((order) => order.id === selectedOrderId)) return;
    setSelectedOrderId(state.orders[0]?.id ?? null);
  }, [state.orders, selectedOrderId]);

  const selectedOrder: Order | null =
    state.orders.find((order) => order.id === selectedOrderId) ?? state.orders[0] ?? null;

  const handleAdvance = (orderId: string, status: Order['status']) => {
    void updateOrderStatus(orderId, status);
  };

  const listContentStyle = isTabletSplit ? styles.splitListContent : styles.listContent;

  const list = (
    <FlatList
      data={filteredOrders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          now={now}
          onAdvance={handleAdvance}
          onReject={isOwner ? undefined : (order) => setRejectTarget(order)}
          onSelect={isTabletSplit ? (order) => setSelectedOrderId(order.id) : undefined}
          selected={isTabletSplit && orderIsSelected(item, selectedOrder)}
          highlighted={item.id === highlightedOrderId}
          readOnly={isOwner}
          branchLabel={isOwner ? branchCodes.get(item.branchId) : undefined}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      contentContainerStyle={listContentStyle}
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Colors.primary]}
          progressBackgroundColor={Colors.surfaceElevated}
          tintColor={Colors.primary}
          title="Refreshing orders…"
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>No orders in this stage</Text>
          <Text style={styles.emptySub}>
            New tickets for this status filter will appear automatically.
          </Text>
        </View>
      }
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={isOwner ? 'Network Orders Board' : 'Orders Board'}
        subtitle={
          isOwner
            ? 'All Branches • Cross-store live board'
            : `${state.activeBranch.name} • ${state.activeBranch.code}`
        }
        right={
          <ConnectionBadge
            status={state.connection}
            pendingOutboxCount={state.outbox.length}
          />
        }
        bottom={
          <ActionButton
            label="PICKUP LEDGER"
            variant="outline"
            onPress={() => router.push('/(app)/pickup-orders')}
            style={styles.headerAction}
            testID="btn_open_ledger"
          />
        }
      />

      <HorizontalFilterChips
        options={filterOptions}
        selectedId={selectedFilter}
        onSelect={setSelectedFilter}
      />

      {isTabletSplit ? (
        <View style={styles.split}>
          <View style={styles.splitList}>{list}</View>
          <View style={styles.splitDivider} />
          <ScrollView
            style={styles.splitDetail}
            contentContainerStyle={styles.detailContent}
            showsVerticalScrollIndicator={false}
          >
            {selectedOrder ? (
              <>
                <Text style={styles.detailTitle}>Counter Hand-Off Station</Text>

                <View style={styles.pinCard}>
                  <Text style={styles.pinLabel}>CUSTOMER PICKUP PIN</Text>
                  <Text style={styles.pinCode}>{selectedOrder.pickupCode}</Text>
                </View>

                <Text style={styles.detailCustomer}>
                  Customer: {selectedOrder.customerName}
                </Text>
                <Text style={styles.detailPhone}>Phone: {selectedOrder.customerPhone}</Text>

                <View style={styles.detailDivider} />

                <Text style={styles.checklistTitle}>Kitchen Checklist:</Text>
                {selectedOrder.items.map((item) => (
                  <Text key={item.id} style={styles.checklistItem}>
                    • {item.quantity}x {item.name} (
                    {formatCurrency(item.unitPrice * item.quantity)})
                  </Text>
                ))}

                {selectedOrder.notes ? (
                  <Text style={styles.detailNote}>Note: {selectedOrder.notes}</Text>
                ) : null}

                {selectedOrder.status === 'cancelled' &&
                selectedOrder.cancellationReason ? (
                  <Text style={styles.detailRejection}>
                    Rejection reason: {selectedOrder.cancellationReason}
                  </Text>
                ) : null}

                <View style={styles.detailFooter}>
                  <Text style={styles.detailTotal}>
                    Total {formatCurrency(selectedOrder.totalAmount)}
                  </Text>
                  <StatusBadge status={selectedOrder.status} />
                </View>
              </>
            ) : (
              <View style={styles.emptyDetail}>
                <Text style={styles.emptyDetailText}>
                  Select an order to inspect pickup details
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        list
      )}

      <RejectOrderModal
        visible={rejectTarget !== null}
        order={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          const target = rejectTarget;
          setRejectTarget(null);
          if (target) void rejectOrder(target.id, reason);
        }}
      />
    </SafeAreaView>
  );
}

function orderIsSelected(order: Order, selected: Order | null): boolean {
  return selected !== null && order.id === selected.id;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerAction: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    paddingBottom: 32,
    flexGrow: 1,
  },
  splitListContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  listSeparator: {
    height: 12,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 42,
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
  split: {
    flex: 1,
    flexDirection: 'row',
  },
  splitList: {
    flex: 1.2,
  },
  splitDivider: {
    width: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  splitDetail: {
    flex: 0.8,
    backgroundColor: Colors.surface,
  },
  detailContent: {
    padding: Spacing.md,
    gap: 10,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  pinCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    padding: Spacing.md,
    gap: 2,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  pinCode: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 4,
    fontFamily: 'monospace',
    color: Colors.primary,
  },
  detailCustomer: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  detailPhone: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  checklistItem: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textPrimary,
  },
  detailNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  detailRejection: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.error,
  },
  detailFooter: {
    marginTop: 6,
    gap: 8,
  },
  detailTotal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  emptyDetail: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  emptyDetailText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
