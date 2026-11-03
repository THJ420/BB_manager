import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { MENU_CATEGORIES } from '../lib/domain';
import { parsePrice } from '../lib/format';
import { newMenuItemId } from '../lib/ids';
import { MenuItem } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { SwitchRow } from './SwitchRow';
import { TextField } from './TextField';

export interface MenuItemEditorModalProps {
  visible: boolean;
  item: MenuItem | null;
  branchId: string;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
  /** Managers only; other roles are rejected by the PocketBase menu guard. */
  canEditDetails?: boolean;
}

type PhotoSource = 'camera' | 'library';

export function MenuItemEditorModal({
  visible,
  item,
  branchId,
  onClose,
  onSave,
  canEditDetails = true,
}: MenuItemEditorModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Burgers');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [priceText, setPriceText] = useState('12.50');
  const [inStock, setInStock] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? '');
    setCategory(item?.category ?? 'Burgers');
    setDescription(item?.description ?? '');
    setImageUrl(item?.imageUrl ?? '');
    setPriceText(item ? item.price.toFixed(2) : '12.50');
    setInStock(item?.inStock ?? true);
    setIsVisible(item?.isVisible ?? true);
    setNameError(null);
    setPriceError(null);
  }, [visible, item]);

  const pickPhoto = async (source: PhotoSource) => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          source === 'camera'
            ? 'Camera access is needed to snap dish photos.'
            : 'Photo library access is needed to attach dish photos.'
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        // Native crop UI is locked to a square. The editor also renders the
        // attachment in a 1:1 frame so every menu tile receives a square crop.
        aspect: [1, 1],
        quality: 0.65,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      const asset = result.canceled ? undefined : result.assets[0];
      if (asset?.uri) {
        setImageUrl(asset.uri);
      }
    } catch {
      Alert.alert(
        'Photo unavailable',
        'This device could not open the camera or photo library. Try again or choose a different image.'
      );
    }
  };

  const handleSave = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Item name is required.');
      valid = false;
    }
    const price = parsePrice(priceText);
    if (price === null) {
      setPriceError('Enter a valid price, e.g. 12.50.');
      valid = false;
    }
    if (!valid || price === null) return;

    onSave({
      // PocketBase custom IDs are exactly 15 lowercase alphanumeric chars.
      id: item?.id ?? newMenuItemId(),
      branchId: item?.branchId ?? branchId,
      name: name.trim(),
      category,
      description: description.trim() || 'Fresh kitchen preparation',
      price,
      currency: item?.currency ?? 'USD',
      inStock,
      isVisible,
      preparationMinutes: item?.preparationMinutes ?? 10,
      imageUrl: imageUrl.trim() || undefined,
      modifiers: item?.modifiers,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <ModalShell
      visible={visible}
      title={item ? 'Edit Menu Item' : 'Add Menu Item'}
      subtitle="Update the full item record, stock status, website visibility and square photo."
      onClose={onClose}
      footer={
        <>
          <ActionButton
            label="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.footerButton}
          />
          <ActionButton
            label={item ? 'Update Item' : 'Add Item'}
            variant="primary"
            onPress={handleSave}
            style={styles.footerButton}
            testID="menu_editor_save"
          />
        </>
      }
    >
      <TextField
        label="Item Name *"
        editable={canEditDetails}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameError(null);
        }}
        placeholder="e.g. Wagyu Truffle Smashburger"
        errorText={nameError ?? undefined}
        testID="input_item_name"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.categoryRow}>
          {MENU_CATEGORIES.map((entry) => {
            const selected = category === entry;
            return (
              <Pressable
                key={entry}
                onPress={() => setCategory(entry)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.categoryChip,
                  selected ? styles.categoryChipSelected : styles.categoryChipIdle,
                ]}
              >
                <Text
                  style={[styles.categoryText, selected && styles.categoryTextSelected]}
                  numberOfLines={1}
                >
                  {entry}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {!canEditDetails ? (
        <Text style={styles.permissionHint}>
          Only managers can rename, recategorise or re-photograph an item. Price and stock
          stay editable.
        </Text>
      ) : null}

      <TextField
        label="Ingredients / Short Description"
        editable={canEditDetails}
        value={description}
        onChangeText={setDescription}
        placeholder="Ingredients, allergen notes or preparation details"
        multiline
        numberOfLines={3}
        testID="input_item_desc"
      />

      {canEditDetails ? (
      <View style={styles.photoCard}>
        <View style={styles.photoHeader}>
          <Text style={styles.fieldLabel}>Item Photo & 1:1 Crop</Text>
          {imageUrl ? (
            <Pressable
              onPress={() => setImageUrl('')}
              accessibilityRole="button"
              accessibilityLabel="Remove item photo"
              style={styles.removePhotoHit}
            >
              <Text style={styles.removePhoto}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {imageUrl ? (
          <View style={styles.photoAttached}>
            <View style={styles.previewSquare}>
              <Image source={{ uri: imageUrl }} style={styles.previewImage} resizeMode="cover" />
              <View style={styles.attachedBadge}>
                <Text style={styles.attachedText}>SQUARE CROP</Text>
              </View>
              <View style={styles.ratioBadge}>
                <Text style={styles.ratioText}>1:1</Text>
              </View>
            </View>
            <View style={styles.photoActions}>
              <ActionButton
                label="📷 Retake"
                variant="subtle"
                onPress={() => void pickPhoto('camera')}
                style={styles.photoAction}
                compact
              />
              <ActionButton
                label="📁 Replace"
                variant="subtle"
                onPress={() => void pickPhoto('library')}
                style={styles.photoAction}
                compact
              />
            </View>
          </View>
        ) : (
          <View style={styles.uploadZone}>
            <Text style={styles.uploadTitle}>No square dish photo attached</Text>
            <Text style={styles.uploadSubtitle}>
              Snap a live dish photo or pick one from the gallery. The native cropper is
              constrained to a 1:1 square before the image is attached.
            </Text>
            <View style={styles.photoActions}>
              <ActionButton
                label="📷 Snap Photo"
                variant="primary"
                onPress={() => void pickPhoto('camera')}
                style={styles.photoAction}
                compact
              />
              <ActionButton
                label="📁 Upload Device"
                variant="subtle"
                onPress={() => void pickPhoto('library')}
                style={styles.photoAction}
                compact
              />
            </View>
          </View>
        )}
      </View>
      ) : null}

      <TextField
        label={`Price (${item?.currency ?? 'USD'}) *`}
        value={priceText}
        onChangeText={(value) => {
          setPriceText(value);
          setPriceError(null);
        }}
        prefix="$"
        keyboardType="decimal-pad"
        errorText={priceError ?? undefined}
        testID="input_item_price"
      />

      <View style={styles.toggleGroup}>
        <SwitchRow
          title="Stock Status"
          subtitle={inStock ? 'Available on POS & kitchen floor' : 'Marked 86 / sold out'}
          value={inStock}
          onValueChange={setInStock}
          activeColor={Colors.success}
          activeMuted={Colors.successMuted}
          inactiveColor={Colors.textSecondary}
        />
        <View style={styles.divider} />
        <SwitchRow
          title="Website Visibility"
          subtitle={
            isVisible
              ? 'Visible for online customer ordering'
              : 'Hidden from web & pickup menu'
          }
          value={isVisible}
          onValueChange={setIsVisible}
          activeColor={Colors.primary}
          activeMuted={Colors.primaryMuted}
          inactiveColor={Colors.textSecondary}
        />
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  permissionHint: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 4,
  },
  categoryChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  categoryChipIdle: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.surfaceBorder,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  categoryTextSelected: {
    color: Colors.white,
  },
  photoCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 12,
    gap: 8,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removePhoto: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.error,
  },
  removePhotoHit: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  photoAttached: {
    gap: 8,
  },
  previewSquare: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceHighlight,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  attachedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.successMuted,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  attachedText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: Colors.success,
  },
  ratioBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(18, 18, 18, 0.82)',
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratioText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: Colors.textPrimary,
  },
  uploadZone: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.surfaceBorder,
    borderRadius: Radius.md,
    padding: 12,
    gap: 6,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  uploadSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    color: Colors.textMuted,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  photoAction: {
    flex: 1,
  },
  toggleGroup: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  footerButton: {
    flex: 1,
  },
});
