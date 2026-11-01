import type { PropsWithChildren, ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { colors, spacing } from '@/theme/tokens'

interface ScreenProps extends PropsWithChildren {
  edges?: Edge[]
  padded?: boolean
  header?: ReactNode
}

export function Screen({ children, edges = ['top', 'left', 'right'], padded = true, header }: ScreenProps) {
  const { width } = useWindowDimensions()
  const horizontalPadding = width >= 1000 ? spacing.xxl : spacing.lg

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, padded && { paddingHorizontal: horizontalPadding }]}>
        {header}
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    gap: spacing.md,
  },
})
