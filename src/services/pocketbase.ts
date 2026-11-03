import PocketBase, { AsyncAuthStore } from 'pocketbase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = 'bb_pocketbase_auth';
const configuredUrl = (process.env.EXPO_PUBLIC_POCKETBASE_URL ?? '').trim();

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
  const trimmed = url.trim();
  if (trimmed.startsWith('http')) {
    pb.baseUrl = trimmed;
  }
}
