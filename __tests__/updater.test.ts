import { isNewerVersion } from '../src/lib/version';

describe('isNewerVersion', () => {
  it('compares release tags against the installed version', () => {
    expect(isNewerVersion('1.4.0', '1.4.0')).toBe(false);
    expect(isNewerVersion('v1.4.1', '1.4.0')).toBe(true);
    expect(isNewerVersion('1.5.0', '1.4.9')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true);
    expect(isNewerVersion('1.3.9', '1.4.0')).toBe(false);
  });

  it('treats missing or malformed segments as zero', () => {
    expect(isNewerVersion('1.4', '1.4.0')).toBe(false);
    expect(isNewerVersion('1.4.1', '1.4')).toBe(true);
    expect(isNewerVersion('v2', '1.9.9')).toBe(true);
  });
});
