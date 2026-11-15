const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockGetFullList = jest.fn();

jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    authStore: { record: { id: 'owner1', role: 'owner', branch_id: '' } as unknown },
    filter: jest.fn(
      (expression: string, params: Record<string, unknown>) =>
        `${expression}::${JSON.stringify(params)}`
    ),
    collection: jest.fn(() => ({
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      getFullList: mockGetFullList,
    })),
  },
}));

import { pb } from '../src/services/pocketbase';
import {
  ASSIGNABLE_STAFF_ROLES,
  createStaffAccount,
  fetchBranchStaff,
  normalizeStaffUsername,
  resetStaffPassword,
  revokeStaffAccount,
  staffEmailFor,
  validateStaffPassword,
  validateStaffUsername,
} from '../src/services/staff';

const BRANCH_ID = '417bkic1rhobhwu';

function setRole(role: string): void {
  (pb.authStore as { record: unknown }).record = { id: 'u1', role, branch_id: BRANCH_ID };
}

beforeEach(() => {
  jest.clearAllMocks();
  setRole('owner');
  mockCreate.mockResolvedValue({
    id: 'new1',
    username: 'edk-mosina-2',
    email: 'edk-mosina-2@staff.bbmanager.internal',
    name: 'Anna',
    role: 'floor_staff',
    branch_id: BRANCH_ID,
  });
  mockGetFullList.mockResolvedValue([]);
});

describe('normalizeStaffUsername', () => {
  it('lowercases and hyphenates typed input', () => {
    expect(normalizeStaffUsername('EDK Mosina')).toBe('edk-mosina');
    expect(normalizeStaffUsername('  enjoy_doner.kebab  ')).toBe('enjoy-doner-kebab');
    expect(normalizeStaffUsername('Radhuni 2.0')).toBe('radhuni-2-0');
  });

  it('strips diacritics and illegal characters', () => {
    expect(normalizeStaffUsername('Łukasz Śmigiel')).toBe('lukasz-smigiel');
    expect(normalizeStaffUsername('a!@#b')).toBe('a-b');
  });

  it('never exceeds the PocketBase column length', () => {
    expect(normalizeStaffUsername('x'.repeat(90))).toHaveLength(64);
  });
});

describe('validateStaffUsername', () => {
  it('accepts the live username shape', () => {
    expect(validateStaffUsername('edk-mosina')).toBeNull();
    expect(validateStaffUsername('rad-leszno-2')).toBeNull();
  });

  it('rejects empty, leading-hyphen and uppercase values', () => {
    expect(validateStaffUsername('')).not.toBeNull();
    expect(validateStaffUsername('-edk')).not.toBeNull();
    expect(validateStaffUsername('EDK')).not.toBeNull();
    expect(validateStaffUsername('edk mosina')).not.toBeNull();
  });
});

describe('validateStaffPassword', () => {
  it('enforces the PocketBase minimum length', () => {
    expect(validateStaffPassword('short')).not.toBeNull();
    expect(validateStaffPassword('longenough1')).toBeNull();
  });
});

describe('staffEmailFor', () => {
  it('uses a non-routable internal domain', () => {
    expect(staffEmailFor('edk-mosina')).toBe('edk-mosina@staff.bbmanager.internal');
  });
});

