import { TextStyle } from 'react-native';
import { Colors } from './colors';

/**
 * Obsidian Kinetic dual-engine type ramp.
 * Plus Jakarta Sans for headlines / metric figures; Inter for body / micro labels.
 * Numeric styles activate tabular figures to prevent real-time layout jitter.
 */
export const Fonts = {
  jakartaMedium: 'PlusJakartaSans_500Medium',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaBold: 'PlusJakartaSans_700Bold',
  jakartaExtraBold: 'PlusJakartaSans_800ExtraBold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const Typography: Record<string, TextStyle> = {
  screenTitle: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    color: Colors.textPrimary,
  },
  screenSubtitle: {
    fontFamily: Fonts.interMedium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  cardDescription: {
    fontFamily: Fonts.interRegular,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: Fonts.interBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
    color: Colors.textSecondary,
  },
  button: {
    fontFamily: Fonts.interBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  metricValue: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    fontVariant: tabular,
    color: Colors.textPrimary,
  },
  metricSub: {
    fontFamily: Fonts.interMedium,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: tabular,
    color: Colors.textSecondary,
  },
  metricUnit: {
    fontFamily: Fonts.jakartaSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  displayTitle: {
    fontFamily: Fonts.jakartaExtraBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: Colors.textPrimary,
  },
  caption: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  mono: {
    fontFamily: 'monospace',
    fontVariant: tabular,
  },
};