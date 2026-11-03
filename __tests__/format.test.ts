import {
  elapsedLabel,
  formatCurrency,
  formatSignedCurrency,
  initials,
  nameFromEmail,
  parsePrice,
  pickupCountdown,
} from '../src/lib/format';

describe('formatCurrency', () => {
  it('renders two decimals with the złoty suffix', () => {
    expect(formatCurrency(34.5)).toBe('34.50 zł');
    expect(formatCurrency(0)).toBe('0.00 zł');
  });

  it('falls back to zero for non-finite values', () => {
    expect(formatCurrency(Number.NaN)).toBe('0.00 zł');
  });

  it('formats signed deltas', () => {
    expect(formatSignedCurrency(1.5)).toBe('+1.50 zł');
    expect(formatSignedCurrency(-0.5)).toBe('-0.50 zł');
  });
});

describe('parsePrice', () => {
  it('accepts plain and currency-suffixed values', () => {
    expect(parsePrice('12')).toBe(12);
    expect(parsePrice('12.5')).toBe(12.5);
    expect(parsePrice('$12.50')).toBe(12.5);
    expect(parsePrice('12.50 zł')).toBe(12.5);
    expect(parsePrice('zł 12.50')).toBe(12.5);
    expect(parsePrice('0')).toBe(0);
  });

  it('rounds to cents', () => {
    expect(parsePrice('12.999')).toBeNull();
    expect(parsePrice('12.345')).toBeNull();
  });

  it('rejects negative, empty and malformed input', () => {
    expect(parsePrice('-3')).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('12,50')).toBeNull();
  });
});

describe('ticket timing', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');

  it('formats elapsed minutes with a minimum of one', () => {
    expect(elapsedLabel('2026-01-01T11:45:00.000Z', now)).toBe('15m ago');
    expect(elapsedLabel('2026-01-01T11:59:30.000Z', now)).toBe('1m ago');
  });

  it('counts down to the pickup window', () => {
    expect(pickupCountdown('2026-01-01T12:10:00.000Z', now)).toEqual({
      label: 'PICKUP IN 10m',
      overdue: false,
    });
  });

  it('flags overdue pickups', () => {
    expect(pickupCountdown('2026-01-01T11:55:00.000Z', now)).toEqual({
      label: 'PAST DUE 5m',
      overdue: true,
    });
  });

  it('returns null without a pickup window', () => {
    expect(pickupCountdown(undefined, now)).toBeNull();
  });
});

describe('identity helpers', () => {
  it('builds initials from the first two words', () => {
    expect(initials('Alex Vance')).toBe('AV');
    expect(initials('Chef Marco Rossi')).toBe('CM');
    expect(initials('')).toBe('BB');
  });

  it('derives a display name from a staff email', () => {
    expect(nameFromEmail('manager.downtown@bbmanager.internal')).toBe('Manager Downtown');
  });
});
