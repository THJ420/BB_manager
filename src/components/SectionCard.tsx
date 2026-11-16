import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

export interface SectionCardProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tone?: 'default' | 'danger' | 'success' | 'accent';
}

const TONES: Record<NonNullable<SectionCardProps['tone']>, string> = {
  default: Colors.surfaceBorderSubtle,
  danger: Colors.errorBorder,
  success: Colors.successBorder,
  accent: Colors.primaryBorder,
};

/** Structural obsidian slab (#161922) with a hairline perimeter stroke. */
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
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
    ...Typography.sectionLabel,
    flexShrink: 1,
  },
  content: {
    padding: Spacing.md,
    gap: 12,
  },
});