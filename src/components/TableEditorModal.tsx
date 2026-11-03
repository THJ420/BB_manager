import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { newDiningTableId } from '../lib/ids';
import { DiningTable } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';

export interface TableEditorModalProps {
  visible: boolean;
  table: DiningTable | null;
  branchId: string;
  onClose: () => void;
  onSave: (table: DiningTable) => void;
}

export function TableEditorModal({
  visible,
  table,
  branchId,
  onClose,
  onSave,
}: TableEditorModalProps) {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [nameError, setNameError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(table?.name ?? '');
    setCapacity(String(table?.capacity ?? 4));
    setNameError(null);
    setCapacityError(null);
  }, [visible, table]);

  const handleSave = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Table name is required.');
      valid = false;
    }
    const seats = Number.parseInt(capacity, 10);
    if (!Number.isFinite(seats) || seats < 1 || seats > 40) {
      setCapacityError('Enter a seating capacity between 1 and 40.');
      valid = false;
    }
    if (!valid) return;

    onSave({
      // PocketBase custom IDs are exactly 15 lowercase alphanumeric chars.
      id: table?.id ?? newDiningTableId(),
      branchId: table?.branchId ?? branchId,
      tableNumber: table?.tableNumber ?? name.trim(),
      name: name.trim(),
      capacity: seats,
      isAvailable: table?.isAvailable ?? true,
      zone: table?.zone ?? 'Main Dining',
    });
    onClose();
  };

  return (
    <ModalShell
      visible={visible}
      title={table ? 'Edit Dining Table' : 'Add Dining Table'}
      subtitle="Table name and guest seating capacity."
      onClose={onClose}
      footer={
        <>
          <ActionButton label="Cancel" variant="outline" onPress={onClose} style={styles.footerButton} />
          <ActionButton
            label="Save Table"
            variant="primary"
            onPress={handleSave}
            style={styles.footerButton}
            testID="table_save"
          />
        </>
      }
    >
      <TextField
        label="Table Name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameError(null);
        }}
        placeholder="e.g. Table 4, Patio 1"
        errorText={nameError ?? undefined}
        testID="input_table_name"
      />

      <TextField
        label="Seating Capacity"
        value={capacity}
        onChangeText={(value) => {
          setCapacity(value.replace(/[^0-9]/g, ''));
          setCapacityError(null);
        }}
        keyboardType="number-pad"
        placeholder="4"
        errorText={capacityError ?? undefined}
        testID="input_table_capacity"
      />
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  footerButton: {
    flex: 1,
  },
});
