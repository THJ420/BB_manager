import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Layout, Spacing } from '../theme/colors';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  bottom?: ReactNode;
}

/** Charcoal top bar shared by every operational screen. */
export function ScreenHeader({ title, subtitle, right, bottom }: ScreenHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {bottom ? <View style={styles.bottom}>{bottom}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    paddingHorizontal: Layout.headerPaddingH,
    paddingVertical: Layout.headerPaddingV,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
