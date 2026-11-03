import { COLLECTIONS } from './collections';
import { pb } from './pocketbase';
import { StaffRole } from '../types';

/** Thrown when a mutation targets a branch other than the signed-in staff account's. */
export class BranchScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BranchScopeError';
  }
}

/**
 * Collections whose PocketBase update guard refuses a `branch_id` in the request
 * body. `pb_hooks/guards.pb.js` limits order updates to the status columns, so
 * stamping a branch there would be rejected server-side instead of enforced.
 */
const BRIDGE_FORBIDDEN_ON_UPDATE: ReadonlySet<string> = new Set([COLLECTIONS.orders]);

let cachedBranchId = '';

function authRecordBranchId(): string {
  const record = pb.authStore.record as Record<string, unknown> | null;
  const value = record?.branch_id;
  return typeof value === 'string' ? value.trim() : '';
}

/** Seeds the fallback used while a persisted session is still being restored. */
export function rememberAssignedBranchId(branchId: string): void {
  cachedBranchId = branchId.trim();
}

export function clearAssignedBranchId(): void {
  cachedBranchId = '';
}

/**
 * The only branch this terminal may read or write. The PocketBase auth record is
 * the authority because the server resolves `@request.auth.branch_id` from the
 * same value; the cached id covers the window before the token is rehydrated.
 */
export function assignedBranchId(): string {
  return authRecordBranchId() || cachedBranchId;
}

export function requireAssignedBranchId(): string {
  const branchId = assignedBranchId();
  if (!branchId) {
    throw new BranchScopeError(
      'No branch is assigned to the signed-in staff account.'
    );
  }
  return branchId;
}

/**
 * Returns the authenticated branch id, rejecting any request that names a
 * different one — including rows replayed from a stale offline SQLite cache.
 */
export function assertBranchScope(branchId?: string): string {
  const assigned = requireAssignedBranchId();
  const wanted = (branchId ?? '').trim();
  if (wanted && wanted !== assigned) {
    throw new BranchScopeError(
      `This account is assigned to branch ${assigned}, not ${wanted}.`
    );
  }
  return assigned;
}

/** Branch-scoped PocketBase filter, safe for both REST queries and SSE subscriptions. */
export function branchScopeFilter(branchId?: string): string {
  return pb.filter('branch_id = {:branchId}', { branchId: assertBranchScope(branchId) });
}

/**
 * Stamps the authenticated `branch_id` onto a record payload. Creates always
 * carry it (PocketBase's create rules compare it against the auth record);
 * updates carry it unless the collection's guard forbids the field.
 */
export function scopeWritePayload(
  collection: string,
  data: Record<string, unknown>,
  mode: 'create' | 'update'
): Record<string, unknown> {
  const branchId = assertBranchScope(
    typeof data.branch_id === 'string' ? data.branch_id : undefined
  );

  if (mode === 'update' && BRIDGE_FORBIDDEN_ON_UPDATE.has(collection)) {
    const { branch_id: _stripped, ...fields } = data;
    return fields;
  }

  return { ...data, branch_id: branchId };
}

/** Role recorded on the PocketBase staff record ('' when unavailable). */
export function assignedRole(): StaffRole | '' {
  const record = pb.authStore.record as Record<string, unknown> | null;
  const role = record?.role;
  return role === 'manager' || role === 'kitchen_lead' || role === 'floor_staff'
    ? role
    : '';
}

/**
 * Mirrors `menu_items.createRule` in PocketBase. Queueing a create from any
 * other role produces a permanent HTTP 400 that can never drain.
 */
export function canCreateMenuItems(role: string): boolean {
  return role === 'manager' || role === 'kitchen_lead';
}

/**
 * Mirrors `menu_items.deleteRule`: managers and kitchen leads may remove items.
 */
export function canDeleteMenuItems(role: string): boolean {
  return role === 'manager' || role === 'kitchen_lead';
}

/** Mirrors `pb_hooks/guards.pb.js`: only managers may rename/recategorise items. */
export function canEditMenuDetails(role: string): boolean {
  return role === 'manager';
}
