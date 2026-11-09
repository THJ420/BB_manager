import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANCHES } from '../constants/branches';
import { normalizeStaffRole } from '../lib/settings';
import { nameFromEmail } from '../lib/format';
import { normalizeBranchCode } from '../lib/branchCodes';
import { Branch, StaffRole, StaffSession } from '../types';
import { pb, isPocketBaseConfigured } from './pocketbase';
import { COLLECTIONS } from './collections';
import { clearAssignedBranchId, rememberAssignedBranchId } from './branchScope';
import { isNotFoundError, publicNetworkError } from './errors';
import { mapBranchRecord } from './mappers';

const SESSION_KEY = 'bb_staff_session';
const BRANCH_KEY = 'bb_active_branch_id';
const DEMO_BRANCH_ID = 'branch_dt_01';

export interface LoginInput {
  /** PocketBase username (`edk-mosina`) or email. */
  username: string;
  password: string;
}

const OWNER_BRANCH_NAME = 'All Branches';

export function isOwnerRole(role: unknown): boolean {
  return role === 'owner';
}

export function findBranchByCode(code: string): Branch | undefined {
  const normalized = normalizeBranchCode(code);
  if (!normalized) return undefined;
  return BRANCHES.find(
    (branch) =>
      normalizeBranchCode(branch.code) === normalized ||
      normalizeBranchCode(branch.id) === normalized
  );
}

/**
 * PocketBase relation fields can be a string (maxSelect 1) or an array
 * (maxSelect > 1). The staff record's branch assignment must be read the same
 * way regardless of how the collection was configured.
 */
function firstRelationId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string');
    return typeof first === 'string' ? first.trim() : '';
  }
  return '';
}

function resolveDemoRole(email: string): StaffRole {
  const normalized = email.toLowerCase();
  if (normalized.includes('manager')) return 'manager';
  if (normalized.includes('kds') || normalized.includes('kitchen')) return 'kitchen_lead';
  return 'floor_staff';
}

function localSession(username: string): StaffSession {
  const branch = BRANCHES[0] as Branch;
  return {
    id: `usr_${Date.now() % 10_000}`,
    email: username.trim(),
    name: nameFromEmail(username.trim()),
    role: resolveDemoRole(username),
    branchId: branch.id,
    branchName: branch.name,
  };
}

export async function persistSession(session: StaffSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session.branchId) {
    await AsyncStorage.setItem(BRANCH_KEY, session.branchId);
  } else {
    // Owner sessions are not pinned to a branch; a stale BRANCH_KEY would make
    // the next hydrate look branch-scoped.
    await AsyncStorage.removeItem(BRANCH_KEY);
  }
}

export async function restoreSession(): Promise<StaffSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StaffSession>;
    if (!parsed.email) return null;
    if (isOwnerRole(parsed.role)) {
      rememberAssignedBranchId('');
      return {
        id: parsed.id ?? `usr_${Date.now() % 10_000}`,
        email: parsed.email,
        name: parsed.name ?? nameFromEmail(parsed.email),
        role: 'owner',
        branchId: '',
        branchName: OWNER_BRANCH_NAME,
      };
    }
    if (!parsed.branchId) return null;
    const branch = BRANCHES.find((entry) => entry.id === parsed.branchId);
    rememberAssignedBranchId(parsed.branchId);
    return {
      id: parsed.id ?? `usr_${Date.now() % 10_000}`,
      email: parsed.email,
      name: parsed.name ?? nameFromEmail(parsed.email),
      // Older builds stored free-form roles; normalize them against the
      // canonical manager/kitchen_lead/floor_staff set before use.
      role: normalizeStaffRole(parsed.role, 'floor_staff'),
      branchId: parsed.branchId,
      branchName: parsed.branchName ?? branch?.name ?? 'Restaurant Branch',
    };
  } catch {
    return null;
  }
}

async function resolveLiveBranch(branchId: string): Promise<Branch> {
  try {
    const record = await pb.collection(COLLECTIONS.branches).getOne(branchId);
    return mapBranchRecord(record);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error('The assigned restaurant branch no longer exists.');
    }
    throw new Error('Unable to load the assigned restaurant branch.');
  }
}

/**
 * Single credential entry point: the PocketBase staff record decides whether
 * the session is an owner console or a branch terminal. No branch code is
 * requested from the user.
 */
export async function loginStaff(input: LoginInput): Promise<StaffSession> {
  const username = input.username.trim();

  if (!username || !input.password.trim()) {
    throw new Error('Please enter both username and password.');
  }

  if (isPocketBaseConfigured) {
    try {
      const auth = await pb
        .collection(COLLECTIONS.staffUsers)
        .authWithPassword(username, input.password);
      const role = normalizeStaffRole(
        auth.record.role,
        resolveDemoRole(String(auth.record.role ?? username))
      );
      const branchId = firstRelationId(auth.record.branch_id);

      // Owners are not tied to a branch: they load the cross-branch dashboard
      // and never trigger terminal ringing.
      if (role === 'owner') {
        rememberAssignedBranchId('');
        const ownerSession: StaffSession = {
          id: auth.record.id,
          email: auth.record.email || username,
          name:
            typeof auth.record.name === 'string' && auth.record.name
              ? auth.record.name
              : nameFromEmail(auth.record.email || username),
          role: 'owner',
          branchId: '',
          branchName: OWNER_BRANCH_NAME,
        };
        await persistSession(ownerSession);
        return ownerSession;
      }

      if (!branchId) {
        pb.authStore.clear();
        throw new Error('This account is not assigned to a restaurant.');
      }

      const branch = await resolveLiveBranch(branchId);
      rememberAssignedBranchId(branchId);
      const session: StaffSession = {
        id: auth.record.id,
        email: auth.record.email || username,
        name:
          typeof auth.record.name === 'string' && auth.record.name
            ? auth.record.name
            : nameFromEmail(auth.record.email || username),
        role,
        branchId,
        branchName: branch.name,
      };
      await persistSession(session);
      return session;
    } catch (error) {
      pb.authStore.clear();
      if (error instanceof Error && error.message) {
        if (
          error.message === 'This account is not assigned to a restaurant.' ||
          error.message === 'The assigned restaurant branch no longer exists.' ||
          error.message === 'Unable to load the assigned restaurant branch.'
        ) {
          throw error;
        }
      }
      throw new Error(publicNetworkError(error));
    }
  }

  const session = localSession(username);
  await persistSession(session);
  return session;
}

export async function logoutStaff(): Promise<void> {
  pb.authStore.clear();
  clearAssignedBranchId();
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.removeItem(BRANCH_KEY);
}

export async function getActiveBranchId(): Promise<string> {
  const branchId = await AsyncStorage.getItem(BRANCH_KEY);
  return branchId || DEMO_BRANCH_ID;
}

export async function setActiveBranchId(branchId: string): Promise<void> {
  await AsyncStorage.setItem(BRANCH_KEY, branchId);
}
