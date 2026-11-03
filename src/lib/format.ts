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

export function roleLabel(role: 'manager' | 'kitchen_lead' | 'floor_staff'): string {
  switch (role) {
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
