import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { COLLECTIONS } from './collections';
import { isPocketBaseConfigured, pb } from './pocketbase';

/**
 * High-priority Android channel used by `pb_hooks/lib/terminal.js` when it
 * fans a new online pickup order out to the branch terminals.
 */
export const PICKUP_CHANNEL_ID = 'pickup-orders';

// Foreground pushes must still ring and show a banner; the OS would otherwise
// swallow them while the terminal screen is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensurePickupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PICKUP_CHANNEL_ID, {
    name: 'Pickup orders',
    description: 'Incoming online pickup orders for this terminal.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 700, 400, 700, 400, 1200],
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#F97316',
  });
}

/**
 * Asks for notification permission and stores the Expo push token on the
 * signed-in staff record. The PocketBase hook reads `staff_users.push_token`,
 * so a locked phone still receives the order after SSE is suspended.
 */
export async function registerTerminalPushToken(
  userId: string
): Promise<string | null> {
  if (!isPocketBaseConfigured || !userId) return null;

  try {
    await ensurePickupNotificationChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      console.warn('[push] notification permission not granted');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] no EAS project id; push token not requested');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    await pb.collection(COLLECTIONS.staffUsers).update(userId, { push_token: token });
    return token;
  } catch (error) {
    // Simulators, denied permissions and offline starts are not fatal: the
    // in-app alarm loop still covers a foregrounded terminal.
    console.warn('[push] unable to register the terminal push token', error);
    return null;
  }
}

/** Detaches a device from the branch fan-out when the employee signs out. */
export async function clearTerminalPushToken(userId: string): Promise<void> {
  if (!isPocketBaseConfigured || !userId) return;
  try {
    await pb.collection(COLLECTIONS.staffUsers).update(userId, { push_token: '' });
  } catch (error) {
    console.warn('[push] unable to clear the terminal push token', error);
  }
}

export interface PickupPushListeners {
  /** A pickup push arrived while the app was running. */
  onPickupPush?: () => void;
  /** The employee tapped a pickup notification. */
  onOpenOrders?: () => void;
}

export function addPickupPushListeners(listeners: PickupPushListeners): () => void {
  const received = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    if (data?.type !== 'pickup_order') return;
    listeners.onPickupPush?.();
  });

  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    if (data?.type !== 'pickup_order') return;
    listeners.onOpenOrders?.();
  });

  return () => {
    received.remove();
    response.remove();
  };
}
