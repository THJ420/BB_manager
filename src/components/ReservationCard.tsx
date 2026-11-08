import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { arrivalTarget, reservationStatusBadge } from '../lib/domain';
import { Reservation, ReservationStatus } from '../types';
import { ActionButton } from './ActionButton';

export interface ReservationCardProps {
  reservation: Reservation;
  onToggleArrival: (reservationId: string, status: ReservationStatus) => void;
  /** Owner console: view-only booking across branches. */
  readOnly?: boolean;
  branchLabel?: string;
}

/** View-only booking ledger row plus the quick "Arrived" toggle. */
export function ReservationCard({
  reservation,
  onToggleArrival,
  readOnly = false,
  branchLabel,
}: ReservationCardProps) {
  const badge = reservationStatusBadge(reservation.status);
  const target = readOnly ? null : arrivalTarget(reservation.status);

  return (
    <View style={styles.card} testID={`reservation_card_${reservation.id}`}>
      <View style={styles.headerRow}>
        <Text style={styles.time}>⏰ {reservation.reservationTime}</Text>
        <View style={styles.headerPills}>
          {branchLabel ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{branchLabel}</Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: badge.background }]}>
            <Text style={[styles.badgeText, { color: badge.foreground }]}>{badge.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.customerName}>{reservation.customerName}</Text>
      <Text style={styles.customerPhone}>{reservation.customerPhone}</Text>

      <View style={styles.metaRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>👥 {reservation.guestCount} Guests</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            🪑 Table {reservation.tableNumber ?? 'Unassigned'}
          </Text>
        </View>
      </View>

      {reservation.specialRequests ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>Note: {reservation.specialRequests}</Text>
        </View>
      ) : null}

      {target ? (
        <ActionButton
          label={
            target === 'arrived'
              ? 'MARK AS ARRIVED IN LOBBY'
              : 'UNDO ARRIVAL · BACK TO UPCOMING'
          }
          variant={target === 'arrived' ? 'warning' : 'outline'}
          fullWidth
          onPress={() => onToggleArrival(reservation.id, target)}
          testID={`btn_arrival_${reservation.id}`}
        />
      ) : readOnly ? (
        <Text style={styles.lockedNote}>
          Owner view · status managed by the branch floor host
        </Text>
      ) : (
        <Text style={styles.lockedNote}>View-only ledger entry · status managed by floor host</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  pill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  noteBox: {
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.sm,
    padding: 8,
    marginTop: 2,
  },
  noteText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  lockedNote: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
