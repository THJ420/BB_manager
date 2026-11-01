import * as Notifications from 'expo-notifications'
import { AppState, Platform } from 'react-native'

import type { CachedOrder } from '@/db/orders'
import { NOTIFICATION_CHANNEL_ID } from '@/lib/config'
import { formatPrice } from '@/lib/format'
import { formatTime } from '@/lib/time'

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

const ANDROID_IMPORTANCE_MAX = 5 as Notifications.AndroidImportance

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'New pickup orders',
    importance: ANDROID_IMPORTANCE_MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EF4444',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  })
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false
  }

  const existing = await Notifications.getPermissionsAsync()

  if (existing.granted) {
    return true
  }

  const requested = await Notifications.requestPermissionsAsync()

  return requested.granted
}

export async function showOrderNotification(order: CachedOrder): Promise<void> {
  if (Platform.OS === 'web') {
    return
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New pickup order',
      body: `${order.customerName || 'Customer'} · ${formatPrice(order.totalPrice)} · pickup ${formatTime(order.pickupTime)}`,
      data: { orderId: order.id },
      sound: 'default',
    },
    trigger: Platform.OS === 'android' ? { channelId: NOTIFICATION_CHANNEL_ID } : null,
  })
}
