jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      __store: store,
    },
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.bbmanager.app' } } },
}));

jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: jest.fn(async () => ({ resultCode: 0 })),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));

jest.mock(
  'react-native',
  () => ({ Platform: { OS: 'android' } }),
  { virtual: true }
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  markBackgroundRationaleCompleted,
  openAppPermissionSettings,
  requestBackgroundPermissions,
  shouldShowBackgroundRationale,
  snoozeBackgroundRationale,
} from '../src/services/backgroundPermissions';

const store = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  (Platform as { OS: string }).OS = 'android';
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (IntentLauncher.startActivityAsync as jest.Mock).mockResolvedValue({ resultCode: 0 });
});

describe('shouldShowBackgroundRationale', () => {
  it('shows on a fresh Android install', async () => {
    expect(await shouldShowBackgroundRationale(1000)).toBe(true);
  });

  it('never shows on non-Android platforms', async () => {
    (Platform as { OS: string }).OS = 'ios';
    expect(await shouldShowBackgroundRationale(1000)).toBe(false);
  });

  it('stops showing once completed', async () => {
    await markBackgroundRationaleCompleted(1000);
    expect(await shouldShowBackgroundRationale(2000)).toBe(false);
  });

  it('honours the snooze window and re-shows after it expires', async () => {
    const now = 1_000_000;
    await snoozeBackgroundRationale(now);
    expect(await shouldShowBackgroundRationale(now + 1000)).toBe(false);
    expect(await shouldShowBackgroundRationale(now + 24 * 60 * 60 * 1000 + 1)).toBe(true);
  });
});

describe('requestBackgroundPermissions', () => {
  it('does not re-request notifications when already granted', async () => {
    const result = await requestBackgroundPermissions();
    expect(result.notifications).toBe('granted');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      { data: 'package:com.bbmanager.app' }
    );
    expect(result.batteryExemption).toBe('requested');
  });

  it('requests notifications when undetermined and reports denial', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const result = await requestBackgroundPermissions();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(result.notifications).toBe('denied');
  });

  it('falls back to the battery-optimisation list when the dialog intent fails', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('no activity');
    });
    const result = await requestBackgroundPermissions();
    expect(result.batteryExemption).toBe('settings-opened');
    expect(IntentLauncher.startActivityAsync).toHaveBeenLastCalledWith(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  });

  it('reports unsupported when both battery intents fail', async () => {
    (IntentLauncher.startActivityAsync as jest.Mock).mockRejectedValue(new Error('no activity'));
    const result = await requestBackgroundPermissions();
    expect(result.batteryExemption).toBe('unsupported');
  });
});

describe('openAppPermissionSettings', () => {
  it('opens the system app-info page for this package', async () => {
    await openAppPermissionSettings();
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      { data: 'package:com.bbmanager.app' }
    );
  });

  it('is a no-op on non-Android platforms', async () => {
    (Platform as { OS: string }).OS = 'ios';
    await openAppPermissionSettings();
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
  });
});