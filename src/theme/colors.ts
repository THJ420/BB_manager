/**
 * BB Manager design tokens — Obsidian Kinetic.
 * OLED-optimized obsidian surfaces, atmospheric glass, electric indigo primary,
 * chromatic status accents (emerald / amber / coral / cyan).
 */
export const Colors = {
  // Surfaces (obsidian elevation stack)
  background: '#0F1117',
  surface: '#161922',
  surfaceElevated: '#1E2330',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',
  surfaceBorderSubtle: 'rgba(255, 255, 255, 0.04)',
  surfaceHighlight: '#232837',

  // Atmospheric glass
  glassFill: 'rgba(255, 255, 255, 0.03)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassFillStrong: 'rgba(255, 255, 255, 0.05)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.12)',
  navFill: 'rgba(22, 25, 34, 0.72)',
  specularTop: 'rgba(255, 255, 255, 0.12)',

  // Brand accents
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  primaryMuted: 'rgba(99, 102, 241, 0.15)',
  primaryBorder: 'rgba(99, 102, 241, 0.35)',
  primaryText: '#818CF8',
  slate: '#64748B',
  slateDark: '#334155',
  slateLight: '#94A3B8',
  placeholder: '#475569',

  // Semantic status colors
  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(16, 185, 129, 0.25)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',
  info: '#06B6D4',
  infoMuted: 'rgba(6, 182, 212, 0.12)',
  infoBorder: 'rgba(6, 182, 212, 0.25)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.25)',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textInverse: '#0F1117',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  overlay: 'rgba(6, 8, 12, 0.72)',
  switchTrackOff: '#333A49',
  switchThumbOff: '#A1A1AA',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  gutterSm: 12,
  margin: 20,
  spaceMd: 12,
  spaceLg: 20,
  spaceXl: 28,
} as const;

export const Radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Layout = {
  /** Kitchen-floor minimum touch target (48dp). */
  minTouch: 48,
  headerPaddingH: 16,
  headerPaddingV: 12,
  screenPadding: 16,
  bottomNavHeight: 64,
  /** 5rem scroll clearance so content never hides under the floating dock. */
  bottomClearance: 80,
  /** Dock floats 1.25rem above the bottom safe area. */
  navDockOffset: 20,
} as const;