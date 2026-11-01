import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { CachedMenu } from '@/db/menu'
import { projectMenu } from '@/lib/outboxPolicy'
import { AppHeader } from '@/components/AppHeader'
import { ConnectionBadge } from '@/components/ConnectionBadge'
import { EmptyState } from '@/components/EmptyState'
import { MenuRow } from '@/components/MenuRow'
import { PriceEditor } from '@/components/PriceEditor'
import { Screen } from '@/components/Screen'
import { useMenuActions } from '@/hooks/useMenuActions'
import { useResponsive } from '@/hooks/useResponsive'
import { useMenuStore } from '@/stores/menuStore'
import { useSyncStore } from '@/stores/syncStore'
import { useSession } from '@/providers/SessionProvider'
import { useSync } from '@/providers/SyncProvider'
import { colors, radii, spacing, typography } from '@/theme/tokens'

interface EditorState {
  item: CachedMenu
  price: number
}

export default function MenuScreen() {
  const { branch } = useSession()
  const { isWide } = useResponsive()
  const { refreshing, refresh } = useSync()
  const { setAvailability, setPrice } = useMenuActions()
  const menu = useMenuStore((state) => state.menu)
  const hydrated = useMenuStore((state) => state.hydrated)
  const outbox = useSyncStore((state) => state.outbox)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [editor, setEditor] = useState<EditorState | null>(null)

  const categories = useMemo(() => {
    const unique = Array.from(new Set(menu.map((item) => item.category)))

    return ['All', ...unique]
  }, [menu])

  const enriched = useMemo(() => {
    const term = search.trim().toLowerCase()

    return menu
      .map((item) => ({
        item,
        projection: projectMenu(
          { price: item.price, isAvailable: item.isAvailable },
          item.id,
          outbox,
        ),
      }))
      .filter(({ item }) => {
        const matchesCategory = category === 'All' || item.category === category
        const matchesSearch = term === ''
          || item.name.toLowerCase().includes(term)
          || item.category.toLowerCase().includes(term)

        return matchesCategory && matchesSearch
      })
  }, [category, menu, outbox, search])

  const columns = isWide ? 2 : 1

  return (
    <Screen>
      <AppHeader
        title="Menu"
        subtitle={`${branch?.name ?? 'Branch'} · ${menu.length} items`}
        right={(
          <View style={styles.headerRight}>
            <ConnectionBadge />
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              disabled={refreshing}
              style={({ pressed }) => [styles.syncButton, (pressed || refreshing) && styles.pressed]}
            >
              <Text style={styles.syncButtonText}>{refreshing ? 'Syncing…' : 'Sync'}</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search menu items"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.search}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setSearch('')}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {categories.map((entry) => {
          const active = category === entry

          return (
            <Pressable
              key={entry}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setCategory(entry)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{entry}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <FlatList
        key={`menu-grid-${columns}`}
        data={enriched}
        keyExtractor={({ item }) => item.id}
        numColumns={columns}
        style={styles.list}
        contentContainerStyle={[styles.listContent, enriched.length === 0 && styles.listEmpty]}
        columnWrapperStyle={columns > 1 ? styles.column : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title={hydrated ? 'No menu items' : 'Loading menu…'}
            message={hydrated
              ? 'Menu items synced from the admin panel will appear here.'
              : 'Reading the local menu cache.'}
            actionLabel={hydrated ? 'Refresh' : undefined}
            onAction={hydrated ? () => void refresh() : undefined}
          />
        }
        renderItem={({ item: entry }) => (
          <MenuRow
            item={entry.item}
            projection={entry.projection}
            onToggle={(value) => void setAvailability(entry.item.id, value)}
            onEditPrice={() => setEditor({ item: entry.item, price: entry.projection.price })}
          />
        )}
      />

      {editor ? (
        <PriceEditor
          key={`${editor.item.id}-${editor.price}`}
          visible
          itemName={editor.item.name}
          currentPrice={editor.price}
          onCancel={() => setEditor(null)}
          onSave={async (price) => {
            await setPrice(editor.item.id, price)
            setEditor(null)
          }}
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  syncButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  clear: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    ...typography.label,
    color: colors.info,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.label,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.accentText,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  listEmpty: {
    justifyContent: 'center',
  },
  column: {
    gap: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  pressed: {
    opacity: 0.72,
  },
})
