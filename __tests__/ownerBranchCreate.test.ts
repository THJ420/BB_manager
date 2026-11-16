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
  CreateBranchInput,
  createOwnerBranch,
  normalizeBranchCode,
  storeNameSuggestion,
  validateBranchCode,
} from '../src/services/branches';

const VALID_MAPS_EMBED =
  '<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600" height="450"></iframe>';

function baseInput(overrides: Partial<CreateBranchInput> = {}): CreateBranchInput {
  return {
    name: 'Mosina Enjoy Doner Kebab',
    code: 'edk mosina',
    address: 'Poznańska 3, 62-050 Mosina',
    phone: '+48 61 123 45 67',
    openingHours: 'Mon–Sun 11:00–22:00',
    facebookUrl: 'https://facebook.com/edkmosina',
    menuDownloadUrl: 'https://enjoydonerkebab.pl/menu.pdf',
    mapsEmbed: VALID_MAPS_EMBED,
    ...overrides,
  };
}

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

describe('store name suggestion', () => {
  it('derives "{City} Enjoy Doner Kebab" from the branch code', () => {
    expect(storeNameSuggestion('EDK-MOSINA')).toBe('Mosina Enjoy Doner Kebab');
    expect(storeNameSuggestion('edk poznan')).toBe('Poznan Enjoy Doner Kebab');
    expect(storeNameSuggestion('EDK-NOWY-TOMYSL')).toBe('Nowy tomysl Enjoy Doner Kebab');
  });

  it('returns empty when the code has no city part', () => {
    expect(storeNameSuggestion('')).toBe('');
    expect(storeNameSuggestion('EDK')).toBe('');
    expect(storeNameSuggestion('   ')).toBe('');
  });
});

describe('createOwnerBranch', () => {
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
    await expect(createOwnerBranch(baseInput(), [])).rejects.toThrow(/Only the owner/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates an active EDK branch with the full storefront profile', async () => {
    const input = baseInput();
    mockCreate.mockResolvedValue({
      id: 'newbranch1',
      name: input.name,
      code: 'EDK-MOSINA',
      address: input.address,
      phone: input.phone,
      opening_hours: input.openingHours,
      facebook_url: input.facebookUrl,
      menu_download_url: input.menuDownloadUrl,
      maps_embed: input.mapsEmbed,
      is_active: true,
    });
    const branch = await createOwnerBranch(input, ['EDK-POZNAN']);
    expect(mockCreate).toHaveBeenCalledWith({
      name: input.name,
      code: 'EDK-MOSINA',
      slug: 'edk-mosina',
      address: input.address,
      phone: input.phone,
      opening_hours: input.openingHours,
      facebook_url: input.facebookUrl,
      menu_download_url: input.menuDownloadUrl,
      maps_embed: input.mapsEmbed,
      select: 'enjoydonerkebab',
      is_active: true,
      is_accepting_orders: true,
    });
    expect(branch.code).toBe('EDK-MOSINA');
    expect(branch.isActive).toBe(true);
    expect(branch.openingHours).toBe(input.openingHours);
    expect(branch.facebookUrl).toBe(input.facebookUrl);
    expect(branch.menuDownloadUrl).toBe(input.menuDownloadUrl);
    expect(branch.mapsEmbed).toBe(input.mapsEmbed);
  });

  it('accepts empty optional profile fields', async () => {
    const input = baseInput({
      phone: '',
      openingHours: '',
      facebookUrl: '',
      menuDownloadUrl: '',
      mapsEmbed: '',
    });
    mockCreate.mockResolvedValue({
      id: 'newbranch2',
      name: input.name,
      code: 'EDK-MOSINA',
      is_active: true,
    });
    await createOwnerBranch(input, []);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '',
        opening_hours: '',
        facebook_url: '',
        menu_download_url: '',
        maps_embed: '',
      })
    );
  });

  it('rejects duplicate codes before hitting PocketBase', async () => {
    await expect(createOwnerBranch(baseInput(), ['EDK-MOSINA'])).rejects.toThrow(
      /already in use/
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires a store name', async () => {
    await expect(createOwnerBranch(baseInput({ name: '   ' }), [])).rejects.toThrow(
      /Enter the store name/
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects malformed Facebook and menu links', async () => {
    await expect(
      createOwnerBranch(baseInput({ facebookUrl: 'facebook.com/edkmosina' }), [])
    ).rejects.toThrow(/Facebook page link must be a full link/);
    await expect(
      createOwnerBranch(baseInput({ menuDownloadUrl: 'not-a-url' }), [])
    ).rejects.toThrow(/Download menu link must be a full link/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a maps value that is not a Google Maps iframe embed', async () => {
    await expect(
      createOwnerBranch(baseInput({ mapsEmbed: 'https://maps.google.com/?q=Mosina' }), [])
    ).rejects.toThrow(/full Google Maps embed code/);
    await expect(
      createOwnerBranch(
        baseInput({ mapsEmbed: '<iframe src="https://example.com/map"></iframe>' }),
        []
      )
    ).rejects.toThrow(/full Google Maps embed code/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});