import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import { tableCapacityLabel } from '../lib/domain';
import { DiningTable } from '../types';

export interface TableCardProps {
  table: DiningTable;
  onEdit: (table: DiningTable) => void;
}

/** Simplified floor card: table name + seating capacity only. */
export function TableCard({ table, onEdit }: TableCardProps) {
  return (
    <Pressable
      onPress={() => onEdit(table)}
      accessibilityRole="button"
      accessibilityLabel={`${table.name}, seats ${table.capacity}. Edit table`}
      testID={`table_card_${table.id}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.name} numberOfLines={2}>
        {table.name}
      </Text>

      <View style={styles.capacityGroup}>
        <View style={styles.capacityPill}>
          <Text style={styles.capacityValue}>{table.capacity}</Text>
          <Text style={styles.capacityLabel}>SEATS</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    minHeight: 84,
  },
  pressed: {
    backgroundColor: Colors.surfaceHighlight,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  capacityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityPill: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  capacityValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.success,
  },
  capacityLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textMuted,
  },
});
