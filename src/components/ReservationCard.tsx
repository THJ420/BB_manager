import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { arrivalTarget, reservationStatusBadge } from '../lib/domain';
import { Reservation, ReservationStatus } from '../types';
import { ActionButton } from './ActionButton';

export interface ReservationCardProps {
  reservation: Reservation;
  onToggleArrival: (reservationId: string, status: ReservationStatus) => void;
  /** Opens the full booking details sheet (tap anywhere outside the button). */
  onOpenDetails?: (reservation: Reservation) => void;
  /** Owner console: view-only booking across branches. */
  readOnly?: boolean;
  branchLabel?: string;
}

/** View-only booking ledger row plus the quick "Arrived" toggle. */
export function ReservationCard({
  reservation,
  onToggleArrival,
  onOpenDetails,
  readOnly = false,
  branchLabel,
}: ReservationCardProps) {
  const badge = reservationStatusBadge(reservation.status);
  const target = readOnly ? null : arrivalTarget(reservation.status);

  return (
    <Pressable
      style={styles.card}
      onPress={onOpenDetails ? () => onOpenDetails(reservation) : undefined}
      disabled={!onOpenDetails}
      testID={`reservation_card_${reservation.id}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.time}>⏰ {reservation.reservationTime}</Text>
        <View style={styles.headerPills}>
          {branchLabel ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{branchLabel}</Text>
            </View>
          ) : null}
          <View
            style={[
              styles.badge,
              { backgroundColor: badge.background, borderColor: `${badge.foreground}40` },
            ]}
          >
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

      {reservation.requestedTableNumber ? (
        <Text style={styles.requestedNote}>
          Guest requested {reservation.requestedTableNumber} · not on the floor plan
        </Text>
      ) : null}

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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
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
    fontFamily: Fonts.jakartaBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
  customerName: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  customerPhone: {
    ...Typography.mono,
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
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  requestedNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  noteBox: {
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.md,
    padding: 8,
    marginTop: 2,
  },
  noteText: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
  },
  lockedNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
