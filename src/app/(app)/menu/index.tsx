import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/ActionButton';
import { HorizontalFilterChips } from '../../../components/HorizontalFilterChips';
import { MenuItemCard } from '../../../components/MenuItemCard';
import { MenuItemEditorModal } from '../../../components/MenuItemEditorModal';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { filterMenu, menuCategoryOptions } from '../../../lib/domain';
import { useApp } from '../../../state/AppProvider';
import { canCreateMenuItems, canEditMenuDetails } from '../../../services/branchScope';
import { Colors, Spacing } from '../../../theme/colors';
import { MenuItem } from '../../../types';

export default function MenuStockScreen() {
  const { state, setMenuItemStock, saveMenuItem } = useApp();
  const role = state.session?.role ?? '';
  const canCreate = canCreateMenuItems(role);
  const canEditDetails = canEditMenuDetails(role);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const categoryOptions = useMemo(
    () => menuCategoryOptions(state.menuItems),
    [state.menuItems]
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
        canEditDetails={canEditDetails}
        onClose={() => {
          setEditorVisible(false);
          setEditingItem(null);
        }}
        onSave={(item) => void saveMenuItem(item)}
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
