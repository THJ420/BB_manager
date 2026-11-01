export const colors = {
  background: '#0B0D10',
  surface: '#14171C',
  surfaceRaised: '#1C2128',
  surfaceSoft: '#222831',
  border: '#2C333D',
  borderStrong: '#3A434F',
  text: '#F5F7FA',
  textMuted: '#9AA4B2',
  textFaint: '#6B7480',
  accent: '#F2B544',
  accentText: '#1A1305',
  danger: '#EF4444',
  dangerSoft: '#3A1418',
  success: '#22C55E',
  successSoft: '#0F2A1A',
  info: '#38BDF8',
  infoSoft: '#0C2633',
  warning: '#F59E0B',
  warningSoft: '#33230A',
  overlay: 'rgba(0, 0, 0, 0.76)',
  white: '#FFFFFF',
  black: '#000000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  mono: { fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] as const },
} as const

export const breakpoints = {
  compact: 700,
  expanded: 1000,
} as const

export const minTouchTarget = 48
