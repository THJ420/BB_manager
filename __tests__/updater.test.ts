import { isNewerVersion } from '../src/lib/version';

const mockSnapshots = new Map<string, unknown>();

jest.mock('../src/db/sqlite', () => ({
  loadSnapshot: jest.fn(async (key: string) => mockSnapshots.get(key) ?? null),
  saveSnapshot: jest.fn(async (key: string, value: unknown) => {
    mockSnapshots.set(key, value);
  }),
}));

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

import {
  checkForUpdate,
  downloadAndInstallUpdate,
  sanitizeReleaseNotes,
  UPDATE_CHECK_TIMEOUT_MS,
} from '../src/services/updater';

const failureMessage = 'Sorry, server is busy now, please try after a few minutes.';
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockSnapshots.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
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

  it.each([400, 401, 403, 404, 408, 429, 500, 502, 503])(
    'uses the exact friendly message for HTTP %s and logs the status',
    async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });

      const result = await checkForUpdate();

      expect(result.available).toBe(false);
      expect(result.release).toBeNull();
      expect(result.error).toBe(failureMessage);
      expect(console.warn).toHaveBeenCalledWith(
        'Unable to check for app updates',
        expect.objectContaining({ message: `Update server returned HTTP ${status}` })
      );
    }
  );

  it.each(['offline', 'Network request failed', 'DNS lookup failed'])(
    'uses the exact friendly message for %s without losing diagnostics',
    async (message) => {
      const error = new TypeError(message);
      fetchMock.mockRejectedValue(error);

      const result = await checkForUpdate();

      expect(result.available).toBe(false);
      expect(result.release).toBeNull();
      expect(result.error).toBe(failureMessage);
      expect(console.warn).toHaveBeenCalledWith('Unable to check for app updates', error);
    }
  );

  it.each([
    null,
    [],
    'not a release',
    {},
    { tag_name: 123 },
    { tag_name: '' },
    { tag_name: 'not-a-version' },
    { tag_name: 'v1.4.2oops' },
  ])('rejects malformed release payloads: %p', async (data) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => data });
    expect(await checkForUpdate()).toMatchObject({
      available: false, release: null, error: failureMessage,
    });
  });

  it.each([
    { tag_name: '' },
    { tag_name: 'latest' },
    { html_url: '' },
    { html_url: 'not a URL' },
    { html_url: 'javascript:alert(1)' },
    { assets: null },
    { assets: {} },
    { assets: [null] },
    { assets: [{ name: 'app.apk', browser_download_url: 'broken' }] },
  ])('rejects invalid fields rather than reporting up to date: %p', async (overrides) => {
    fetchMock.mockResolvedValue(releaseResponse(overrides));
    expect(await checkForUpdate()).toMatchObject({
      available: false, release: null, error: failureMessage,
    });
  });

  it('handles invalid JSON with the same message', async () => {
    const error = new SyntaxError('Unexpected token <');
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw error; } });
    expect((await checkForUpdate()).error).toBe(failureMessage);
    expect(console.warn).toHaveBeenCalledWith('Unable to check for app updates', error);
  });

  it.each(['fetch', 'body'])('bounds a stalled %s even when abort is ignored', async (stage) => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => stage === 'fetch'
      ? new Promise(() => undefined)
      : Promise.resolve({ ok: true, json: () => new Promise(() => undefined) }));

    const pending = checkForUpdate();
    let settled = false;
    void pending.then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(UPDATE_CHECK_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({
      available: false, release: null, error: failureMessage,
    });
    expect(signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      'Unable to check for app updates',
      expect.objectContaining({ message: `Update check timed out after ${UPDATE_CHECK_TIMEOUT_MS}ms` })
    );

    // A timed-out request must not leave the shared promise locked forever.
    fetchMock.mockResolvedValue(releaseResponse());
    expect((await checkForUpdate()).available).toBe(true);
  });

  it('clears the timeout after a successful response', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(releaseResponse());
    await checkForUpdate();
    expect(jest.getTimerCount()).toBe(0);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it('allows releases without APKs so the release-page fallback can be used', async () => {
    fetchMock.mockResolvedValue(releaseResponse({ assets: [], body: null }));
    expect(await checkForUpdate()).toMatchObject({
      available: true, error: null, release: { apkUrl: null, notes: '' },
    });
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

describe('automatic update scheduling', () => {
  let updater: typeof import('../src/services/updater');
  let storage: typeof import('../src/db/sqlite');
  const fetchMock = jest.fn();
  const startedAt = Date.UTC(2026, 10, 10);
  const snapshotKey = 'app_update_last_attempt';
  const response = {
    ok: true,
    json: async () => ({
      tag_name: 'v1.4.2',
      html_url: 'https://example.com/release',
      assets: [],
    }),
  };

  function restart() {
    // Clear module memory and global mock call counts, retaining SQLite data.
    jest.resetModules();
    updater = require('../src/services/updater');
    storage = require('../src/db/sqlite');
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(startedAt);
    fetchMock.mockReset().mockResolvedValue(response);
    globalThis.fetch = fetchMock;
    restart();
  });

  it('checks on first startup, skips foregrounds within 24 hours, and checks at the boundary', async () => {
    expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
    expect(mockSnapshots.get(snapshotKey)).toBe(startedAt);
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    jest.setSystemTime(startedAt + updater.AUTOMATIC_UPDATE_INTERVAL_MS - 1);
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.setSystemTime(startedAt + updater.AUTOMATIC_UPDATE_INTERVAL_MS);
    expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retains the daily gate across process restarts without caching a release result', async () => {
    await updater.checkForUpdateAutomatically();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    restart();
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSnapshots.size).toBe(1);
    jest.setSystemTime(startedAt + updater.AUTOMATIC_UPDATE_INTERVAL_MS);
    restart();
    await updater.checkForUpdateAutomatically();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['HTTP', 'offline', 'timeout'])('throttles %s failures across restarts too', async (kind) => {
    if (kind === 'HTTP') fetchMock.mockResolvedValue({ ok: false, status: 403 });
    if (kind === 'offline') fetchMock.mockRejectedValue(new Error('offline'));
    if (kind === 'timeout') fetchMock.mockImplementation(() => new Promise(() => undefined));
    const pending = updater.checkForUpdateAutomatically();
    if (kind === 'timeout') await jest.advanceTimersByTimeAsync(updater.UPDATE_CHECK_TIMEOUT_MS);
    expect((await pending)?.error).toBe(failureMessage);
    expect(mockSnapshots.get(snapshotKey)).toBe(startedAt);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    restart();
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    jest.setSystemTime(startedAt + updater.AUTOMATIC_UPDATE_INTERVAL_MS);
    fetchMock.mockResolvedValue(response);
    expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('always allows sequential manual retries within the daily interval, including after failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect((await updater.checkForUpdateAutomatically())?.error).toBe(failureMessage);
    expect((await updater.checkForUpdate()).available).toBe(true);
    expect((await updater.checkForUpdate()).available).toBe(true);
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('coalesces automatic bursts and a manual check joining an automatic request', async () => {
    let resolveFetch!: (value: typeof response) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const automatic = updater.checkForUpdateAutomatically();
    expect(updater.checkForUpdateAutomatically()).toBe(automatic);
    await jest.advanceTimersByTimeAsync(0);
    expect(mockSnapshots.get(snapshotKey)).toBe(startedAt);
    const manual = updater.checkForUpdate();
    expect(updater.checkForUpdate()).toBe(manual);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(response);
    expect(await automatic).toBe(await manual);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares a manual request with a simultaneous automatic check', async () => {
    const manual = updater.checkForUpdate();
    const automatic = updater.checkForUpdateAutomatically();
    expect(automatic).toBe(manual);
    expect(await automatic).toBe(await manual);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not start another request when a manual check finishes during a slow snapshot read', async () => {
    let resolveRead!: (value: null) => void;
    jest.mocked(storage.loadSnapshot).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRead = resolve; })
    );
    const automatic = updater.checkForUpdateAutomatically();
    expect((await updater.checkForUpdate()).available).toBe(true);
    resolveRead(null);
    expect(await automatic).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares failures too and releases the lock for a later manual retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const first = updater.checkForUpdate();
    const second = updater.checkForUpdate();
    expect(second).toBe(first);
    expect((await first).error).toBe(failureMessage);
    expect((await updater.checkForUpdate()).error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps checks usable and throttles in memory if persistence fails', async () => {
    jest.mocked(storage.loadSnapshot).mockRejectedValue(new Error('read failed'));
    jest.mocked(storage.saveSnapshot).mockRejectedValue(new Error('write failed'));
    expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await updater.checkForUpdate()).error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      'Unable to persist app update attempt', expect.objectContaining({ message: 'write failed' })
    );
  });

  it.each([null, 'corrupt', {}, NaN, Infinity, startedAt + 60_000])(
    'recovers from invalid timestamps or a clock rollback: %p', async (stored) => {
      mockSnapshots.set(snapshotKey, stored);
      expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it('never replays an obsolete available result after installing a newer app', async () => {
    expect((await updater.checkForUpdateAutomatically())?.available).toBe(true);
    restart();
    const constants = require('expo-constants').default;
    constants.expoConfig.version = '1.4.2';
    expect(await updater.checkForUpdateAutomatically()).toBeNull();
    expect(await updater.checkForUpdate()).toMatchObject({
      available: false, currentVersion: '1.4.2', error: null,
    });
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