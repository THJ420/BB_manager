const mockCreate = jest.fn();

jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: true,
  pb: {
    authStore: { record: { id: 'owner1', role: 'owner', branch_id: '' } as unknown },
    collection: jest.fn(() => ({ create: mockCreate })),
  },
}));

import { pb } from '../src/services/pocketbase';
import {
  BRANCH_SELECT_OPTIONS,
  createOwnerBranch,
  normalizeBranchCode,
  validateBranchCode,
} from '../src/services/branches';

describe('owner branch code normalisation', () => {
  it('uppercases and turns spaces into dashes', () => {
    expect(normalizeBranchCode('edk poznan')).toBe('EDK-POZNAN');
    expect(normalizeBranchCode('  mkg   kebab  ')).toBe('MKG-KEBAB');
    expect(normalizeBranchCode('rad-leszno')).toBe('RAD-LESZNO');
  });
});

describe('owner branch code validation', () => {
  const existing = ['EDK-POZNAN', 'CC-POZNAN', 'RAD-LESZNO', 'MKG-KEBAB'];

  it('accepts the curated brand-city format', () => {
    expect(validateBranchCode('EDK-MOSINA', existing)).toBeNull();
    expect(validateBranchCode('RADHUNI-2-0', existing)).toBeNull();
  });

  it('rejects empty and malformed codes', () => {
    expect(validateBranchCode('', existing)).toMatch(/Enter a branch code/);
    expect(validateBranchCode('EDK', existing)).toMatch(/brand prefix/);
    expect(validateBranchCode('edk-mosina', existing)).toMatch(/brand prefix/);
    expect(validateBranchCode('EDK MOSINA', existing)).toMatch(/brand prefix/);
    expect(validateBranchCode('EDK_MOSINA', existing)).toMatch(/brand prefix/);
  });

  it('rejects codes already in use, case-insensitively', () => {
    expect(validateBranchCode('EDK-POZNAN', existing)).toMatch(/already in use/);
    expect(validateBranchCode('EDK-POZNAN', ['edk-poznan'])).toMatch(/already in use/);
  });
});

describe('brand select options', () => {
  it('matches the PocketBase select values', () => {
    expect(BRANCH_SELECT_OPTIONS.map((option) => option.id)).toEqual([
      'enjoydonerkebab',
      'crispychicken',
      'radhuni 2.0',
    ]);
  });
});

describe('createOwnerBranch', () => {
  const input = {
    name: 'Enjoy Doner Kebab Mosina',
    code: 'edk mosina',
    address: 'Poznańska 3, Mosina',
    select: 'enjoydonerkebab' as const,
  };

  beforeEach(() => {
    mockCreate.mockReset();
    (pb.authStore as { record: unknown }).record = {
      id: 'owner1',
      role: 'owner',
      branch_id: '',
    };
  });

  it('refuses non-owner sessions', async () => {
    (pb.authStore as { record: unknown }).record = {
      id: 'm1',
      role: 'manager',
      branch_id: 'b1',
    };
    await expect(createOwnerBranch(input, [])).rejects.toThrow(/Only the owner/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates an active branch with the normalized code and lowercase slug', async () => {
    mockCreate.mockResolvedValue({
      id: 'newbranch1',
      name: input.name,
      code: 'EDK-MOSINA',
      address: input.address,
      is_active: true,
    });
    const branch = await createOwnerBranch(input, ['EDK-POZNAN']);
    expect(mockCreate).toHaveBeenCalledWith({
      name: input.name,
      code: 'EDK-MOSINA',
      slug: 'edk-mosina',
      address: input.address,
      select: 'enjoydonerkebab',
      is_active: true,
      is_accepting_orders: true,
    });
    expect(branch.code).toBe('EDK-MOSINA');
    expect(branch.isActive).toBe(true);
  });

  it('rejects duplicate codes before hitting PocketBase', async () => {
    await expect(createOwnerBranch(input, ['EDK-MOSINA'])).rejects.toThrow(
      /already in use/
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});