import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Colors, Layout, Radius } from '../theme/colors';
import { Typography } from '../theme/typography';

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
  slate: {
    background: Colors.glassFillStrong,
    border: Colors.glassBorderStrong,
    text: Colors.white,
  },
  warning: { background: Colors.warning, border: Colors.warning, text: Colors.textInverse },
  danger: { background: Colors.error, border: Colors.error, text: Colors.white },
  outline: {
    background: Colors.transparent,
    border: Colors.glassBorderStrong,
    text: Colors.textSecondary,
  },
  dangerOutline: {
    background: Colors.errorMuted,
    border: Colors.errorBorder,
    text: Colors.error,
  },
  subtle: {
    background: Colors.surfaceElevated,
    border: Colors.surfaceBorder,
    text: Colors.textPrimary,
  },
  tonal: {
    background: Colors.primaryMuted,
    border: Colors.primaryBorder,
    text: Colors.primaryText,
  },
};

const SOLID_VARIANTS: ButtonVariant[] = ['primary', 'success', 'warning', 'danger'];

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
  const solid = SOLID_VARIANTS.includes(variant);

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
        solid && styles.specular,
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
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  specular: {
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
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
    ...Typography.button,
  },
  icon: {
    fontSize: 13,
  },
});