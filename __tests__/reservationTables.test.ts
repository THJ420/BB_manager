jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: false,
  pb: { files: { getURL: () => '' } },
}));

import type { RecordModel } from 'pocketbase';
import { resolveReservationTables } from '../src/lib/domain';
import {
  formatDurationMinutes,
  formatReservationDate,
  formatReservationSlot,
  formatReservationTime,
  parseReservationTimestamp,
} from '../src/lib/format';
import { mapReservationRecord } from '../src/services/mappers';
import { DiningTable, Reservation } from '../src/types';

function table(branchId: string, tableNumber: string): DiningTable {
  return {
    id: `tbl_${branchId}_${tableNumber}`,
    branchId,
    tableNumber,
    name: tableNumber,
    capacity: 4,
    isAvailable: true,
    zone: 'Main Dining',
  };
}

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res000000000001',
    branchId: 'branch_cc',
    customerName: 'Test Guest',
    customerPhone: '',
    guestCount: 3,
    reservationTime: '17 Nov · 12:00 PM',
    reservationAt: '2026-11-17 12:00:00.000Z',
    status: 'upcoming',
    ...overrides,
  };
}

describe('resolveReservationTables', () => {
  const floor = [table('branch_cc', 'T1'), table('branch_cc', 'Middle'), table('branch_cc', 'T7')];

  it('clears a phantom website table that is not on the floor plan', () => {
    const [resolved] = resolveReservationTables(
      [reservation({ tableNumber: 'T5' })],
      floor
    );
    expect(resolved.tableNumber).toBeUndefined();
    expect(resolved.requestedTableNumber).toBe('T5');
  });

  it('keeps a requested table that exists on the floor plan', () => {
    const [resolved] = resolveReservationTables(
      [reservation({ tableNumber: 'T7' })],
      floor
    );
    expect(resolved.tableNumber).toBe('T7');
    expect(resolved.requestedTableNumber).toBeUndefined();
  });

  it('matches case-insensitively and canonicalises to the configured label', () => {
    const [resolved] = resolveReservationTables(
      [reservation({ tableNumber: 'middle' })],
      floor
    );
    expect(resolved.tableNumber).toBe('Middle');
  });

  it('passes through when the branch floor plan is not loaded (owner network view)', () => {
    const input = reservation({ branchId: 'branch_other', tableNumber: 'T5' });
    const [resolved] = resolveReservationTables([input], floor);
    expect(resolved).toBe(input);
  });

  it('leaves unassigned bookings untouched', () => {
    const input = reservation({ tableNumber: undefined });
    const [resolved] = resolveReservationTables([input], floor);
    expect(resolved).toBe(input);
  });
});

describe('reservation timestamp formatting', () => {
  it('parses the PocketBase space-separated UTC stamp', () => {
    const date = parseReservationTimestamp('2026-11-17 12:00:00.000Z');
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2026-11-17T12:00:00.000Z');
  });

  it('returns null for unparseable input', () => {
    expect(parseReservationTimestamp('6:30 PM (In 20m)')).toBeNull();
    expect(parseReservationTimestamp('')).toBeNull();
  });

  it('formats a booking slot for the card', () => {
    expect(formatReservationSlot('2026-11-17 12:00:00.000Z')).toMatch(
      /^17 Nov · \d{1,2}:\d{2} (AM|PM)$/
    );
  });

  it('passes seed-style labels through unchanged', () => {
    expect(formatReservationSlot('6:30 PM (In 20m)')).toBe('6:30 PM (In 20m)');
  });

  it('formats the details date and time', () => {
    expect(formatReservationDate('2026-11-17 12:00:00.000Z')).toMatch(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), 17 Nov 2026$/
    );
    expect(formatReservationTime('2026-11-17 12:00:00.000Z')).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });

  it('formats durations', () => {
    expect(formatDurationMinutes(undefined)).toBe('Not specified');
    expect(formatDurationMinutes(45)).toBe('45 min');
    expect(formatDurationMinutes(60)).toBe('1 h');
    expect(formatDurationMinutes(90)).toBe('1.5 h');
  });
});

describe('mapReservationRecord', () => {
  it('maps duration and formats the raw timestamp while keeping reservationAt raw', () => {
    const record = {
      id: 'res000000000001',
      branch_id: 'branch_cc',
      customer_name: 'Test Guest',
      customer_phone: '+48 555 100 200',
      guest_count: 3,
      reservation_time: '2026-11-17 12:00:00.000Z',
      table_number: 'T5',
      duration_minutes: 90,
      status: 'upcoming',
      special_requests: 'Window seat',
    } as unknown as RecordModel;

    const mapped = mapReservationRecord(record);
    expect(mapped.durationMinutes).toBe(90);
    expect(mapped.reservationAt).toBe('2026-11-17 12:00:00.000Z');
    expect(mapped.reservationTime).toMatch(/^17 Nov · \d{1,2}:\d{2} (AM|PM)$/);
    expect(mapped.tableNumber).toBe('T5');
    expect(mapped.customerPhone).toBe('+48 555 100 200');
  });

  it('omits duration when the website did not send one', () => {
    const record = {
      id: 'res000000000002',
      branch_id: 'branch_cc',
      reservation_time: '2026-11-17 12:00:00.000Z',
      status: '',
    } as unknown as RecordModel;
    const mapped = mapReservationRecord(record);
    expect(mapped.durationMinutes).toBeUndefined();
    expect(mapped.status).toBe('upcoming');
  });
});