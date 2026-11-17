/**
 * Pure bulk price-adjustment math shared by the menu bulk action bar and its
 * unit tests. PocketBase stores prices as plain numbers with 2 decimals, so
 * every computed price is clamped to >= 0 and rounded to 2 decimals here —
 * never in the UI layer.
 */

export type BulkPriceMode = 'fixed' | 'percent';
export type BulkPriceDirection = 'increase' | 'decrease';

/** Rounds to 2 decimals, correcting binary float drift (e.g. 1.005 * 100). */
export function roundPrice(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes the adjusted price for one item.
 * - fixed:   current ± value
 * - percent: current * (1 ± value / 100)
 * The result is clamped to >= 0 and rounded to 2 decimals. `value` is treated
 * as a magnitude; the direction alone decides the sign. Non-finite inputs fall
 * back to 0 so a malformed entry can never produce NaN on the wire.
 */
export function computeAdjustedPrice(
  current: number,
  mode: BulkPriceMode,
  direction: BulkPriceDirection,
  value: number
): number {
  const base = Number.isFinite(current) ? current : 0;
  const magnitude = Number.isFinite(value) ? Math.abs(value) : 0;
  const sign = direction === 'decrease' ? -1 : 1;
  const raw =
    mode === 'percent'
      ? base * (1 + (sign * magnitude) / 100)
      : base + sign * magnitude;
  return roundPrice(Math.max(0, raw));
}