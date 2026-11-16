/** Formatting helpers shared by the order board, ledger and analytics screens. */

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} zł`;
}

export function formatSignedCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(2)} zł`;
}

export function formatPercent(value: number, digits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(digits)}%`;
}

/** Allows "12", "12.5", "12.50", "$12.50", "12.50 zł"; rejects negatives. */
export function parsePrice(input: string): number | null {
  const trimmed = input
    .trim()
    .replace(/^\$/, '')
    .replace(/^zł\s*/i, '')
    .replace(/\s*zł$/i, '');
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function minutesSince(iso: string, now: number): number {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((now - timestamp) / 60_000));
}

export function elapsedLabel(iso: string, now: number): string {
  return `${Math.max(1, minutesSince(iso, now))}m ago`;
}

export interface PickupCountdown {
  label: string;
  overdue: boolean;
}

/** Returns null when the ticket has no promised pickup window. */
export function pickupCountdown(
  estimatedPickupAt: string | undefined,
  now: number
): PickupCountdown | null {
  if (!estimatedPickupAt) return null;
  const eta = Date.parse(estimatedPickupAt);
  if (Number.isNaN(eta)) return null;
  const minutes = Math.round((eta - now) / 60_000);
  return {
    label: minutes >= 0 ? `PICKUP IN ${minutes}m` : `PAST DUE ${Math.abs(minutes)}m`,
    overdue: minutes < 0,
  };
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'BB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** PocketBase stores "YYYY-MM-DD HH:MM:SS.sssZ"; Hermes needs the ISO "T". */
export function parseReservationTimestamp(raw: string): Date | null {
  const text = raw.trim();
  if (!text) return null;
  const timestamp = Date.parse(text.includes('T') ? text : text.replace(' ', 'T'));
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function clockLabel(date: Date): string {
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${hours24 < 12 ? 'AM' : 'PM'}`;
}

/** "17 Nov · 12:00 PM" for the booking card; unparseable input passes through. */
export function formatReservationSlot(raw: string): string {
  const date = parseReservationTimestamp(raw);
  if (!date) return raw;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${clockLabel(date)}`;
}

/** "Monday, 17 Nov 2026" for the booking details sheet. */
export function formatReservationDate(raw: string): string {
  const date = parseReservationTimestamp(raw);
  if (!date) return raw;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatReservationTime(raw: string): string {
  const date = parseReservationTimestamp(raw);
  return date ? clockLabel(date) : raw;
}

export function formatDurationMinutes(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return 'Not specified';
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

export function titleCaseWords(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  return titleCaseWords(localPart.replace(/[._-]+/g, ' ')) || 'Floor Staff';
}

export function roleLabel(
  role: 'owner' | 'manager' | 'kitchen_lead' | 'floor_staff'
): string {
  switch (role) {
    case 'owner':
      return 'Owner / Super Admin';
    case 'manager':
      return 'Kitchen Lead & Manager';
    case 'kitchen_lead':
      return 'Kitchen Lead';
    default:
      return 'Floor Operations Staff';
  }
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
