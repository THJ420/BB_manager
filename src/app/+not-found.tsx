import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { AppHeader } from '@/components/AppHeader'
import { EmptyState } from '@/components/EmptyState'
import { Screen } from '@/components/Screen'
import { spacing } from '@/theme/tokens'

export default function NotFoundScreen() {
  const router = useRouter()

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <AppHeader title="Not found" />
      <View style={styles.body}>
        <EmptyState
          title="This screen does not exist"
          message="The link may be outdated. Return to the orders board to continue."
          actionLabel="Go to orders"
          onAction={() => router.replace('/')}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.lg,
  },
})
