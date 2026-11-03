import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ALERT_TONES } from '../lib/alertTones';
import { playAlertTone, stopAlertTone } from '../services/alertTones';
import { Colors, Layout, Radius } from '../theme/colors';
import { AlertToneId } from '../types';
import { ActionButton } from './ActionButton';
import { ModalShell } from './ModalShell';

export interface AlertTonePickerModalProps {
  visible: boolean;
  selectedToneId: AlertToneId;
  onClose: () => void;
  onSave: (toneId: AlertToneId) => void;
}

export function AlertTonePickerModal({
  visible,
  selectedToneId,
  onClose,
  onSave,
}: AlertTonePickerModalProps) {
  const [draftToneId, setDraftToneId] = useState<AlertToneId>(selectedToneId);
  const [previewingId, setPreviewingId] = useState<AlertToneId | null>(null);

  useEffect(() => {
    if (!visible) {
      void stopAlertTone();
      setPreviewingId(null);
      return;
    }
    setDraftToneId(selectedToneId);
    setPreviewingId(null);
  }, [visible, selectedToneId]);

  useEffect(() => {
    return () => {
      void stopAlertTone();
    };
  }, []);

  const handleClose = () => {
    void stopAlertTone();
    setPreviewingId(null);
    onClose();
  };

  const handlePreview = (toneId: AlertToneId) => {
    if (previewingId === toneId) {
      void stopAlertTone();
      setPreviewingId(null);
      return;
    }

    setPreviewingId(toneId);
    void playAlertTone(toneId, () => {
      setPreviewingId((current) => (current === toneId ? null : current));
    }).then((played) => {
      if (!played) {
        setPreviewingId((current) => (current === toneId ? null : current));
      }
    });
  };

  const handleSave = () => {
    void stopAlertTone();
    setPreviewingId(null);
    onSave(draftToneId);
  };

  return (
    <ModalShell
      visible={visible}
      title="Order Alert Tone"
      subtitle="Choose and preview the sound that plays when a new pickup ticket arrives."
      onClose={handleClose}
      footer={
        <>
          <ActionButton
            label="Cancel"
            variant="outline"
            onPress={handleClose}
            style={styles.footerButton}
          />
          <ActionButton
            label="Save Tone"
            variant="primary"
            onPress={handleSave}
            style={styles.footerButton}
            testID="btn_save_alert_tone"
          />
        </>
      }
    >
      <Text style={styles.hint}>
        {ALERT_TONES.length} built-in presets. Tap the play icon to sample a tone through the
        terminal speaker.
      </Text>

      <View style={styles.toneList}>
        {ALERT_TONES.map((tone) => {
          const selected = draftToneId === tone.id;
          const previewing = previewingId === tone.id;

          return (
            <View
              key={tone.id}
              style={[styles.toneRow, selected && styles.toneRowSelected]}
              testID={`alert_tone_${tone.id}`}
            >
              <Pressable
                onPress={() => setDraftToneId(tone.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${tone.label}. ${tone.description}`}
                style={styles.toneSelect}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <Text style={styles.radioCheck}>✓</Text> : null}
                </View>
                <View style={styles.toneText}>
                  <Text style={styles.toneName} numberOfLines={1}>
                    {tone.label}
                  </Text>
                  <Text style={styles.toneDescription} numberOfLines={1}>
                    {tone.description}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handlePreview(tone.id)}
                accessibilityRole="button"
                accessibilityLabel={
                  previewing ? `Stop preview of ${tone.label}` : `Preview ${tone.label}`
                }
                accessibilityState={{ busy: previewing }}
                testID={`preview_tone_${tone.id}`}
                style={({ pressed }) => [
                  styles.previewButton,
                  previewing && styles.previewButtonActive,
                  pressed && styles.previewButtonPressed,
                ]}
              >
                <Text
                  style={[styles.previewIcon, previewing && styles.previewIconActive]}
                >
                  {previewing ? '■' : '▶'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  toneList: {
    gap: 8,
  },
  toneRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  toneRowSelected: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primaryBorder,
  },
  toneSelect: {
    flex: 1,
    minHeight: Layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.white,
  },
  toneText: {
    flex: 1,
    gap: 2,
  },
  toneName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  toneDescription: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  previewButton: {
    width: Layout.minTouch,
    height: Layout.minTouch,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonActive: {
    backgroundColor: Colors.warningMuted,
    borderColor: Colors.warningBorder,
  },
  previewButtonPressed: {
    opacity: 0.75,
  },
  previewIcon: {
    fontSize: 15,
    color: Colors.primary,
  },
  previewIconActive: {
    fontSize: 13,
    color: Colors.warning,
  },
  footerButton: {
    flex: 1,
  },
});
