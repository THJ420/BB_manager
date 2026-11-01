import { Tabs } from 'expo-router'
import { StyleSheet, View, type ColorValue } from 'react-native'

import { colors, typography } from '@/theme/tokens'

function TabMark({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View
      style={[
        styles.mark,
        {
          borderColor: color,
          backgroundColor: focused ? color : 'transparent',
        },
      ]}
    />
  )
}

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => <TabMark color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => <TabMark color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <TabMark color={color} focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  mark: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 2,
  },
})
