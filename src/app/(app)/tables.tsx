import React, { useMemo, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import {
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../components/ActionButton';
import { HorizontalFilterChips } from '../../components/HorizontalFilterChips';
import { ReservationCard } from '../../components/ReservationCard';
import { ReservationDetailsModal } from '../../components/ReservationDetailsModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TableCard } from '../../components/TableCard';
import { TableEditorModal } from '../../components/TableEditorModal';
import { DialogModal } from '../../components/DialogModal';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import {
  filterReservations,
  reservationFilterOptions,
  ReservationFilter,
  resolveReservationTables,
} from '../../lib/domain';
import { useApp } from '../../state/AppProvider';
import { canCreateTables, canDeleteTables } from '../../services/branchScope';
import { Colors, Layout, Radius, Spacing } from '../../theme/colors';
import { Fonts, Typography } from '../../theme/typography';
import { DiningTable, Reservation, ReservationStatus } from '../../types';

type ViewMode = 'reservations' | 'tables';

export default function DiningTablesScreen() {
  const {
    state,
    toggleAcceptingReservations,
    saveTable,
    deleteTable,
    updateReservationStatus,
    refreshData,
  } = useApp();
  const { refreshing, onRefresh } = usePullToRefresh(refreshData);
  const params = useLocalSearchParams<{ view?: string }>();
  const role = state.session?.role ?? '';
  const canDelete = canDeleteTables(role);
  const canCreate = canCreateTables(role);
  const [viewMode, setViewMode] = useState<ViewMode>(
    params.view === 'tables' ? 'tables' : 'reservations'
  );
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiningTable | null>(null);
  const transition = useRef(new Animated.Value(1)).current;
  const transitioning = useRef(false);

  const bookingsLive = state.storeConfig.acceptingReservations;
  const isReservationsView = viewMode === 'reservations';
  const resolvedReservations = useMemo(
    () => resolveReservationTables(state.reservations, state.tables),
    [state.reservations, state.tables]
  );
  const arrivedCount = state.reservations.filter(
    (reservation) => reservation.status === 'arrived'
  ).length;

  const openCreate = () => {
    setEditingTable(null);
    setEditorVisible(true);
  };

  const openEdit = (table: DiningTable) => {
    setEditingTable(table);
    setEditorVisible(true);
  };

  const switchView = (next: ViewMode) => {
    if (next === viewMode || transitioning.current) return;
    transitioning.current = true;

    Animated.timing(transition, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        transitioning.current = false;
        return;
      }

      setViewMode(next);
      Animated.timing(transition, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        transitioning.current = false;
      });
    });
  };

  const animatedStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  // Owners manage tables inside a branch workspace, never from the network view.
  if (state.session?.role === 'owner' && !state.ownerWorkspaceBranchId) {
    return <Redirect href="/(app)/analytics" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={isReservationsView ? 'Guest Reservations' : 'Dining Tables'}
        subtitle={
          isReservationsView
            ? `${state.activeBranch.name} • ${state.reservations.length} bookings`
            : `${state.activeBranch.name} • ${state.tables.length} tables`
        }
        right={
          isReservationsView ? (
            <View style={styles.lobbyPill}>
              <Text style={styles.lobbyText}>{arrivedCount} In Lobby</Text>
            </View>
          ) : canCreate ? (
            <ActionButton
              label="+ ADD TABLE"
              variant="primary"
              compact
              onPress={openCreate}
              testID="btn_add_table"
            />
          ) : undefined
        }
        bottom={
          <ActionButton
            label={isReservationsView ? 'UPDATE TABLES' : '←  BACK TO BOOKINGS'}
            variant={isReservationsView ? 'primary' : 'outline'}
            fullWidth
            onPress={() => switchView(isReservationsView ? 'tables' : 'reservations')}
            testID={
              isReservationsView ? 'btn_update_tables' : 'btn_back_to_reservations'
            }
          />
        }
      />

      <View style={styles.body}>
        <View
          style={[
            styles.masterCard,
            { borderColor: bookingsLive ? Colors.successBorder : Colors.errorBorder },
          ]}
        >
          <View style={styles.masterBody}>
            <View style={styles.masterText}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: bookingsLive ? Colors.success : Colors.error },
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    { color: bookingsLive ? Colors.success : Colors.error },
                  ]}
                >
                  {bookingsLive ? 'BOOKINGS LIVE' : 'BOOKINGS SUSPENDED'}
                </Text>
              </View>
              <Text style={styles.masterTitle}>Table Booking</Text>
              <Text style={styles.masterSubtitle}>
                {bookingsLive
                  ? 'Online guests can reserve tables via the web portal.'
                  : 'Suspended: table bookings halted across website backend.'}
              </Text>
            </View>

            <View style={styles.switchTouch}>
              <Switch
                value={bookingsLive}
                onValueChange={(value) => void toggleAcceptingReservations(value)}
                trackColor={{ false: Colors.switchTrackOff, true: Colors.success }}
                thumbColor={bookingsLive ? Colors.white : Colors.error}
                ios_backgroundColor={Colors.switchTrackOff}
                hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
                testID="global_reservation_master_switch"
                accessibilityLabel="Table Booking"
              />
            </View>
          </View>
        </View>

        <Animated.View style={[styles.viewArea, animatedStyle]}>
          {isReservationsView ? (
            <GuestReservationsPanel
              reservations={resolvedReservations}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onToggleArrival={(reservationId, status) =>
                void updateReservationStatus(reservationId, status)
              }
            />
          ) : (
            <DiningTablesPanel
              tables={state.tables}
              canCreate={canCreate}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEdit={openEdit}
            />
          )}
        </Animated.View>
      </View>

      <TableEditorModal
        visible={editorVisible}
        table={editingTable}
        branchId={state.activeBranch.id}
        onClose={() => {
          setEditorVisible(false);
          setEditingTable(null);
        }}
        onSave={(table) => void saveTable(table)}
        canDelete={editingTable !== null && canDelete}
        onDelete={() => {
          if (!editingTable) return;
          setDeleteTarget(editingTable);
          setEditorVisible(false);
          setEditingTable(null);
        }}
      />

      <DialogModal
        visible={deleteTarget !== null}
        title="Delete Dining Table"
        message={
          deleteTarget
            ? `Remove “${deleteTarget.name}” from the floor plan and the website?`
            : ''
        }
        onRequestClose={() => setDeleteTarget(null)}
        actions={[
          { label: 'Cancel', variant: 'outline', onPress: () => setDeleteTarget(null) },
          {
            label: 'Delete',
            variant: 'danger',
            onPress: () => {
              const target = deleteTarget;
              setDeleteTarget(null);
              if (target) void deleteTable(target.id);
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}

function GuestReservationsPanel({
  reservations,
  refreshing,
  onRefresh,
  onToggleArrival,
}: {
  reservations: Reservation[];
  refreshing: boolean;
  onRefresh: () => void;
  onToggleArrival: (reservationId: string, status: ReservationStatus) => void;
}) {
  const [selectedFilter, setSelectedFilter] = useState<ReservationFilter>('all');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const filterOptions = useMemo(
    () => reservationFilterOptions(reservations),
    [reservations]
  );
  const filteredReservations = useMemo(
    () => filterReservations(reservations, selectedFilter),
    [reservations, selectedFilter]
  );
  const detailsReservation =
    reservations.find((reservation) => reservation.id === detailsId) ?? null;

  return (
    <>
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
            onOpenDetails={(reservation) => setDetailsId(reservation.id)}
            onToggleArrival={onToggleArrival}
          />
        )}
        style={styles.panelScroll}
        contentContainerStyle={styles.reservationList}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surfaceElevated}
            tintColor={Colors.primary}
            title="Refreshing bookings…"
          />
        }
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
        onClose={() => setDetailsId(null)}
        onSetStatus={onToggleArrival}
      />
    </>
  );
}

