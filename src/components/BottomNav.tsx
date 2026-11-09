import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countActiveOrders } from '../lib/domain';
import { useApp } from '../state/AppProvider';
import { Colors, Layout, Radius } from '../theme/colors';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface NavTab {
  key: 'orders' | 'menu' | 'tables' | 'analytics' | 'settings';
  label: string;
  href: Href;
  icon: IconName;
}

const TABS: NavTab[] = [
  { key: 'orders', label: 'Live Orders', href: '/(app)', icon: 'list' },
  { key: 'menu', label: 'Menu & Stock', href: '/(app)/menu', icon: 'restaurant' },
  { key: 'tables', label: 'Dining Tables', href: '/(app)/tables', icon: 'table-restaurant' },
  { key: 'analytics', label: 'Analytics', href: '/(app)/analytics', icon: 'analytics' },
  { key: 'settings', label: 'Store Settings', href: '/(app)/settings', icon: 'settings' },
];

/** Owner console: cross-branch metrics, live orders and reservations only. */
const OWNER_TABS: NavTab[] = [
  { key: 'analytics', label: 'Dashboard', href: '/(app)/analytics', icon: 'insights' },
  { key: 'orders', label: 'Live Orders', href: '/(app)', icon: 'list' },
  { key: 'tables', label: 'Reservations', href: '/(app)/reservations', icon: 'event-seat' },
];

/** Owner working inside one branch gets the full terminal tab set. */
const OWNER_WORKSPACE_TABS: NavTab[] = [
  { key: 'analytics', label: 'Dashboard', href: '/(app)/analytics', icon: 'insights' },
  { key: 'orders', label: 'Live Orders', href: '/(app)', icon: 'list' },
  { key: 'menu', label: 'Menu & Stock', href: '/(app)/menu', icon: 'restaurant' },
  { key: 'tables', label: 'Reservations', href: '/(app)/reservations', icon: 'event-seat' },
  { key: 'settings', label: 'Store Settings', href: '/(app)/settings', icon: 'settings' },
];

function resolveActiveTab(pathname: string): NavTab['key'] {
  if (pathname.startsWith('/menu')) return 'menu';
  if (pathname.startsWith('/tables') || pathname.startsWith('/reservations')) return 'tables';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'orders';
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { state, isOwner, isOwnerWorkspace } = useApp();
  const activeKey = resolveActiveTab(pathname);
  const activeOrders = countActiveOrders(state.orders);
  const tabs = isOwner
    ? isOwnerWorkspace
      ? OWNER_WORKSPACE_TABS
      : OWNER_TABS
    : TABS;

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 4) }]}
      accessibilityRole="tablist"
    >
      <View style={styles.row}>
        {tabs.map((tab) => {
          const selected = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.replace(tab.href)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              testID={`tab_${tab.key}`}
              style={({ pressed }) => [
                styles.tab,
                selected ? styles.tabSelected : styles.tabIdle,
                pressed && styles.tabPressed,
              ]}
            >
              <MaterialIcons
                name={tab.icon}
                size={24}
                color={selected ? Colors.primary : Colors.textMuted}
              />

              {tab.key === 'orders' && activeOrders > 0 ? (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{activeOrders}</Text>
                </View>
              ) : null}

              {selected ? <View style={styles.activeDot} pointerEvents="none" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  row: {
    height: Layout.bottomNavHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    gap: 2,
  },
  tab: {
    width: Layout.minTouch,
    height: Layout.minTouch,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tabIdle: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.transparent,
  },
  tabSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryBorder,
  },
  tabPressed: {
    opacity: 0.8,
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.textInverse,
  },
  activeDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});
