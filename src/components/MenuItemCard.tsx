import React from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Colors, Layout, Radius } from '../theme/colors';
import { formatCurrency } from '../lib/format';
import { MenuItem } from '../types';

export interface MenuItemCardProps {
  item: MenuItem;
  onToggleStock: (inStock: boolean) => void;
  onEditItem: () => void;
}

export function MenuItemCard({ item, onToggleStock, onEditItem }: MenuItemCardProps) {
  return (
    <View
      style={[styles.card, !item.inStock && styles.cardOutOfStock]}
      testID={`menu_item_${item.id}`}
    >
      <Pressable
        onPress={onEditItem}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
        style={styles.mediaPress}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderIcon}>🍽️</Text>
          </View>
        )}

        <View style={styles.mediaOverlay}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {item.category.toUpperCase()}
            </Text>
          </View>
          {!item.isVisible ? (
            <View style={styles.hiddenPill}>
              <Text style={styles.hiddenText}>HIDDEN</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={onEditItem}
        accessibilityRole="button"
        accessibilityLabel={`Edit details for ${item.name}`}
        style={styles.body}
      >
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <Pressable
          onPress={onEditItem}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}, currently ${formatCurrency(item.price)}`}
          testID={`price_edit_${item.id}`}
          style={styles.priceBlock}
        >
          <Text style={styles.price}>{formatCurrency(item.price)}</Text>
          <Text style={styles.priceHint}>TAP TO EDIT ITEM</Text>
        </Pressable>

        <View style={styles.stockBlock}>
          <Switch
            value={item.inStock}
            onValueChange={onToggleStock}
            trackColor={{
              false: Colors.switchTrackOff,
              true: Colors.successMuted,
            }}
            thumbColor={item.inStock ? Colors.success : Colors.switchThumbOff}
            ios_backgroundColor={Colors.switchTrackOff}
            hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
            testID={`switch_stock_${item.id}`}
            accessibilityLabel={`Stock status for ${item.name}`}
          />
          <Text
            style={[styles.stockText, { color: item.inStock ? Colors.success : Colors.error }]}
            numberOfLines={1}
          >
            {item.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
    gap: 8,
    minWidth: 0,
  },
  cardOutOfStock: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  mediaPress: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 86,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHighlight,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 26,
  },
  mediaOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  categoryPill: {
    backgroundColor: 'rgba(18, 18, 18, 0.82)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: '62%',
  },
  categoryText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: Colors.textSecondary,
  },
  hiddenPill: {
    backgroundColor: Colors.errorMuted,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  hiddenText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: Colors.error,
  },
  body: {
    gap: 3,
    minHeight: 62,
  },
  name: {
    fontSize: 13.5,
    fontWeight: '800',
    lineHeight: 17,
    color: Colors.textPrimary,
  },
  description: {
    fontSize: 10.5,
    lineHeight: 14,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceBlock: {
    flex: 1,
    minHeight: Layout.minTouch,
    justifyContent: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  priceHint: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: Colors.primary,
  },
  stockBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Layout.minTouch,
    minWidth: 56,
    gap: 1,
  },
  stockText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
