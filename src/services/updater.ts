import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { isNewerVersion } from '../lib/version';

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

const DEFAULT_REPO = 'THJ420/BB_manager';
const APK_ASSET_NAME = 'bb-manager-preview.apk';

function releaseRepo(): string {
  const extra = Constants.expoConfig?.extra as { githubRepo?: unknown } | undefined;
  return typeof extra?.githubRepo === 'string' && extra.githubRepo.trim()
    ? extra.githubRepo.trim()
    : DEFAULT_REPO;
}

export function currentAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const currentVersion = currentAppVersion();

  try {
    const response = await fetch(
      `https://api.github.com/repos/${releaseRepo()}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!response.ok) {
      return {
        available: false,
        currentVersion,
        release: null,
        error: `GitHub returned HTTP ${response.status}. Try again in a moment.`,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const tag = String(data.tag_name ?? data.name ?? '').trim();
    const version = tag.replace(/^v/i, '');
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apkRecords = assets
      .map((asset) => asset as Record<string, unknown>)
      .filter((record) => /\.apk$/i.test(String(record.name ?? '')));
    const apk =
      apkRecords.find((record) => String(record.name) === APK_ASSET_NAME) ??
      apkRecords[0];

    const release: ReleaseInfo = {
      version,
      tag,
      notes: String(data.body ?? '').trim(),
      apkUrl: typeof apk?.browser_download_url === 'string' ? apk.browser_download_url : null,
      htmlUrl: String(data.html_url ?? ''),
      publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
    };

    return {
      available: version ? isNewerVersion(version, currentVersion) : false,
      currentVersion,
      release,
      error: null,
    };
  } catch {
    return {
      available: false,
      currentVersion,
      release: null,
      error: 'Could not reach GitHub. Check the network connection and try again.',
    };
  }
}

export async function downloadAndInstallUpdate(release: ReleaseInfo): Promise<void> {
  if (Platform.OS !== 'android' || !release.apkUrl) {
    if (release.htmlUrl) {
      await Linking.openURL(release.htmlUrl);
      return;
    }
    throw new Error('No installable file is available for this device.');
  }

  const target = `${FileSystem.cacheDirectory ?? ''}bb-manager-${release.version}.apk`;
  const existing = await FileSystem.getInfoAsync(target);
  if (!existing.exists) {
    const result = await FileSystem.downloadAsync(release.apkUrl, target);
    if (result.status !== 200) {
      throw new Error('The update could not be downloaded.');
    }
  }

  const contentUri = await FileSystem.getContentUriAsync(target);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}
