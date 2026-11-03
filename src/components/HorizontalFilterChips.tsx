import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, Layout, Radius, Spacing } from '../theme/colors';
import { FilterChipOption } from '../types';

export interface HorizontalFilterChipsProps<T> {
  options: Array<FilterChipOption<T>>;
  selectedId: T;
  onSelect: (id: T) => void;
}

/** Pinned horizontal chip bar used by orders, menu, reservations and ledger. */
export function HorizontalFilterChips<T>({
  options,
  selectedId,
  onSelect,
}: HorizontalFilterChipsProps<T>) {
  return (
    <View style={styles.shell}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              key={String(option.id)}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label} filter${
                option.count !== undefined ? `, ${option.count} items` : ''
              }`}
              testID={`filter_chip_${option.label.toLowerCase().replace(/\s+/g, '_')}`}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : styles.chipIdle,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
              {option.count !== undefined ? (
                <View style={[styles.countPill, selected && styles.countPillSelected]}>
                  <Text style={[styles.countText, selected && styles.countTextSelected]}>
                    {option.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.background,
    paddingVertical: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    minHeight: Layout.minTouch,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: Colors.surface,
    borderColor: Colors.surfaceBorder,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipLabelSelected: {
    color: Colors.white,
  },
  countPill: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countPillSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  countTextSelected: {
    color: Colors.white,
  },
});
