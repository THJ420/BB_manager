import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';

export interface SectionCardProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: 'default' | 'danger' | 'success' | 'accent';
}

const TONES: Record<NonNullable<SectionCardProps['tone']>, string> = {
  default: Colors.surfaceBorder,
  danger: Colors.errorBorder,
  success: Colors.successBorder,
  accent: Colors.primaryBorder,
};

/** Elevated #262626 card with the Material 3 hairline border. */
export function SectionCard({
  title,
  right,
  children,
  style,
  contentStyle,
  tone = 'default',
}: SectionCardProps) {
  return (
    <View style={[styles.card, { borderColor: TONES[tone] }, style]}>
      {title || right ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  title: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  content: {
    padding: Spacing.md,
    gap: 10,
  },
});
