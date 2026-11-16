import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';
import { arrivalTarget, reservationStatusBadge } from '../lib/domain';
import {
  formatDurationMinutes,
  formatReservationDate,
  formatReservationTime,
} from '../lib/format';
import { Reservation, ReservationStatus } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';

export interface ReservationDetailsModalProps {
  reservation: Reservation | null;
  onClose: () => void;
  onSetStatus: (reservationId: string, status: ReservationStatus) => void;
  /** Owner console: view-only booking across branches. */
  readOnly?: boolean;
  branchLabel?: string;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** Full submission sheet for a website booking, with floor actions. */
export function ReservationDetailsModal({
  reservation,
  onClose,
  onSetStatus,
  readOnly = false,
  branchLabel,
}: ReservationDetailsModalProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  useEffect(() => {
    setConfirmingCancel(false);
  }, [reservation?.id]);

  if (!reservation) return null;

  const badge = reservationStatusBadge(reservation.status);
  const target = readOnly ? null : arrivalTarget(reservation.status);
  const rawTime = reservation.reservationAt ?? reservation.reservationTime;
  const canCancel =
    !readOnly && (reservation.status === 'upcoming' || reservation.status === 'arrived');

  const setStatus = (status: ReservationStatus) => {
    onSetStatus(reservation.id, status);
    setConfirmingCancel(false);
  };

  return (
    <ModalShell
      visible={reservation !== null}
      title="Reservation Details"
      subtitle={branchLabel ?? 'Website booking submission'}
      onClose={onClose}
      footer={
        readOnly ? (
          <Text style={styles.lockedNote}>
            Owner view · status managed by the branch floor host
          </Text>
        ) : (
          <View style={styles.actions}>
            {target ? (
              <ActionButton
                label={
                  target === 'arrived'
                    ? 'ARRIVED IN LOBBY'
                    : 'UNDO ARRIVAL · BACK TO UPCOMING'
                }
                variant={target === 'arrived' ? 'warning' : 'outline'}
                fullWidth
                onPress={() => setStatus(target)}
                testID={`btn_details_arrival_${reservation.id}`}
              />
            ) : null}
            {reservation.status === 'arrived' ? (
              <ActionButton
                label="SEAT AT TABLE"
                variant="primary"
                fullWidth
                onPress={() => setStatus('seated')}
                testID={`btn_details_seat_${reservation.id}`}
              />
            ) : null}
            {reservation.status === 'seated' ? (
              <ActionButton
                label="MARK COMPLETED"
                variant="primary"
                fullWidth
                onPress={() => setStatus('completed')}
                testID={`btn_details_complete_${reservation.id}`}
              />
            ) : null}
            {canCancel ? (
              <ActionButton
                label={confirmingCancel ? 'TAP AGAIN TO CONFIRM CANCELLATION' : 'CANCEL BOOKING'}
                variant="danger"
                fullWidth
                onPress={() => {
                  if (confirmingCancel) {
                    setStatus('cancelled');
                  } else {
                    setConfirmingCancel(true);
                  }
                }}
                testID={`btn_details_cancel_${reservation.id}`}
              />
            ) : null}
          </View>
        )
      }
    >
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.badge,
            { backgroundColor: badge.background, borderColor: `${badge.foreground}40` },
          ]}
        >
          <Text style={[styles.badgeText, { color: badge.foreground }]}>{badge.label}</Text>
        </View>
      </View>

      <DetailRow label="Guest Name" value={reservation.customerName} />
      <DetailRow label="Date" value={formatReservationDate(rawTime)} />
      <DetailRow label="Time" value={formatReservationTime(rawTime)} />
      <DetailRow label="Party Size" value={`${reservation.guestCount} guests`} />
      <DetailRow
        label="Assigned Dining Table"
        value={reservation.tableNumber ? `Table ${reservation.tableNumber}` : 'Unassigned'}
      />
      {reservation.requestedTableNumber ? (
        <Text style={styles.requestedNote}>
          Guest requested {reservation.requestedTableNumber} — that table is not on the
          branch floor plan, so the booking is unassigned.
        </Text>
      ) : null}
      <DetailRow
        label="Duration"
        value={formatDurationMinutes(reservation.durationMinutes)}
      />
      <DetailRow
        label="Contact Info"
        value={reservation.customerPhone || 'Not provided'}
      />
      {reservation.specialRequests ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Special Requests</Text>
          <Text style={styles.noteText}>{reservation.specialRequests}</Text>
        </View>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  badge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorderSubtle,
  },
  rowLabel: {
    ...Typography.sectionLabel,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: Fonts.interSemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  requestedNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.warning,
    marginTop: 6,
    lineHeight: 16,
  },
  noteBox: {
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 4,
  },
  noteLabel: {
    ...Typography.sectionLabel,
    color: Colors.warning,
  },
  noteText: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.warning,
    lineHeight: 17,
  },
  actions: {
    gap: Spacing.sm,
  },
  lockedNote: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});