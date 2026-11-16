import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { isNewerVersion } from '../lib/version';
import { loadSnapshot, saveSnapshot } from '../db/sqlite';

/**
 * In-app updater for the public GitHub release feed.
 *
 * The release workflow attaches an APK to every `v*` tag. Android installs the
 * downloaded APK directly; iOS has no side-loading path, so it opens the
 * release page instead.
 */

export interface ReleaseInfo {
  version: string;
  tag: string;
  notes: string;
  apkUrl: string | null;
  htmlUrl: string;
  publishedAt: string | null;
}

export interface UpdateCheck {
  available: boolean;
  currentVersion: string;
  release: ReleaseInfo | null;
  /** Set when the check itself failed, so manual checks can report it. */
  error: string | null;
}

/** Download progress as a 0..1 fraction (0 when the total size is unknown). */
export type UpdateProgressHandler = (fraction: number) => void;

/**
 * Release bodies carry raw GitHub links ("Full Changelog: …/compare/…").
 * The terminal UI must never expose repository URLs, so strip them and the
 * changelog footer before display.
 */
export function sanitizeReleaseNotes(notes: string): string {
  return notes
    .replace(/https?:\/\/\S+/gi, '')
    .split('\n')
    .filter((line) => !/full changelog/i.test(line))
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const DEFAULT_REPO = 'THJ420/BB_manager';
const APK_ASSET_NAME = 'bb-manager-preview.apk';
const LAST_UPDATE_ATTEMPT_KEY = 'app_update_last_attempt';
export const UPDATE_CHECK_TIMEOUT_MS = 10_000;
export const AUTOMATIC_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_CHECK_ERROR_MESSAGE =
  'Sorry, server is busy now, please try after a few minutes.';

let updateCheckPromise: Promise<UpdateCheck> | null = null;
let automaticCheckPromise: Promise<UpdateCheck | null> | null = null;
let lastAttemptAt: number | null = null;

function releaseRepo(): string {
  const extra = Constants.expoConfig?.extra as { githubRepo?: unknown } | undefined;
  return typeof extra?.githubRepo === 'string' && extra.githubRepo.trim()
    ? extra.githubRepo.trim()
    : DEFAULT_REPO;
}

export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseRelease(data: unknown): ReleaseInfo {
  if (!isRecord(data) || typeof data.tag_name !== 'string') {
    throw new Error('Invalid update response: missing release tag');
  }
  const tag = data.tag_name.trim();
  const version = tag.replace(/^v/i, '');
  if (
    !/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i.test(version) ||
    !isHttpsUrl(data.html_url) ||
    !Array.isArray(data.assets)
  ) {
    throw new Error('Invalid update response: release version, URL or assets');
  }
  const apkRecords = data.assets.filter(
    (asset): asset is Record<string, unknown> => {
      if (!isRecord(asset) || typeof asset.name !== 'string') {
        throw new Error('Invalid update response: malformed asset');
      }
      if (!/\.apk$/i.test(asset.name)) return false;
      if (!isHttpsUrl(asset.browser_download_url)) {
        throw new Error('Invalid update response: APK URL');
      }
      return true;
    }
  );
  const apk = apkRecords.find((record) => record.name === APK_ASSET_NAME) ?? apkRecords[0];

  return {
    version,
    tag,
    notes: typeof data.body === 'string' ? data.body.trim() : '',
    apkUrl: apk ? (apk.browser_download_url as string) : null,
    htmlUrl: data.html_url,
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
  };
}

async function fetchUpdate(): Promise<UpdateCheck> {
  const currentVersion = currentAppVersion();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    // Race the whole request, including JSON parsing: some transports do not
    // settle promptly on abort, and headers can arrive before a stalled body.
    const release = await Promise.race([
      (async () => {
        const response = await fetch(
          `https://api.github.com/repos/${releaseRepo()}/releases/latest`,
          {
            headers: { Accept: 'application/vnd.github+json' },
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error(`Update server returned HTTP ${response.status}`);
        }
        return parseRelease(await response.json());
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Update check timed out after ${UPDATE_CHECK_TIMEOUT_MS}ms`));
          controller.abort();
        }, UPDATE_CHECK_TIMEOUT_MS);
      }),
    ]);

    return {
      available: isNewerVersion(release.version, currentVersion),
      currentVersion,
      release,
      error: null,
    };
  } catch (error) {
    console.warn('Unable to check for app updates', error);
    return {
      available: false,
      currentVersion,
      release: null,
      error: UPDATE_CHECK_ERROR_MESSAGE,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Manual checks bypass the daily gate but share any request already running. */
export function checkForUpdate(): Promise<UpdateCheck> {
  if (!updateCheckPromise) {
    lastAttemptAt = Date.now();
    // Record attempts before fetching, including failures, so restarting offline
    // cannot hammer the release feed. Keep an in-memory fallback if SQLite fails.
    updateCheckPromise = saveSnapshot(LAST_UPDATE_ATTEMPT_KEY, lastAttemptAt)
      .catch((error) => console.warn('Unable to persist app update attempt', error))
      .then(fetchUpdate)
      .finally(() => {
        updateCheckPromise = null;
      });
  }
  return updateCheckPromise;
}

/** Null means throttled, not "up to date". No release result is cached. */
export function checkForUpdateAutomatically(): Promise<UpdateCheck | null> {
  if (updateCheckPromise) return updateCheckPromise;
  if (!automaticCheckPromise) {
    automaticCheckPromise = (async () => {
      const stored = await loadSnapshot<unknown>(LAST_UPDATE_ATTEMPT_KEY).catch((error) => {
        console.warn('Unable to load app update attempt', error);
        return null;
      });
      // A manual check may have started (or finished) while SQLite was loading.
      if (updateCheckPromise) return updateCheckPromise;
      const previous = lastAttemptAt ?? stored;
      const elapsed = typeof previous === 'number' ? Date.now() - previous : NaN;
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < AUTOMATIC_UPDATE_INTERVAL_MS) {
        return null;
      }
      return checkForUpdate();
    })().finally(() => {
      automaticCheckPromise = null;
    });
  }
  return automaticCheckPromise;
}

export async function downloadAndInstallUpdate(
  release: ReleaseInfo,
  onProgress?: UpdateProgressHandler
): Promise<void> {
  if (Platform.OS !== 'android' || !release.apkUrl) {
    if (release.htmlUrl) {
      await Linking.openURL(release.htmlUrl);
      return;
    }
    throw new Error('No installable file is available for this device.');
  }

  const target = `${FileSystem.cacheDirectory ?? ''}bb-manager-${release.version}.apk`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) {
    onProgress?.(1);
  } else {
    const resumable = FileSystem.createDownloadResumable(
      release.apkUrl,
      target,
      {},
      (progress) => {
        const total = progress.totalBytesExpectedToWrite;
        onProgress?.(total > 0 ? progress.totalBytesWritten / total : 0);
      }
    );
    const result = await resumable.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error('The update could not be downloaded.');
    }
    onProgress?.(1);
  }

  const contentUri = await FileSystem.getContentUriAsync(target);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}
