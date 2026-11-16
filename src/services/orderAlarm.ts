import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ensurePickupNotificationChannel } from './push';

interface OrderAlarmNative {
  present(title: string, body: string, orderId: string): boolean;
  dismiss(): void;
  startLoop(tone: string): boolean;
  stopLoop(): void;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): boolean;
}

let cachedNative: OrderAlarmNative | null | undefined;

/**
 * The native module only exists in Android dev/release builds. Expo Go, web
 * and jest resolve to null and the service degrades to a heads-up notification.
 */
function nativeAlarm(): OrderAlarmNative | null {
  if (cachedNative !== undefined) return cachedNative;
  if (Platform.OS !== 'android') {
    cachedNative = null;
    return cachedNative;
  }
  try {
    // Lazy require so a missing native module never crashes the JS runtime.
    const { requireNativeModule } = require('expo-modules-core') as {
      requireNativeModule: <T>(name: string) => T;
    };
    cachedNative = requireNativeModule<OrderAlarmNative>('OrderAlarm');
  } catch {
    cachedNative = null;
  }
  return cachedNative;
}

export interface OrderAlarmContent {
  orderId: string;
  title: string;
  body: string;
}

/**
 * Forces the incoming-order alarm over the lock screen via a full-screen
 * intent notification. Falls back to a MAX-priority heads-up notification on
 * the pickup channel when the native engine is unavailable.
 */
export async function presentOrderAlarm(content: OrderAlarmContent): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = nativeAlarm();
  if (native) {
    try {
      if (native.present(content.title, content.body, content.orderId)) return;
    } catch (error) {
      console.warn('[alarm] native full-screen alarm failed', error);
    }
  }
  try {
    await ensurePickupNotificationChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: `order-alarm-${content.orderId}`,
      content: {
        title: content.title,
        body: content.body,
        sound: 'loud_alarm.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: 'pickup_order', orderId: content.orderId },
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[alarm] unable to present the order notification', error);
  }
}

/** Clears the alarm notification once the call is answered or rejected. */
export async function dismissOrderAlarm(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = nativeAlarm();
  if (native) {
    try {
      native.dismiss();
      return;
    } catch (error) {
      console.warn('[alarm] native dismiss failed', error);
    }
  }
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}

/**
 * Starts the gapless native alarm loop (looping MediaPlayer on the alarm
 * stream + zero-off-time vibration). Returns false when the native engine is
 * unavailable or cannot open an audio source, so callers fall back to the
 * expo-audio loop. The loop runs until stopOrderAlarmLoop/dismissOrderAlarm.
 */
export function startOrderAlarmLoop(toneId: string): boolean {
  const native = nativeAlarm();
  if (!native) return false;
  try {
    return native.startLoop(toneId);
  } catch (error) {
    console.warn('[alarm] native alarm loop failed to start', error);
    return false;
  }
}

export function stopOrderAlarmLoop(): void {
  const native = nativeAlarm();
  if (!native) return;
  try {
    native.stopLoop();
  } catch (error) {
    console.warn('[alarm] native alarm loop failed to stop', error);
  }
}

export type FullScreenIntentAccess = 'granted' | 'needs-settings' | 'unsupported';

/**
 * Android 14+ restricts full-screen intents to calling/alarm apps unless the
 * user grants the special "Full screen notifications" access.
 */
export function checkFullScreenIntentAccess(): FullScreenIntentAccess {
  const native = nativeAlarm();
  if (!native) return 'unsupported';
  try {
    return native.canUseFullScreenIntent() ? 'granted' : 'needs-settings';
  } catch {
    return 'unsupported';
  }
}

export function openFullScreenIntentSettings(): boolean {
  const native = nativeAlarm();
  if (!native) return false;
  try {
    return native.openFullScreenIntentSettings();
  } catch {
    return false;
  }
}