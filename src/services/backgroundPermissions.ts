import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const STORAGE_KEY = 'bb.backgroundPermissions.v1';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

interface RationaleRecord {
  completedAt?: number;
  snoozedUntil?: number;
}

async function readRecord(): Promise<RationaleRecord> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RationaleRecord;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRecord(record: RationaleRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('[background] unable to persist the rationale state', error);
  }
}

/**
 * First-launch gate: Android terminals see the rationale once, then only
 * again after a "Not now" snooze expires. Completing the flow silences it.
 */
export async function shouldShowBackgroundRationale(now = Date.now()): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const record = await readRecord();
  if (record.completedAt) return false;
  if (record.snoozedUntil && record.snoozedUntil > now) return false;
  return true;
}

export async function markBackgroundRationaleCompleted(now = Date.now()): Promise<void> {
  await writeRecord({ completedAt: now });
}

export async function snoozeBackgroundRationale(now = Date.now()): Promise<void> {
  await writeRecord({ snoozedUntil: now + SNOOZE_MS });
}

export interface BackgroundPermissionResult {
  notifications: 'granted' | 'denied';
  batteryExemption: 'requested' | 'settings-opened' | 'unsupported';
}

function androidPackage(): string {
  return Constants.expoConfig?.android?.package ?? 'com.bbmanager.app';
}

/**
 * Requests notification permission, then opens the system battery-optimisation
 * exemption dialog for this package so Doze cannot delay incoming-order alarms.
 */
export async function requestBackgroundPermissions(): Promise<BackgroundPermissionResult> {
  let notifications: BackgroundPermissionResult['notifications'] = 'denied';

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    notifications = status === 'granted' ? 'granted' : 'denied';
  } catch (error) {
    console.warn('[background] notification permission request failed', error);
  }

  let batteryExemption: BackgroundPermissionResult['batteryExemption'] = 'unsupported';

  if (Platform.OS === 'android') {
    const data = `package:${androidPackage()}`;
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        { data }
      );
      batteryExemption = 'requested';
    } catch {
      // Some OEM builds hide the per-app dialog; fall back to the system list.
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
        );
        batteryExemption = 'settings-opened';
      } catch (error) {
        console.warn('[background] battery optimisation settings unavailable', error);
      }
    }
  }

  return { notifications, batteryExemption };
}

/** Management entry: opens the system app-info page for this terminal. */
export async function openAppPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
      data: `package:${androidPackage()}`,
    });
  } catch (error) {
    console.warn('[background] unable to open the app settings page', error);
  }
}