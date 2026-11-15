import { normalizeStaffRole } from '../lib/settings';
import { StaffRole } from '../types';
import { assertBranchScope, isOwnerSession } from './branchScope';
import { COLLECTIONS } from './collections';
import { describePocketBaseError } from './errors';
import { pb, isPocketBaseConfigured } from './pocketbase';

/**
 * Real employee credentials in the PocketBase `staff_users` auth collection.
 *
 * Only the owner may issue them, and every account is pinned to one branch: the
 * create rule requires a non-empty `branch_id`, and `loginStaff` refuses any
 * non-owner record without one. That is what keeps an employee terminal inside
 * its own store.
 *
 * These writes are deliberately online-only. A queued credential could never be
 * replayed safely (the password is not persisted in the outbox), so failures are
 * surfaced to the owner instead of being silently retried.
 */

export type AssignableStaffRole = Exclude<StaffRole, 'owner'>;

export const ASSIGNABLE_STAFF_ROLES: AssignableStaffRole[] = [
  'floor_staff',
  'kitchen_lead',
  'manager',
];

export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  role: StaffRole;
  branchId: string;
}

export interface CreateStaffInput {
  branchId: string;
  username: string;
  password: string;
  name: string;
  role: AssignableStaffRole;
  email?: string;
}

/** Mirrors the `staff_users.username` pattern and unique index in PocketBase. */
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MIN_PASSWORD_LENGTH = 8;
const INTERNAL_EMAIL_DOMAIN = 'staff.bbmanager.internal';

function firstRelationId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string');
    return typeof first === 'string' ? first.trim() : '';
  }
  return '';
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Turns typed input into a legal username: `EDK Mosina` -> `edk-mosina`. */
export function normalizeStaffUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/** Returns a human-readable problem, or null when the username is usable. */
export function validateStaffUsername(username: string): string | null {
  if (!username) return 'Enter a username for the employee.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use lowercase letters, numbers and hyphens only, starting with a letter or number.';
  }
  return null;
}

export function validateStaffPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`;
  }
  return null;
}

/** Placeholder address for terminals that have no real staff mailbox. */
export function staffEmailFor(username: string): string {
  return `${username}@${INTERNAL_EMAIL_DOMAIN}`;
}

function toStaffAccount(record: Record<string, unknown>): StaffAccount {
  const username = stringField(record.username);
  const email = stringField(record.email);
  return {
    id: stringField(record.id),
    username,
    email,
    name: stringField(record.name) || username || email,
    role: normalizeStaffRole(record.role),
    branchId: firstRelationId(record.branch_id),
  };
}

function requireOwner(): void {
  if (!isOwnerSession()) {
    throw new Error('Only the owner can manage employee accounts.');
  }
}

function requireBackend(): void {
  if (!isPocketBaseConfigured) {
    throw new Error('Employee accounts need the live PocketBase backend.');
  }
}

/** Wraps a PocketBase failure in a message the owner can act on. */
function staffError(error: unknown, fallback: string): Error {
  const described = describePocketBaseError(error);
  if (described.kind === 'forbidden' || described.kind === 'rule') {
    return new Error(
      'PocketBase refused this change. The owner staff-management migration may not be deployed yet.'
    );
  }
  if (described.kind === 'validation' && described.detail) {
    return new Error(described.detail);
  }
  if (described.kind === 'conflict') {
    return new Error('That username or email is already taken.');
  }
  return new Error(described.message || fallback);
}

/** Every employee account assigned to one branch. */
export async function fetchBranchStaff(branchId: string): Promise<StaffAccount[]> {
  requireBackend();
  const scoped = assertBranchScope(branchId);

  try {
    const records = await pb.collection(COLLECTIONS.staffUsers).getFullList(200, {
      filter: pb.filter('branch_id = {:branchId} && role != "owner"', { branchId: scoped }),
      sort: 'username',
    });
    return records.map((record) => toStaffAccount(record as Record<string, unknown>));
  } catch (error) {
    throw staffError(error, 'Unable to load the employee accounts for this branch.');
  }
}

export async function createStaffAccount(input: CreateStaffInput): Promise<StaffAccount> {
  requireOwner();
  requireBackend();

  const username = normalizeStaffUsername(input.username);
  const usernameError = validateStaffUsername(username);
  if (usernameError) throw new Error(usernameError);

  const passwordError = validateStaffPassword(input.password);
  if (passwordError) throw new Error(passwordError);

  if (!ASSIGNABLE_STAFF_ROLES.includes(input.role)) {
    throw new Error('Pick a staff role for the new account.');
  }

  const branchId = assertBranchScope(input.branchId);
  const email = (input.email ?? '').trim() || staffEmailFor(username);

  try {
    const record = await pb.collection(COLLECTIONS.staffUsers).create({
      username,
      email,
      emailVisibility: false,
      password: input.password,
      passwordConfirm: input.password,
      name: input.name.trim() || username,
      role: input.role,
      branch_id: branchId,
    });
    return toStaffAccount(record as Record<string, unknown>);
  } catch (error) {
    throw staffError(error, 'Unable to create the employee account.');
  }
}

/**
 * Password-only update: `pb_hooks/guards.pb.js` locks role, branch_id and email,
 * so a reset can never move an employee to another store.
 */
export async function resetStaffPassword(
  accountId: string,
  password: string
): Promise<void> {
  requireOwner();
  requireBackend();

  const passwordError = validateStaffPassword(password);
  if (passwordError) throw new Error(passwordError);

  try {
    await pb.collection(COLLECTIONS.staffUsers).update(accountId, {
      password,
      passwordConfirm: password,
    });
  } catch (error) {
    throw staffError(error, 'Unable to reset the password.');
  }
}

export async function revokeStaffAccount(accountId: string): Promise<void> {
  requireOwner();
  requireBackend();

  try {
    await pb.collection(COLLECTIONS.staffUsers).delete(accountId);
  } catch (error) {
    throw staffError(error, 'Unable to revoke the employee account.');
  }
}