jest.mock('../src/services/pocketbase', () => ({
  isPocketBaseConfigured: false,
  pb: {
    authStore: { clear: jest.fn(), record: null },
    collection: jest.fn(),
    filter: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

import { findBranchByCode } from '../src/services/auth';

describe('findBranchByCode', () => {
  it('matches demo branch codes regardless of case, spaces, hyphens or underscores', () => {
    expect(findBranchByCode('DT-01')?.id).toBe('branch_dt_01');
    expect(findBranchByCode('dt_01')?.id).toBe('branch_dt_01');
    expect(findBranchByCode('  dt 01  ')?.id).toBe('branch_dt_01');
    expect(findBranchByCode('ub_02')?.id).toBe('branch_ub_02');
  });

  it('returns undefined for a live PocketBase-only code in demo mode', () => {
    expect(findBranchByCode('RADHUNI-2-0')).toBeUndefined();
  });
});