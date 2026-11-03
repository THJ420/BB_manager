import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANCHES } from '../constants/branches';
import { normalizeStaffRole } from '../lib/settings';
import { nameFromEmail } from '../lib/format';
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
  email: string;
  password: string;
  branchCode: string;
}

export function findBranchByCode(code: string): Branch | undefined {
  const normalized = code.trim().toLowerCase();
  return BRANCHES.find((branch) => branch.code.toLowerCase() === normalized);
}

function resolveDemoRole(email: string): StaffRole {
  const normalized = email.toLowerCase();
  if (normalized.includes('manager')) return 'manager';
  if (normalized.includes('kds') || normalized.includes('kitchen')) return 'kitchen_lead';
  return 'floor_staff';
}

function localSession(input: LoginInput): StaffSession {
  const branch = findBranchByCode(input.branchCode) ?? (BRANCHES[0] as Branch);
  return {
    id: `usr_${Date.now() % 10_000}`,
    email: input.email.trim(),
    name: nameFromEmail(input.email.trim()),
    role: resolveDemoRole(input.email),
    branchId: branch.id,
    branchName: branch.name,
  };
}

export async function persistSession(session: StaffSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await AsyncStorage.setItem(BRANCH_KEY, session.branchId);
}

export async function restoreSession(): Promise<StaffSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StaffSession>;
    if (!parsed.email || !parsed.branchId) return null;
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

async function resolveLiveBranch(
  branchId: string,
  branchCode: string,
  email: string
): Promise<Branch> {
  try {
    const record = await pb.collection(COLLECTIONS.branches).getOne(branchId);
    const branch = mapBranchRecord(record);
    if (
      branch.code &&
      branch.code.trim().toLowerCase() !== branchCode.trim().toLowerCase()
    ) {
      throw new Error(
        'The entered branch code does not match this staff account assignment.'
      );
    }
    return branch;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error('The assigned restaurant branch no longer exists.');
    }
    if (
      error instanceof Error &&
      error.message.startsWith('The entered branch code')
    ) {
      throw error;
    }
    throw new Error('Unable to load the assigned restaurant branch.');
  }
}

export async function loginStaff(input: LoginInput): Promise<StaffSession> {
  const email = input.email.trim();
  const branchCode = input.branchCode.trim();

  if (!email || !input.password.trim()) {
    throw new Error('Please enter both email and password.');
  }
  if (!branchCode) {
    throw new Error('Branch Code is required for local pickup routing.');
  }

  if (isPocketBaseConfigured) {
    try {
      const auth = await pb
        .collection(COLLECTIONS.staffUsers)
        .authWithPassword(email, input.password);
      const branchId =
        typeof auth.record.branch_id === 'string' ? auth.record.branch_id : '';
      if (!branchId) {
        pb.authStore.clear();
        throw new Error('Staff account is not assigned to a restaurant branch.');
      }

      const branch = await resolveLiveBranch(branchId, branchCode, email);
      rememberAssignedBranchId(branchId);
      const session: StaffSession = {
        id: auth.record.id,
        email: auth.record.email || email,
        name:
          typeof auth.record.name === 'string' && auth.record.name
            ? auth.record.name
            : nameFromEmail(email),
        role: normalizeStaffRole(
          auth.record.role,
          resolveDemoRole(String(auth.record.role ?? email))
        ),
        branchId,
        branchName: branch.name,
      };
      await persistSession(session);
      return session;
    } catch (error) {
      pb.authStore.clear();
      if (error instanceof Error && error.message) {
        if (
          error.message.startsWith('The entered branch code') ||
          error.message === 'Staff account is not assigned to a restaurant branch.' ||
          error.message === 'The assigned restaurant branch no longer exists.' ||
          error.message === 'Unable to load the assigned restaurant branch.'
        ) {
          throw error;
        }
      }
      throw new Error(publicNetworkError(error));
    }
  }

  const matchedBranch = findBranchByCode(branchCode);
  if (!matchedBranch) {
    throw new Error('Unknown branch code. Check the code printed on the terminal.');
  }

  const session = localSession({ ...input, email, branchCode });
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
