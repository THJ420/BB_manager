/**
 * BB Manager design tokens.
 * Material 3 dark charcoal surfaces with indigo / amber / emerald accents.
 */
export const Colors = {
  // Surfaces
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#262626',
  surfaceBorder: '#333333',
  surfaceHighlight: '#2A2A2A',

  // Brand accents
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primaryMuted: 'rgba(99, 102, 241, 0.15)',
  primaryBorder: 'rgba(99, 102, 241, 0.4)',
  slate: '#64748B',
  slateDark: '#334155',

  // Semantic status colors
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  successBorder: 'rgba(16, 185, 129, 0.4)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',
  info: '#38BDF8',
  infoMuted: 'rgba(56, 189, 248, 0.15)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  errorBorder: 'rgba(239, 68, 68, 0.5)',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textInverse: '#121212',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(6, 6, 8, 0.72)',
  switchTrackOff: '#3F3F46',
  switchThumbOff: '#A1A1AA',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const Layout = {
  /** Kitchen-floor minimum touch target (48dp). */
  minTouch: 48,
  headerPaddingH: 16,
  headerPaddingV: 12,
  screenPadding: 16,
  bottomNavHeight: 60,
} as const;
