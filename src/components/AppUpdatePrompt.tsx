import React, { useEffect, useRef, useState } from 'react';
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
  checkForUpdate,
  currentAppVersion,
  downloadAndInstallUpdate,
  ReleaseInfo,
} from '../services/updater';

/**
 * Startup update prompt for the public GitHub release feed. The check is silent
 * when offline so the terminal never blocks on it.
 */
export function AppUpdatePrompt() {
  const checked = useRef(false);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    void checkForUpdate().then((result) => {
      if (!result.available || !result.release) return;
      setRelease(result.release);
      setVisible(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!release) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadAndInstallUpdate(release);
      setVisible(false);
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
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>UPDATE AVAILABLE</Text>
          </View>

          <Text style={styles.title}>BB Manager {release.version}</Text>
          <Text style={styles.subtitle}>
            You are running v{currentAppVersion()}. Install the latest release to
            get the newest fixes.
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
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryText}>DOWNLOAD & INSTALL</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setVisible(false)}
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
    borderColor: Colors.surfaceBorder,
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
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryText: {
    fontSize: 12,
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