function DiningTablesPanel({
  tables,
  canCreate,
  refreshing,
  onRefresh,
  onEdit,
}: {
  tables: DiningTable[];
  canCreate: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onEdit: (table: DiningTable) => void;
}) {
  return (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.tablesContent}
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Colors.primary]}
          progressBackgroundColor={Colors.surfaceElevated}
          tintColor={Colors.primary}
          title="Refreshing tables…"
        />
      }
    >
      <View style={styles.tableSectionHeader}>
        <Text style={styles.sectionLabel}>DINING TABLES</Text>
        <Text style={styles.sectionHint}>Tap a table to edit its name or seating capacity.</Text>
      </View>

      {tables.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🪑</Text>
          <Text style={styles.emptyTitle}>No dining tables yet</Text>
          <Text style={styles.emptySub}>
            {canCreate
              ? 'Use + ADD TABLE to create the first one.'
              : 'A manager or kitchen lead can add the first table.'}
          </Text>
        </View>
      ) : (
        tables.map((table) => <TableCard key={table.id} table={table} onEdit={onEdit} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
  },
  viewArea: {
    flex: 1,
  },
  panelScroll: {
    flex: 1,
  },
  lobbyPill: {
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lobbyText: {
    fontFamily: Fonts.interBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    color: Colors.warning,
  },
  masterCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  masterBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  masterText: {
    flex: 1,
    gap: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  masterTitle: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  masterSubtitle: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  switchTouch: {
    minWidth: Layout.minTouch,
    minHeight: Layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reservationList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Layout.bottomClearance,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  tablesContent: {
    padding: Spacing.md,
    paddingBottom: Layout.bottomClearance,
    gap: 12,
    flexGrow: 1,
  },
  tableSectionHeader: {
    gap: 3,
  },
  sectionLabel: {
    ...Typography.sectionLabel,
  },
  sectionHint: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
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
