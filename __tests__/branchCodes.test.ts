import { branchCodesMatch, normalizeBranchCode } from '../src/lib/branchCodes';

describe('branch code normalisation', () => {
  it('treats hyphens, underscores, dots and spaces as the same separator', () => {
    expect(normalizeBranchCode('RADHUNI-2-0')).toBe('RADHUNI-2-0');
    expect(normalizeBranchCode('radhuni_2_0')).toBe('RADHUNI-2-0');
    expect(normalizeBranchCode('RADHUNI 2 0')).toBe('RADHUNI-2-0');
    expect(normalizeBranchCode('radhuni.2.0')).toBe('RADHUNI-2-0');
  });

  it('ignores surrounding and repeated whitespace', () => {
    expect(normalizeBranchCode('  radhuni-2-0  ')).toBe('RADHUNI-2-0');
    expect(normalizeBranchCode('RADHUNI---2---0')).toBe('RADHUNI-2-0');
    expect(normalizeBranchCode('\tRADHUNI_2_0\n')).toBe('RADHUNI-2-0');
  });

  it('matches equivalent codes and rejects genuinely different ones', () => {
    expect(branchCodesMatch('RADHUNI-2-0', 'radhuni_2_0')).toBe(true);
    expect(branchCodesMatch(' DT-01 ', 'dt-01')).toBe(true);
    expect(branchCodesMatch('RADHUNI-2-0', 'RADHUNI-3-0')).toBe(false);
    expect(branchCodesMatch('RADHUNI-2-0', '')).toBe(false);
    expect(branchCodesMatch('', '')).toBe(false);
  });
});