import { TextStyle } from 'react-native';
import { Colors } from './colors';

/**
 * Material 3 style type ramp used across every screen.
 * Numeric weights mirror the Compose theme (Black/ExtraBold/Bold/SemiBold).
 */
export const Typography: Record<string, TextStyle> = {
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  screenSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  button: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  caption: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  mono: {
    fontFamily: 'monospace',
  },
};
