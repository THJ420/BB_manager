import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { Colors, Radius, Spacing } from '../theme/colors';
import { Typography } from '../theme/typography';

export interface BulkMenuActionBarProps {
  selectedCount: number;
  /** Delete is only offered to roles allowed by menu_items.deleteRule. */
  canDelete: boolean;
  onSelectAll: () => void;
  onCancel: () => void;
  onMarkStock: (inStock: boolean) => void;
  onAdjustPrice: () => void;
  onSetVisibility: (isVisible: boolean) => void;
  onDelete: () => void;
}

/**
 * Selection-mode toolbar for the menu grid. Stock/price/visibility are allowed
 * for every staff role (PocketBase guards floor_staff to exactly these three
 * columns); delete is gated by canDeleteMenuItems upstream.
 */
export function BulkMenuActionBar({
  selectedCount,
  canDelete,
  onSelectAll,
  onCancel,
  onMarkStock,
  onAdjustPrice,
  onSetVisibility,
  onDelete,
}: BulkMenuActionBarProps) {
  const noneSelected = selectedCount === 0;

  return (
    <View style={styles.bar} testID="bulk_menu_action_bar">
      <View style={styles.headerRow}>
        <Text style={styles.count} testID="bulk_selected_count">
          {selectedCount} selected
        </Text>
        <View style={styles.headerActions}>
          <ActionButton
            label="Select all"
            variant="subtle"
            compact
            onPress={onSelectAll}
            testID="bulk_select_all"
            accessibilityHint="Selects every item in the current filter"
          />
          <ActionButton
            label="Cancel"
            variant="outline"
            compact
            onPress={onCancel}
            testID="bulk_cancel"
          />
        </View>
      </View>

      <View style={styles.actionsRow}>
        <ActionButton
          label="Mark in stock"
          variant="success"
          compact
          disabled={noneSelected}
          onPress={() => onMarkStock(true)}
          testID="bulk_mark_in_stock"
        />
        <ActionButton
          label="Mark out of stock"
          variant="warning"
          compact
          disabled={noneSelected}
          onPress={() => onMarkStock(false)}
          testID="bulk_mark_out_of_stock"
        />
        <ActionButton
          label="Adjust price…"
          variant="tonal"
          compact
          disabled={noneSelected}
          onPress={onAdjustPrice}
          testID="bulk_adjust_price"
        />
        <ActionButton
          label="Show on website"
          variant="subtle"
          compact
          disabled={noneSelected}
          onPress={() => onSetVisibility(true)}
          testID="bulk_show_website"
        />
        <ActionButton
          label="Hide from website"
          variant="subtle"
          compact
          disabled={noneSelected}
          onPress={() => onSetVisibility(false)}
          testID="bulk_hide_website"
        />
        {canDelete ? (
          <ActionButton
            label="Delete"
            variant="dangerOutline"
            compact
            disabled={noneSelected}
            onPress={onDelete}
            testID="bulk_delete"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  count: {
    ...Typography.cardTitle,
    color: Colors.primaryText,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});