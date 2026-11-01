import * as Notifications from 'expo-notifications'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { LoadingScreen } from '@/components/LoadingScreen'
import { AppProviders } from '@/providers/AppProviders'
import { useSession } from '@/providers/SessionProvider'
import { colors } from '@/theme/tokens'

void SplashScreen.preventAutoHideAsync().catch(() => {})

function RootNavigator() {
  const { status } = useSession()
  const router = useRouter()
  const isSignedIn = status === 'signedIn' || status === 'offline'

  useEffect(() => {
    if (status !== 'booting') {
      void SplashScreen.hideAsync().catch(() => {})
    }
  }, [status])

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!isSignedIn) {
        return
      }

      const orderId = response.notification.request.content.data?.orderId

      if (typeof orderId === 'string' && orderId.length > 0) {
        router.push({ pathname: '/order/[id]', params: { id: orderId } })
      }
    })

    return () => subscription.remove()
  }, [isSignedIn, router])

  if (status === 'booting') {
    return <LoadingScreen />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="order/[id]" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <RootNavigator />
    </AppProviders>
  )
}
