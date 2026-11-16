import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  sanitizeReleaseNotes,
} from '../services/updater';

interface AppUpdatePromptProps {
  release: ReleaseInfo | null;
  visible: boolean;
  onDismiss: () => void;
}

/**
 * High-priority update prompt for the public release feed. Shown automatically
 * on launch and immediately after a manual "Check for Updates". Repository
 * URLs never appear here — notes are sanitized and the download is surfaced
 * through a branded progress bar instead of raw links.
 */
export function AppUpdatePrompt({ release, visible, onDismiss }: AppUpdatePromptProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  const fillAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setDownloading(false);
      setProgress(0);
      setError(null);
      fillAnim.setValue(0);
    }
  }, [visible, fillAnim]);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, fillAnim]);

  useEffect(() => {
    if (!downloading || trackWidth <= 0) return;
    shimmerAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [downloading, trackWidth, shimmerAnim]);

  const handleInstall = async () => {
    if (!release || downloading) return;
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      await downloadAndInstallUpdate(release, setProgress);
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

  const notes = sanitizeReleaseNotes(release.notes);
  const percent = Math.min(100, Math.round(progress * 100));
  const statusText =
    progress >= 1 ? 'Preparing installer…' : 'Downloading update securely…';

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, Math.max(trackWidth, 60)],
  });

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

          {notes ? (
            <ScrollView style={styles.notesBox} nestedScrollEnabled>
              <Text style={styles.notesText}>{notes.slice(0, 1200)}</Text>
            </ScrollView>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {downloading ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressStatusRow}>
                <Text style={styles.progressStatus} testID="update_progress_status">
                  {statusText}
                </Text>
                <Text style={styles.progressPercent} testID="update_progress_percent">
                  {percent}%
                </Text>
              </View>
              <View
                style={styles.progressTrack}
                testID="update_progress_bar"
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: percent }}
                onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View style={[styles.progressFill, { width: fillWidth }]}>
                  {trackWidth > 0 ? (
                    <Animated.View
                      style={[
                        styles.progressShimmer,
                        { transform: [{ translateX: shimmerX }] },
                      ]}
                    />
                  ) : null}
                </Animated.View>
              </View>
              <Text style={styles.progressHint}>
                The installer opens automatically when the download finishes.
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => void handleInstall()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              testID="btn_update_install"
            >
              <Text style={styles.primaryText}>UPDATE NOW</Text>
            </Pressable>
          )}

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
  progressBlock: {
    gap: 8,
    paddingVertical: Spacing.xs,
  },
  progressStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    transform: [{ skewX: '-18deg' }],
  },
  progressHint: {
    fontSize: 10,
    lineHeight: 14,
    color: Colors.textMuted,
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
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
});