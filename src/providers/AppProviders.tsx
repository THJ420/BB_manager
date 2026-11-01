import { SQLiteProvider } from 'expo-sqlite'
import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DB_NAME, migrateDbIfNeeded } from '@/db/schema'
import { AlertOverlay } from '@/components/AlertOverlay'
import { colors } from '@/theme/tokens'
import { AlertsProvider } from '@/providers/AlertsProvider'
import { OutboxProvider } from '@/providers/OutboxProvider'
import { SessionProvider } from '@/providers/SessionProvider'
import { SyncProvider } from '@/providers/SyncProvider'
import { ToastProvider } from '@/providers/ToastProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName={DB_NAME}
        onInit={migrateDbIfNeeded}
        onError={(error) => console.warn('SQLite initialization failed', error)}
      >
        <ToastProvider>
          <SessionProvider>
            <OutboxProvider>
              <AlertsProvider>
                <SyncProvider>
                  <View style={styles.root}>
                    {children}
                    <AlertOverlay />
                  </View>
                </SyncProvider>
              </AlertsProvider>
            </OutboxProvider>
          </SessionProvider>
        </ToastProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