describe('createStaffAccount', () => {
  it('pins the new account to exactly one branch', async () => {
    const account = await createStaffAccount({
      branchId: BRANCH_ID,
      username: 'EDK Mosina 2',
      password: 'longenough1',
      name: 'Anna',
      role: 'floor_staff',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      username: 'edk-mosina-2',
      email: 'edk-mosina-2@staff.bbmanager.internal',
      emailVisibility: false,
      password: 'longenough1',
      passwordConfirm: 'longenough1',
      name: 'Anna',
      role: 'floor_staff',
      branch_id: BRANCH_ID,
    });
    expect(account.branchId).toBe(BRANCH_ID);
    expect(account.username).toBe('edk-mosina-2');
  });

  it('never sends a verified flag (superuser-only system field)', async () => {
    await createStaffAccount({
      branchId: BRANCH_ID,
      username: 'edk-mosina-2',
      password: 'longenough1',
      name: 'Anna',
      role: 'manager',
    });
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('verified');
  });

  it('refuses to mint another owner', async () => {
    await expect(
      createStaffAccount({
        branchId: BRANCH_ID,
        username: 'second-owner',
        password: 'longenough1',
        name: 'Anna',
        role: 'owner' as never,
      })
    ).rejects.toThrow(/staff role/i);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(ASSIGNABLE_STAFF_ROLES).not.toContain('owner');
  });

  it('refuses a branch the owner has not opened', async () => {
    await expect(
      createStaffAccount({
        branchId: '',
        username: 'edk-mosina-2',
        password: 'longenough1',
        name: 'Anna',
        role: 'floor_staff',
      })
    ).rejects.toThrow(/command center/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('is rejected for non-owner sessions before any HTTP call', async () => {
    setRole('manager');
    await expect(
      createStaffAccount({
        branchId: BRANCH_ID,
        username: 'edk-mosina-2',
        password: 'longenough1',
        name: 'Anna',
        role: 'floor_staff',
      })
    ).rejects.toThrow(/Only the owner/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('validates the password before calling PocketBase', async () => {
    await expect(
      createStaffAccount({
        branchId: BRANCH_ID,
        username: 'edk-mosina-2',
        password: 'short',
        name: 'Anna',
        role: 'floor_staff',
      })
    ).rejects.toThrow(/at least 8 characters/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('surfaces a duplicate username as a field error', async () => {
    mockCreate.mockRejectedValue({
      status: 400,
      message: 'Failed to create record.',
      response: {
        data: { username: { code: 'validation_not_unique', message: 'The value is not unique.' } },
      },
    });

    await expect(
      createStaffAccount({
        branchId: BRANCH_ID,
        username: 'edk-mosina',
        password: 'longenough1',
        name: 'Anna',
        role: 'floor_staff',
      })
    ).rejects.toThrow(/username: The value is not unique/);
  });

  it('explains a rule denial as a missing backend migration', async () => {
    mockCreate.mockRejectedValue({ status: 403, message: 'Forbidden.' });
    await expect(
      createStaffAccount({
        branchId: BRANCH_ID,
        username: 'edk-mosina-2',
        password: 'longenough1',
        name: 'Anna',
        role: 'floor_staff',
      })
    ).rejects.toThrow(/migration may not be deployed/i);
  });
});

describe('resetStaffPassword', () => {
  it('sends only password fields so the guard cannot see a reassignment', async () => {
    await resetStaffPassword('emp1', 'newpassword9');
    expect(mockUpdate).toHaveBeenCalledWith('emp1', {
      password: 'newpassword9',
      passwordConfirm: 'newpassword9',
    });
  });

  it('rejects a short password without an HTTP call', async () => {
    await expect(resetStaffPassword('emp1', 'short')).rejects.toThrow(/at least 8/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('revokeStaffAccount', () => {
  it('deletes the account', async () => {
    await revokeStaffAccount('emp1');
    expect(mockDelete).toHaveBeenCalledWith('emp1');
  });

  it('is owner-only', async () => {
    setRole('kitchen_lead');
    await expect(revokeStaffAccount('emp1')).rejects.toThrow(/Only the owner/i);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('fetchBranchStaff', () => {
  it('filters to one branch and excludes owner accounts', async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: 'emp1',
        username: 'edk-mosina',
        email: 'mosina@enjoydonerkebab.pl',
        name: 'Mosina Terminal',
        role: 'manager',
        branch_id: BRANCH_ID,
      },
    ]);

    const accounts = await fetchBranchStaff(BRANCH_ID);

    expect(mockGetFullList).toHaveBeenCalledWith(200, {
      filter: `branch_id = {:branchId} && role != "owner"::${JSON.stringify({
        branchId: BRANCH_ID,
      })}`,
      sort: 'username',
    });
    expect(accounts).toEqual([
      {
        id: 'emp1',
        username: 'edk-mosina',
        email: 'mosina@enjoydonerkebab.pl',
        name: 'Mosina Terminal',
        role: 'manager',
        branchId: BRANCH_ID,
      },
    ]);
  });

  it('falls back to the username when no display name is stored', async () => {
    mockGetFullList.mockResolvedValue([
      { id: 'emp2', username: 'rad-leszno', email: '', name: '', role: 'floor_staff', branch_id: [BRANCH_ID] },
    ]);
    const accounts = await fetchBranchStaff(BRANCH_ID);
    expect(accounts[0]?.name).toBe('rad-leszno');
    expect(accounts[0]?.branchId).toBe(BRANCH_ID);
  });
});