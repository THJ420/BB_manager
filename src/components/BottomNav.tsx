import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import type { Href } from 'expo-router';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countActiveOrders } from '../lib/domain';
import { useApp } from '../state/AppProvider';
import { Colors, Layout, Radius } from '../theme/colors';
import { Fonts } from '../theme/typography';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface NavTab {
  key: 'orders' | 'menu' | 'tables' | 'reservations' | 'analytics' | 'settings';
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
  { key: 'reservations', label: 'Reservations', href: '/(app)/reservations', icon: 'event-seat' },
];

/** Owner working inside one branch gets the full store control panel. */
const OWNER_WORKSPACE_TABS: NavTab[] = [
  { key: 'analytics', label: 'Dashboard', href: '/(app)/analytics', icon: 'insights' },
  { key: 'orders', label: 'Live Orders', href: '/(app)', icon: 'list' },
  { key: 'menu', label: 'Menu & Stock', href: '/(app)/menu', icon: 'restaurant' },
  {
    key: 'tables',
    label: 'Dining Tables',
    href: { pathname: '/(app)/tables', params: { view: 'tables' } },
    icon: 'table-restaurant',
  },
  { key: 'reservations', label: 'Reservations', href: '/(app)/reservations', icon: 'event-seat' },
  { key: 'settings', label: 'Store Settings', href: '/(app)/settings', icon: 'settings' },
];

function resolveActiveTab(pathname: string): NavTab['key'] {
  if (pathname.startsWith('/menu')) return 'menu';
  if (pathname.startsWith('/tables')) return 'tables';
  if (pathname.startsWith('/reservations')) return 'reservations';
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
      style={[styles.dock, { bottom: insets.bottom + Layout.navDockOffset }]}
      accessibilityRole="tablist"
    >
      <BlurView
        intensity={60}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={styles.frost}
      />
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
                size={22}
                color={selected ? Colors.primaryText : Colors.textMuted}
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
  dock: {
    position: 'absolute',
    left: Layout.screenPadding,
    right: Layout.screenPadding,
    height: Layout.bottomNavHeight,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.navFill,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  frost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.navFill,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    gap: 2,
  },
  tab: {
    width: Layout.minTouch,
    height: Layout.minTouch,
    borderRadius: Radius.lg,
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
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  tabPressed: {
    opacity: 0.8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.info,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: Fonts.interBold,
    fontSize: 9,
    color: Colors.textInverse,
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});