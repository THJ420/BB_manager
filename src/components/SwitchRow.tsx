import React from 'react';
import { StyleProp, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import { Colors, Layout } from '../theme/colors';
import { Fonts } from '../theme/typography';

export interface SwitchRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  activeColor?: string;
  activeMuted?: string;
  inactiveColor?: string;
  inactiveMuted?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Label + native switch row, always at least 48dp tall. */
export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  activeColor = Colors.primary,
  inactiveColor = Colors.switchThumbOff,
  inactiveMuted = Colors.switchTrackOff,
  style,
  testID,
}: SwitchRowProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: inactiveMuted, true: activeColor }}
        thumbColor={value ? Colors.white : inactiveColor}
        ios_backgroundColor={Colors.switchTrackOff}
        hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
        testID={testID}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textSecondary,
  },
});
