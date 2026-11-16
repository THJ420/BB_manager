import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Layout, Radius, Spacing } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';

export interface ModalShellProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}

export function ModalShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  scroll = true,
}: ModalShellProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* The backdrop is a sibling behind the sheet. Keeping it out of the
          KeyboardAvoidingView prevents it from winning the touch responder on
          Android (a full-screen absolute Pressable above the sheet swallows
          every tap on inputs). */}
      <View style={styles.overlay}>
        <BlurView
          intensity={40}
          tint="dark"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
          style={styles.scrimFrost}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID="modal_backdrop"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
          pointerEvents="box-none"
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {scroll ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                // "always" lets the first tap focus an input instead of being
                // consumed to dismiss the keyboard (Android default is "never").
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={styles.content}>{children}</View>
            )}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  scrimFrost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.screenSubtitle,
  },
  closeButton: {
    width: Layout.minTouch,
    height: Layout.minTouch,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    backgroundColor: Colors.glassFillStrong,
  },
  closeText: {
    fontFamily: Fonts.interBold,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    backgroundColor: Colors.surfaceElevated,
  },
});
