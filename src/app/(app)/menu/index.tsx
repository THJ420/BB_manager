import React, { useEffect, useMemo, useState } from 'react';
import { Redirect } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/ActionButton';
import { DialogModal } from '../../../components/DialogModal';
import { HorizontalFilterChips } from '../../../components/HorizontalFilterChips';
import { MenuItemCard } from '../../../components/MenuItemCard';
import { MenuItemEditorModal } from '../../../components/MenuItemEditorModal';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { filterMenu, menuCategoryOptions, mergeCategoryNames } from '../../../lib/domain';
import {
  createCategoryUpstream,
  fetchBranchCategories,
} from '../../../services/categories';
import { useApp } from '../../../state/AppProvider';
import {
  canCreateMenuItems,
  canDeleteMenuItems,
  canEditMenuDetails,
} from '../../../services/branchScope';
import { Colors, Spacing } from '../../../theme/colors';
import { MenuItem } from '../../../types';

export default function MenuStockScreen() {
  const { state, setMenuItemStock, saveMenuItem, deleteMenuItem, refreshData } = useApp();
  const { refreshing, onRefresh } = usePullToRefresh(refreshData);
  const role = state.session?.role ?? '';
  const canCreate = canCreateMenuItems(role);
  const canDelete = canDeleteMenuItems(role);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);
  const branchId = state.activeBranch.id;

  // Categories are fetched from PocketBase rather than hardcoded. The derived
  // list from menuItems keeps the UI usable offline and makes a category saved
  // on an item appear immediately, before the next refresh.
  useEffect(() => {
    let alive = true;
    void fetchBranchCategories(branchId, state.menuItems).then((names) => {
      if (alive) setRemoteCategories(names);
    });
    return () => {
      alive = false;
    };
    // Re-run when the catalogue size changes (a new item may introduce a
    // category) or the active branch changes.
  }, [branchId, state.menuItems.length]);

  const categories = useMemo(
    () => mergeCategoryNames(remoteCategories, state.menuItems.map((item) => item.category)),
    [remoteCategories, state.menuItems]
  );

  const handleCreateCategory = (name: string) => {
    setRemoteCategories((prev) => mergeCategoryNames(prev, [name]));
    void createCategoryUpstream(branchId, name);
  };

  const categoryOptions = useMemo(
    () => menuCategoryOptions(state.menuItems, remoteCategories),
    [state.menuItems, remoteCategories]
  );
  const filteredItems = useMemo(
    () => filterMenu(state.menuItems, selectedCategory, searchQuery),
    [state.menuItems, selectedCategory, searchQuery]
  );
  const inStockCount = state.menuItems.filter((item) => item.inStock).length;

  const openCreate = () => {
    setEditingItem(null);
    setEditorVisible(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setEditorVisible(true);
  };

  // Owner accounts are not branch-scoped; menu edits belong to a terminal.
  if (state.session?.role === 'owner') {
    return <Redirect href="/(app)/analytics" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Menu & Stock"
        subtitle={`${state.activeBranch.name} • ${inStockCount} / ${state.menuItems.length} IN STOCK`}
        right={
          canCreate ? (
            <ActionButton
              label="+ ADD ITEM"
              variant="primary"
              compact
              onPress={openCreate}
              testID="btn_add_menu_item"
            />
          ) : undefined
        }
      />

      <View style={styles.searchWrap}>
        <TextField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items or ingredients..."
          testID="menu_search_input"
        />
      </View>

      <HorizontalFilterChips
        options={categoryOptions}
        selectedId={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <MenuItemCard
              item={item}
              onToggleStock={(inStock) => void setMenuItemStock(item.id, inStock)}
              onEditItem={() => openEdit(item)}
            />
          </View>
        )}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        overScrollMode="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.surfaceElevated}
            tintColor={Colors.primary}
            title="Refreshing menu…"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🍔</Text>
            <Text style={styles.emptyTitle}>No menu items found</Text>
            <Text style={styles.emptySub}>
              {canCreate
                ? 'Adjust the category filter, clear the search, or add a new dish.'
                : 'Adjust the category filter or clear the search. Your role cannot add menu items.'}
            </Text>
          </View>
        }
      />

      <MenuItemEditorModal
        visible={editorVisible}
        item={editingItem}
        branchId={state.activeBranch.id}
        // Creating needs a name, so the role that may create also gets the
        // detail fields; editing keeps them manager-only.
        canEditDetails={editingItem ? canEditMenuDetails(role) : canCreate}
        canDelete={editingItem !== null && canDelete}
        onDelete={() => {
          if (!editingItem) return;
          setDeleteTarget(editingItem);
          setEditorVisible(false);
          setEditingItem(null);
        }}
        onClose={() => {
          setEditorVisible(false);
          setEditingItem(null);
        }}
        onSave={(item) => void saveMenuItem(item)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
      />

      <DialogModal
        visible={deleteTarget !== null}
        title="Delete Menu Item"
        message={
          deleteTarget
            ? `Remove “${deleteTarget.name}” from the menu and the website?`
            : ''
        }
        onRequestClose={() => setDeleteTarget(null)}
        actions={[
          { label: 'Cancel', variant: 'outline', onPress: () => setDeleteTarget(null) },
          {
            label: 'Delete',
            variant: 'danger',
            onPress: () => {
              const target = deleteTarget;
              setDeleteTarget(null);
              if (target) void deleteMenuItem(target.id);
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchWrap: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  gridContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
    gap: 12,
    flexGrow: 1,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
