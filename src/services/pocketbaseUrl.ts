/**
 * PocketBase origin resolution, kept free of React Native and expo-constants
 * imports so the rules can be unit-tested in plain Node.
 *
 * Two independent channels carry the URL into a build:
 *   1. `EXPO_PUBLIC_POCKETBASE_URL`, inlined into the JS bundle by Metro.
 *   2. `extra.pocketbaseUrl`, written into the native manifest by
 *      `app.config.js` when the Expo CLI evaluates the config on the build
 *      machine (EAS cloud, `eas build --local`, GitHub Actions, prebuild).
 *
 * Channel 2 is the reliable one: it is baked in at prebuild time even when the
 * JS bundling step does not inherit the environment variable. A configured
 * build must therefore never silently fall back to local demo mode.
 */

export const DEFAULT_POCKETBASE_URL = 'https://pocket.enjoydonerkebab.pl';
export const DEMO_MODE_VALUE = 'demo';

/** Trim whitespace and every trailing slash so requests never hit `//api/...`. */
export function normalizePocketBaseUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

export type PocketBaseUrlSource = 'env' | 'expo-config' | 'demo';
export type PocketBaseDemoReason = 'explicit-demo' | 'missing';

export interface PocketBaseUrlResolution {
  /** Empty in demo mode. */
  url: string;
  /** `false` means local demo mode: SQLite only, no PocketBase network calls. */
  configured: boolean;
  source: PocketBaseUrlSource;
  demoReason?: PocketBaseDemoReason;
}

export interface PocketBaseUrlInputs {
  /** `process.env.EXPO_PUBLIC_POCKETBASE_URL` (may be undefined at runtime). */
  envUrl?: unknown;
  /** `Constants.expoConfig.extra.pocketbaseUrl`. */
  extraUrl?: unknown;
}

function isExplicitDemo(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.trim().toLowerCase() === DEMO_MODE_VALUE
  );
}

/**
 * Resolve the PocketBase origin for this build. Demo mode is entered ONLY when
 * both channels are explicitly empty, or when an explicit `demo` value
 * requests it. A non-empty URL in either channel always wins.
 */
export function resolvePocketBaseUrl(
  inputs: PocketBaseUrlInputs = {}
): PocketBaseUrlResolution {
  if (isExplicitDemo(inputs.envUrl)) {
    return {
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'explicit-demo',
    };
  }

  const fromEnv = normalizePocketBaseUrl(inputs.envUrl);
  if (fromEnv) {
    return { url: fromEnv, configured: true, source: 'env' };
  }

  if (isExplicitDemo(inputs.extraUrl)) {
    return {
      url: '',
      configured: false,
      source: 'demo',
      demoReason: 'explicit-demo',
    };
  }

  const fromExtra = normalizePocketBaseUrl(inputs.extraUrl);
  if (fromExtra) {
    return { url: fromExtra, configured: true, source: 'expo-config' };
  }

  // Genuinely unconfigured (e.g. an old static app.json build): local demo.
  return {
    url: '',
    configured: false,
    source: 'demo',
    demoReason: 'missing',
  };
}
