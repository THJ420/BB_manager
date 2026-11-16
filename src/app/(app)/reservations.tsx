import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { ReservationCard } from '../../components/ReservationCard';
import { ReservationDetailsModal } from '../../components/ReservationDetailsModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  filterReservations,
  reservationFilterOptions,
  ReservationFilter,
  resolveReservationTables,
} from '../../lib/domain';
import { branchDisplayName } from '../../lib/branchLabel';
import { useApp } from '../../state/AppProvider';
import { Colors, Radius, Spacing } from '../../theme/colors';

export default function ReservationsScreen() {
  const router = useRouter();
  const { state, updateReservationStatus, isOwner, isOwnerWorkspace } = useApp();
  const [selectedFilter, setSelectedFilter] = useState<ReservationFilter>('all');
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const resolvedReservations = useMemo(
    () => resolveReservationTables(state.reservations, state.tables),
    [state.reservations, state.tables]
  );
  const filterOptions = useMemo(
    () => reservationFilterOptions(resolvedReservations),
    [resolvedReservations]
  );
  const filteredReservations = useMemo(
    () => filterReservations(resolvedReservations, selectedFilter),
    [resolvedReservations, selectedFilter]
  );
  const detailsReservation =
    resolvedReservations.find((reservation) => reservation.id === detailsId) ?? null;
  const arrivedCount = state.reservations.filter(
    (reservation) => reservation.status === 'arrived'
  ).length;
  const branchLabels = useMemo(() => {
    const byId = new Map<string, string>();
    for (const branch of state.branches) {
      byId.set(branch.id, branchDisplayName(branch));
    }
    return byId;
  }, [state.branches]);

  // Tab switches use router.replace, so the stack has no history to pop:
  // the back action must name its destination explicitly.
  const networkMode = isOwner && !isOwnerWorkspace;
  const backTarget = networkMode ? '/(app)/analytics' : '/(app)/tables';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Guest Reservations"
        subtitle={
          networkMode
            ? 'All Branches • Cross-store booking ledger'
            : `${state.activeBranch.name} • Bookings & arrival dispatch`
        }
        right={
          <View style={styles.lobbyPill}>
            <Text style={styles.lobbyText}>{arrivedCount} In Lobby</Text>
          </View>
        }
        bottom={
          <ActionButton
            label={networkMode ? '‹  BACK TO DASHBOARD' : '‹  BACK TO TABLES'}
            variant="outline"
            onPress={() => router.replace(backTarget)}
            testID="btn_reservations_back"
          />
        }
      />

      <HorizontalFilterChips
        options={filterOptions}
        selectedId={selectedFilter}
        onSelect={setSelectedFilter}
      />

      <FlatList
        data={filteredReservations}
        keyExtractor={(reservation) => reservation.id}
        renderItem={({ item }) => (
          <ReservationCard
            reservation={item}
            readOnly={networkMode}
            branchLabel={networkMode ? branchLabels.get(item.branchId) : undefined}
            onOpenDetails={(reservation) => setDetailsId(reservation.id)}
            onToggleArrival={(reservationId, status) =>
              void updateReservationStatus(reservationId, status)
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No bookings in this stage</Text>
            <Text style={styles.emptySub}>
              Website reservations routed to this branch will appear here.
            </Text>
          </View>
        }
      />

      <ReservationDetailsModal
        reservation={detailsReservation}
        readOnly={networkMode}
        branchLabel={
          detailsReservation ? branchLabels.get(detailsReservation.branchId) : undefined
        }
        onClose={() => setDetailsId(null)}
        onSetStatus={(reservationId, status) =>
          void updateReservationStatus(reservationId, status)
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
  lobbyPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lobbyText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.warning,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
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
