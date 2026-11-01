import { useWindowDimensions } from 'react-native'

import { breakpoints } from '@/theme/tokens'

export function useResponsive() {
  const { width, height } = useWindowDimensions()

  return {
    width,
    height,
    isTablet: width >= breakpoints.compact,
    isWide: width >= breakpoints.expanded,
  }
}
