import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Colors, Layout, Radius } from '../theme/colors';

export type ButtonVariant =
  | 'primary'
  | 'success'
  | 'slate'
  | 'warning'
  | 'danger'
  | 'outline'
  | 'dangerOutline'
  | 'subtle'
  | 'tonal';

interface Palette {
  background: string;
  border: string;
  text: string;
}

const PALETTES: Record<ButtonVariant, Palette> = {
  primary: { background: Colors.primary, border: Colors.primary, text: Colors.white },
  success: { background: Colors.success, border: Colors.success, text: Colors.textInverse },
  slate: { background: Colors.slateDark, border: Colors.surfaceBorder, text: Colors.white },
  warning: { background: Colors.warning, border: Colors.warning, text: Colors.textInverse },
  danger: { background: Colors.error, border: Colors.error, text: Colors.white },
  outline: {
    background: Colors.transparent,
    border: Colors.surfaceBorder,
    text: Colors.textSecondary,
  },
  dangerOutline: {
    background: Colors.transparent,
    border: Colors.errorBorder,
    text: Colors.error,
  },
  subtle: {
    background: Colors.surfaceHighlight,
    border: Colors.surfaceBorder,
    text: Colors.textPrimary,
  },
  tonal: {
    background: Colors.surfaceHighlight,
    border: Colors.surfaceBorder,
    text: Colors.primary,
  },
};

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  testID?: string;
  accessibilityHint?: string;
}

/** Minimum 48dp tall action target for fast kitchen-floor taps. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  fullWidth = false,
  disabled = false,
  style,
  compact = false,
  testID,
  accessibilityHint,
}: ActionButtonProps) {
  const palette = PALETTES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        fullWidth && styles.fullWidth,
        compact && styles.compact,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Layout.minTouch,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  compact: {
    paddingHorizontal: 10,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  icon: {
    fontSize: 13,
  },
});
