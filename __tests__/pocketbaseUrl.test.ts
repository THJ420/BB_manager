import {
  DEFAULT_POCKETBASE_URL,
  normalizePocketBaseUrl,
  resolvePocketBaseUrl,
} from '../src/services/pocketbaseUrl';

describe('normalizePocketBaseUrl', () => {
  it('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizePocketBaseUrl('  https://pocket.enjoydonerkebab.pl///  ')).toBe(
      'https://pocket.enjoydonerkebab.pl'
    );
  });

  it('keeps a single slash-free origin untouched', () => {
    expect(normalizePocketBaseUrl(DEFAULT_POCKETBASE_URL)).toBe(DEFAULT_POCKETBASE_URL);
  });

  it('keeps slashes that are part of an API path', () => {
    expect(normalizePocketBaseUrl('https://example.com/pb/')).toBe(
      'https://example.com/pb'
    );
  });

  it('returns an empty string for non-string or blank input', () => {
    expect(normalizePocketBaseUrl(undefined)).toBe('');
    expect(normalizePocketBaseUrl(null)).toBe('');
    expect(normalizePocketBaseUrl(42)).toBe('');
    expect(normalizePocketBaseUrl('   ')).toBe('');
    expect(normalizePocketBaseUrl('///')).toBe('');
  });
});

describe('resolvePocketBaseUrl', () => {
  it('uses the env URL and strips trailing slashes', () => {
    expect(
      resolvePocketBaseUrl({
        envUrl: 'https://pocket.enjoydonerkebab.pl/',
        extraUrl: 'https://other.example.com',
      })
    ).toEqual({
      url: DEFAULT_POCKETBASE_URL,
      configured: true,
      source: 'env',
    });
  });

  it('never falls into demo mode when the env URL is set but the manifest says demo', () => {
    const result = resolvePocketBaseUrl({
      envUrl: 'https://pocket.enjoydonerkebab.pl',
      extraUrl: 'demo',
    });
    expect(result.configured).toBe(true);
    expect(result.url).toBe(DEFAULT_POCKETBASE_URL);
  });

  it('falls back to the native manifest when the env var was not inlined', () => {
    expect(
      resolvePocketBaseUrl({
        envUrl: undefined,
        extraUrl: 'https://pocket.enjoydonerkebab.pl//',
      })
    ).toEqual({
      url: DEFAULT_POCKETBASE_URL,
      configured: true,
      source: 'expo-config',
    });
  });

  it('treats a blank env var as missing and still uses the manifest URL', () => {
    const result = resolvePocketBaseUrl({
      envUrl: '   ',
      extraUrl: DEFAULT_POCKETBASE_URL,
    });
    expect(result.configured).toBe(true);
    expect(result.source).toBe('expo-config');
  });

  it('enters demo mode only for an explicit demo value in either channel', () => {
    expect(
      resolvePocketBaseUrl({
        envUrl: ' DEMO ',
        extraUrl: DEFAULT_POCKETBASE_URL,
      })
    ).toEqual({
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'explicit-demo',
    });

    expect(
      resolvePocketBaseUrl({ envUrl: undefined, extraUrl: 'demo' })
    ).toEqual({
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'explicit-demo',
    });
  });

  it('enters demo mode only when both channels are explicitly missing', () => {
    expect(resolvePocketBaseUrl({})).toEqual({
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'missing',
    });
    expect(resolvePocketBaseUrl({ envUrl: '', extraUrl: undefined })).toEqual({
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'missing',
    });
  });

  it('does not crash on malformed values', () => {
    expect(
      resolvePocketBaseUrl({
        envUrl: 123,
        extraUrl: { url: DEFAULT_POCKETBASE_URL },
      })
    ).toEqual({
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'missing',
    });
  });
});
