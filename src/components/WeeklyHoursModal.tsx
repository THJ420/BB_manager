import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Colors, Radius } from '../theme/colors';
import { DaySchedule } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';
import { TextField } from './TextField';

export interface WeeklyHoursModalProps {
  visible: boolean;
  schedule: DaySchedule[];
  onClose: () => void;
  onSave: (schedule: DaySchedule[]) => void;
}

export function WeeklyHoursModal({
  visible,
  schedule,
  onClose,
  onSave,
}: WeeklyHoursModalProps) {
  const [draft, setDraft] = useState<DaySchedule[]>(schedule);

  useEffect(() => {
    if (visible) {
      setDraft(schedule.map((day) => ({ ...day })));
    }
  }, [visible, schedule]);

  const updateDay = (index: number, patch: Partial<DaySchedule>) => {
    setDraft((current) =>
      current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day))
    );
  };

  return (
    <ModalShell
      visible={visible}
      title="Weekly Operating Hours"
      subtitle="Set dedicated opening and closing hours for each of the seven days."
      onClose={onClose}
      footer={
        <>
          <ActionButton label="Cancel" variant="outline" onPress={onClose} style={styles.footerButton} />
          <ActionButton
            label="Save Weekly Schedule"
            variant="primary"
            onPress={() => {
              onSave(draft);
              onClose();
            }}
            style={styles.footerButton}
            testID="weekly_hours_save"
          />
        </>
      }
    >
      {draft.map((day, index) => (
        <View key={day.day} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayName}>{day.day}</Text>
            <View style={styles.dayStatus}>
              <Text
                style={[
                  styles.dayStatusText,
                  { color: day.isOpen ? Colors.success : Colors.error },
                ]}
              >
                {day.isOpen ? 'OPEN' : 'CLOSED'}
              </Text>
              <Switch
                value={day.isOpen}
                onValueChange={(value) => updateDay(index, { isOpen: value })}
                trackColor={{ false: Colors.errorMuted, true: Colors.successMuted }}
                thumbColor={day.isOpen ? Colors.success : Colors.error}
                ios_backgroundColor={Colors.switchTrackOff}
                hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
                accessibilityLabel={`${day.day} open`}
              />
            </View>
          </View>

          {day.isOpen ? (
            <View style={styles.timeRow}>
              <TextField
                label="Open"
                value={day.openTime}
                onChangeText={(value) => updateDay(index, { openTime: value })}
                placeholder="10:00 AM"
                style={styles.timeField}
              />
              <TextField
                label="Close"
                value={day.closeTime}
                onChangeText={(value) => updateDay(index, { closeTime: value })}
                placeholder="10:30 PM"
                style={styles.timeField}
              />
            </View>
          ) : null}
        </View>
      ))}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  dayCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
    gap: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  dayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeField: {
    flex: 1,
  },
  footerButton: {
    flex: 1,
  },
});
