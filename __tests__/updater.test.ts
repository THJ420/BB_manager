import { isNewerVersion } from '../src/lib/version';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.4.1',
      extra: { githubRepo: 'THJ420/BB_manager' },
    },
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  createDownloadResumable: jest.fn(),
  getContentUriAsync: jest.fn(),
}));
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(),
}));
jest.mock(
  'react-native',
  () => ({
    Platform: { OS: 'android' },
    Linking: { openURL: jest.fn() },
  }),
  { virtual: true }
);

import { checkForUpdate, downloadAndInstallUpdate, sanitizeReleaseNotes } from '../src/services/updater';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

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

describe('checkForUpdate', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    (globalThis as { fetch: unknown }).fetch = fetchMock;
  });

  const releaseResponse = (overrides: Record<string, unknown> = {}) => ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: 'v1.4.2',
      body: 'Release notes',
      html_url: 'https://github.com/THJ420/BB_manager/releases/tag/v1.4.2',
      published_at: '2026-11-09T00:00:00Z',
      assets: [
        {
          name: 'other-build.apk',
          browser_download_url: 'https://example.com/other.apk',
        },
        {
          name: 'bb-manager-preview.apk',
          browser_download_url:
            'https://github.com/THJ420/BB_manager/releases/download/v1.4.2/bb-manager-preview.apk',
        },
      ],
      ...overrides,
    }),
  });

  it('flags a newer tag and prefers the bb-manager-preview.apk asset', async () => {
    fetchMock.mockResolvedValue(releaseResponse());

    const result = await checkForUpdate();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/THJ420/BB_manager/releases/latest',
      expect.objectContaining({ headers: { Accept: 'application/vnd.github+json' } })
    );
    expect(result.available).toBe(true);
    expect(result.error).toBeNull();
    expect(result.currentVersion).toBe('1.4.1');
    expect(result.release?.version).toBe('1.4.2');
    expect(result.release?.tag).toBe('v1.4.2');
    expect(result.release?.apkUrl).toBe(
      'https://github.com/THJ420/BB_manager/releases/download/v1.4.2/bb-manager-preview.apk'
    );
  });

  it('reports up to date when the tag matches the installed version', async () => {
    fetchMock.mockResolvedValue(releaseResponse({ tag_name: 'v1.4.1' }));

    const result = await checkForUpdate();

    expect(result.available).toBe(false);
    expect(result.error).toBeNull();
    expect(result.release?.version).toBe('1.4.1');
  });

  it('surfaces HTTP failures so manual checks can report them', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

    const result = await checkForUpdate();

    expect(result.available).toBe(false);
    expect(result.release).toBeNull();
    expect(result.error).toContain('403');
  });

  it('surfaces network failures without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await checkForUpdate();

    expect(result.available).toBe(false);
    expect(result.release).toBeNull();
    expect(result.error).toContain('GitHub');
  });

  it('falls back to any APK asset when the preview file is missing', async () => {
    fetchMock.mockResolvedValue(
      releaseResponse({
        assets: [
          {
            name: 'bb-manager-standalone.apk',
            browser_download_url: 'https://example.com/standalone.apk',
          },
        ],
      })
    );

    const result = await checkForUpdate();

    expect(result.available).toBe(true);
    expect(result.release?.apkUrl).toBe('https://example.com/standalone.apk');
  });
});

describe('sanitizeReleaseNotes', () => {
  it('strips raw GitHub compare and repository URLs', () => {
    const notes = [
      '## What\'s Changed',
      '* feat: store search by @THJ420 in https://github.com/THJ420/BB_manager/pull/12',
      '',
      '**Full Changelog**: https://github.com/THJ420/BB_manager/compare/v1.4.3...v1.4.4',
    ].join('\n');

    const cleaned = sanitizeReleaseNotes(notes);

    expect(cleaned).not.toContain('github.com');
    expect(cleaned).not.toContain('http');
    expect(cleaned).not.toMatch(/full changelog/i);
    expect(cleaned).toContain('feat: store search');
  });

  it('keeps ordinary prose and collapses leftover blank lines', () => {
    expect(sanitizeReleaseNotes('Fix A\n\n\nFix B\n')).toBe('Fix A\n\nFix B');
    expect(sanitizeReleaseNotes('')).toBe('');
  });
});

describe('downloadAndInstallUpdate progress', () => {
  const release = {
    version: '1.4.5',
    tag: 'v1.4.5',
    notes: '',
    apkUrl: 'https://example.com/bb-manager-preview.apk',
    htmlUrl: 'https://example.com/release',
    publishedAt: null,
  };

  beforeEach(() => {
    jest.mocked(FileSystem.getInfoAsync).mockReset();
    jest.mocked(FileSystem.createDownloadResumable).mockReset();
    jest.mocked(FileSystem.getContentUriAsync).mockReset();
    jest.mocked(IntentLauncher.startActivityAsync).mockReset();
  });

  it('reports download fractions and launches the installer intent', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false } as never);
    jest.mocked(FileSystem.getContentUriAsync).mockResolvedValue('content://apk');
    jest
      .mocked(FileSystem.createDownloadResumable)
      .mockImplementation((_url, _target, _options, callback) => {
        callback?.({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
        return {
          downloadAsync: async () => {
            callback?.({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 });
            return { status: 200, uri: 'file:///cache/app.apk', headers: {}, md5: '' };
          },
        } as never;
      });

    const fractions: number[] = [];
    await downloadAndInstallUpdate(release, (fraction) => fractions.push(fraction));

    expect(fractions).toEqual([0.5, 1, 1]);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.VIEW',
      expect.objectContaining({ type: 'application/vnd.android.package-archive' })
    );
  });

  it('skips the download when the APK is already cached', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as never);
    jest.mocked(FileSystem.getContentUriAsync).mockResolvedValue('content://apk');

    const fractions: number[] = [];
    await downloadAndInstallUpdate(release, (fraction) => fractions.push(fraction));

    expect(FileSystem.createDownloadResumable).not.toHaveBeenCalled();
    expect(fractions).toEqual([1]);
  });
});