import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Layout, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  bottom?: ReactNode;
}

/** Obsidian top bar shared by every operational screen. */
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
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorderSubtle,
    paddingHorizontal: Layout.headerPaddingH,
    paddingTop: Layout.headerPaddingV,
    paddingBottom: Spacing.spaceMd,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.screenTitle,
  },
  subtitle: {
    ...Typography.screenSubtitle,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingTop: 4,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});