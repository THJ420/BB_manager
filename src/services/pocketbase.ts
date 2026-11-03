import PocketBase, { AsyncAuthStore } from 'pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = 'bb_pocketbase_auth';
// A trailing slash would make every request hit `//api/...`, which PocketBase
// answers with a 307 redirect on each call.
const configuredUrl = (process.env.EXPO_PUBLIC_POCKETBASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

/**
 * When no backend URL is supplied the terminal runs in local demo mode:
 * SQLite remains the source of truth and realtime subscriptions are skipped.
 */
export const isPocketBaseConfigured = configuredUrl.length > 0;

const baseUrl = isPocketBaseConfigured ? configuredUrl : 'http://127.0.0.1:8090';

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

export function setPocketBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http')) {
    pb.baseUrl = trimmed;
  }
}

export interface PocketBaseDiagnostics {
  url: string;
  configured: boolean;
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
  console.log('[pb] base URL:', pb.baseUrl, '| configured:', isPocketBaseConfigured);
}
