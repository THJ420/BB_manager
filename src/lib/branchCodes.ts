/**
 * Branch-code normalisation shared by the login flow and the PocketBase
 * `branches` collection.
 *
 * Staff type codes from printed terminal labels, which are not consistent about
 * separators or casing: `RADHUNI-2-0`, `radhuni_2_0`, `RADHUNI 2 0` and
 * `radhuni.2.0` all identify the same branch. Normalising to uppercase
 * alphanumeric tokens separated by a single hyphen makes those equivalent while
 * still keeping distinct branches distinct.
 */
export function normalizeBranchCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** True when two branch identifiers refer to the same branch code. */
export function branchCodesMatch(
  left: unknown,
  right: unknown
): boolean {
  const normalizedLeft = normalizeBranchCode(left);
  const normalizedRight = normalizeBranchCode(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}