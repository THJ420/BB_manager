import PocketBase, { AsyncAuthStore } from 'pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { installEventSourcePolyfill } from './eventSource';
import {
  normalizePocketBaseUrl,
  resolvePocketBaseUrl,
  type PocketBaseDemoReason,
  type PocketBaseUrlSource,
} from './pocketbaseUrl';

// React Native has no global EventSource. PocketBase's realtime service opens its
// SSE channel with `new EventSource(...)`, so install the XHR-based polyfill
// *before* the client is constructed or the first `collection().subscribe()`.
installEventSourcePolyfill();

const AUTH_STORAGE_KEY = 'bb_pocketbase_auth';

/**
 * Read `extra.pocketbaseUrl` from the manifest that app.config.js embedded at
 * prebuild time. `expoConfig` is populated for EAS builds, but modern EAS
 * Update manifests keep their config under `manifest2.extra.expoConfig`, so
 * both shapes are checked before giving up.
 */
function readExpoExtra(): Record<string, unknown> {
  const constants = Constants as unknown as {
    expoConfig?: { extra?: Record<string, unknown> } | null;
    manifest2?: {
      extra?: { expoConfig?: { extra?: Record<string, unknown> } };
    } | null;
  };
  const extra =
    constants.expoConfig?.extra ??
    constants.manifest2?.extra?.expoConfig?.extra;
  return extra && typeof extra === 'object' ? extra : {};
}

/**
 * Resolution order: the inlined EXPO_PUBLIC_POCKETBASE_URL first, then the URL
 * baked into the native manifest by app.config.js. Only a genuinely empty pair
 * (or an explicit `demo` value) enables local demo mode, so a build that was
 * given a URL can never silently lose its live backend.
 */
const resolution = resolvePocketBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_POCKETBASE_URL,
  extraUrl: readExpoExtra().pocketbaseUrl,
});

/** `false` = local demo mode (SQLite is the source of truth, no realtime). */
export const isPocketBaseConfigured = resolution.configured;
export const pocketBaseUrlSource: PocketBaseUrlSource = resolution.source;
export const pocketBaseDemoReason: PocketBaseDemoReason | null =
  resolution.demoReason ?? null;

// In demo mode the client is never used for network I/O (all services are
// gated on isPocketBaseConfigured); the placeholder keeps the SDK constructible.
const baseUrl = resolution.configured ? resolution.url : 'http://127.0.0.1:8090';

export const pbAuthStore = new AsyncAuthStore({
  save: async (serialized: string) => {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, serialized);
    } catch (error) {
      console.warn('Unable to persist PocketBase session', error);
    }
  },
  clear: async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear PocketBase session', error);
    }
  },
  initial: AsyncStorage.getItem(AUTH_STORAGE_KEY).then((value) => value ?? ''),
});

export const pb = new PocketBase(baseUrl, pbAuthStore);

pb.autoCancellation(false);

/** Fail a hung request instead of freezing the whole outbox flush. */
export const POCKETBASE_REQUEST_TIMEOUT_MS = 20_000;

let transportLogging = __DEV__;

export function setTransportLogging(enabled: boolean): void {
  transportLogging = enabled;
}

const requestTimeouts = new WeakMap<AbortSignal, ReturnType<typeof setTimeout>>();

pb.beforeSend = (url, options) => {
  if (typeof AbortController === 'function') {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      POCKETBASE_REQUEST_TIMEOUT_MS
    );
    (options as { signal?: AbortSignal }).signal = controller.signal;
    requestTimeouts.set(controller.signal, timer);
  }
  if (transportLogging) {
    console.log(`[pb:req] ${(options.method ?? 'GET').toUpperCase()} ${url}`);
  }
  return { url, options };
};

pb.afterSend = (response, data, options?: { signal?: AbortSignal | null }) => {
  const signal = options?.signal ?? undefined;
  if (signal) {
    const timer = requestTimeouts.get(signal);
    if (timer) {
      clearTimeout(timer);
      requestTimeouts.delete(signal);
    }
  }
  if (transportLogging) {
    console.log(`[pb:res] ${response.status} ${response.url}`);
  }
  return data;
};

export function setPocketBaseUrl(url: string): void {
  const trimmed = normalizePocketBaseUrl(url);
  if (trimmed.startsWith('http')) {
    pb.baseUrl = trimmed;
  }
}

/**
 * Lightweight reachability check used to leave OFFLINE mode. Uses a plain fetch
 * so it does not depend on the auth store or SDK retries.
 */
export async function isPocketBaseReachable(timeoutMs = 6_000): Promise<boolean> {
  if (!isPocketBaseConfigured) return true;
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(`${pb.baseUrl}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface PocketBaseDiagnostics {
  url: string;
  configured: boolean;
  /** Which channel supplied the URL: env var, native manifest, or demo mode. */
  urlSource: PocketBaseUrlSource;
  demoReason: PocketBaseDemoReason | null;
  authenticated: boolean;
  authValid: boolean;
  recordId: string;
  email: string;
  role: string;
  branchId: string;
  tokenExpiresAt: string | null;
}

function decodeTokenExpiry(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof atob !== 'function') return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof parsed.exp === 'number'
      ? new Date(parsed.exp * 1000).toISOString()
      : null;
  } catch {
    return null;
  }
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Snapshot of everything that determines whether a write can succeed: the URL,
 * the persisted auth token, and the branch/role claimed by the staff record.
 */
export function pocketBaseDiagnostics(): PocketBaseDiagnostics {
  const record = (pb.authStore.record ?? {}) as Record<string, unknown>;
  return {
    url: pb.baseUrl,
    configured: isPocketBaseConfigured,
    urlSource: pocketBaseUrlSource,
    demoReason: pocketBaseDemoReason,
    authenticated: Boolean(pb.authStore.isValid && asText(record.id)),
    authValid: Boolean(pb.authStore.isValid),
    recordId: asText(record.id),
    email: asText(record.email),
    role: asText(record.role),
    branchId: asText(record.branch_id),
    tokenExpiresAt: decodeTokenExpiry(asText(pb.authStore.token)),
  };
}

if (__DEV__) {
  console.log(
    '[pb] base URL:', pb.baseUrl,
    '| configured:', isPocketBaseConfigured,
    '| source:', pocketBaseUrlSource,
    '| demoReason:', pocketBaseDemoReason
  );
  if (isPocketBaseConfigured && /localhost|127\.0\.0\.1/.test(pb.baseUrl) && Platform.OS !== 'web') {
    console.warn(
      '[pb] EXPO_PUBLIC_POCKETBASE_URL points at this device itself — ' +
        'restart Metro with `npx expo start -c` after fixing .env.'
    );
  }
}
