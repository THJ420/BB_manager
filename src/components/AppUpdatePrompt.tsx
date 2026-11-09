import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, Radius, Spacing } from '../theme/colors';
import {
  currentAppVersion,
  downloadAndInstallUpdate,
  ReleaseInfo,
} from '../services/updater';

interface AppUpdatePromptProps {
  release: ReleaseInfo | null;
  visible: boolean;
  onDismiss: () => void;
}

/**
 * High-priority update prompt for the public GitHub release feed. Shown
 * automatically on launch and immediately after a manual "Check for Updates".
 */
export function AppUpdatePrompt({ release, visible, onDismiss }: AppUpdatePromptProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstall = async () => {
    if (!release || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadAndInstallUpdate(release);
      onDismiss();
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : 'The update could not be installed.'
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!release) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!downloading) onDismiss();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>UPDATE AVAILABLE</Text>
          </View>

          <Text style={styles.title}>
            New Version Available (v{release.version})
          </Text>
          <Text style={styles.subtitle}>
            You are running v{currentAppVersion()}. Update now to get the latest
            fixes and features.
          </Text>

          {release.notes ? (
            <ScrollView style={styles.notesBox} nestedScrollEnabled>
              <Text style={styles.notesText}>{release.notes.slice(0, 1200)}</Text>
            </ScrollView>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void handleInstall()}
            disabled={downloading}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
              downloading && styles.buttonDisabled,
            ]}
            testID="btn_update_install"
          >
            {downloading ? (
              <View style={styles.downloadingRow}>
                <ActivityIndicator color={Colors.white} />
                <Text style={styles.primaryText}>DOWNLOADING…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>UPDATE NOW</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onDismiss}
            disabled={downloading}
            accessibilityRole="button"
            style={styles.secondaryButton}
            testID="btn_update_later"
          >
            <Text style={styles.secondaryText}>LATER</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    padding: Spacing.lg,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  notesBox: {
    maxHeight: 160,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.sm,
  },
  notesText: {
    fontSize: 11,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Colors.white,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});