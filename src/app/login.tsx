import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { LoadingScreen } from '../components/LoadingScreen';
import { TextField } from '../components/TextField';
import { Colors, Radius, Spacing } from '../theme/colors';
import { useApp } from '../state/AppProvider';
import { DEMO_BRANCH_CODE, DEMO_EMAIL, DEMO_PASSWORD } from '../constants/branches';

export default function LoginScreen() {
  const router = useRouter();
  const { state, login, isLiveBackend } = useApp();
  const [email, setEmail] = useState(isLiveBackend ? '' : DEMO_EMAIL);
  const [password, setPassword] = useState(isLiveBackend ? '' : DEMO_PASSWORD);
  const [branchCode, setBranchCode] = useState(isLiveBackend ? '' : DEMO_BRANCH_CODE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!state.hydrated) {
    return <LoadingScreen label="Restoring terminal…" />;
  }

  if (state.session) {
    return <Redirect href="/(app)" />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    if (!branchCode.trim()) {
      setErrorMessage('Branch Code is required for local pickup routing.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const result = await login(email, password, branchCode);
    setIsLoading(false);

    if (result.ok) {
      router.replace('/(app)');
    } else {
      setErrorMessage(result.error ?? 'Unable to sign in to the terminal.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>BB</Text>
            </View>
            <Text style={styles.appName}>BB MANAGER</Text>
            <Text style={styles.tagline}>Multi-Branch Restaurant Pickup Terminal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Staff Sign In</Text>
            <Text style={styles.cardSubtitle}>Enter your assigned restaurant credentials</Text>

            {!isLiveBackend ? (
              <View style={styles.demoNotice}>
                <Text style={styles.demoNoticeTitle}>LOCAL DEMO BUILD</Text>
                <Text style={styles.demoNoticeText}>
                  PocketBase is not configured, so live staff accounts cannot sign in.
                  Set EXPO_PUBLIC_POCKETBASE_URL and rebuild to use RADHUNI branch codes.
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TextField
              label="Staff Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage(null);
              }}
              placeholder="staff@restaurant.internal"
              keyboardType="email-address"
              autoCapitalize="none"
              testID="login_email_input"
            />

            <TextField
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrorMessage(null);
              }}
              placeholder="Enter password"
              secureTextEntry
              autoCapitalize="none"
              testID="login_password_input"
            />

            <TextField
              label="Branch Code"
              value={branchCode}
              onChangeText={(value) => {
                setBranchCode(value.toUpperCase());
                setErrorMessage(null);
              }}
              placeholder={isLiveBackend ? 'e.g. RADHUNI-2-0' : 'e.g. DT-01, UB-02'}
              autoCapitalize="characters"
              testID="login_branch_input"
            />

            <ActionButton
              label={isLoading ? 'CONNECTING…' : 'ENTER DASHBOARD'}
              variant="primary"
              fullWidth
              disabled={isLoading}
              onPress={() => void handleLogin()}
              testID="login_submit_btn"
              style={styles.submit}
            />

            {!isLiveBackend ? (
              <Pressable
                onPress={() => {
                  setEmail(DEMO_EMAIL);
                  setPassword(DEMO_PASSWORD);
                  setBranchCode(DEMO_BRANCH_CODE);
                  setErrorMessage(null);
                }}
                accessibilityRole="button"
                style={styles.demoButton}
                testID="login_demo_btn"
              >
                <Text style={styles.demoText}>Use Default Demo Credentials</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.footer}>
            {isLiveBackend
              ? 'PocketBase live backend • Local SQLite Outbox Ready'
              : 'Local demo backend • Set EXPO_PUBLIC_POCKETBASE_URL for live data'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: 4,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: Colors.textPrimary,
  },
  tagline: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -8,
    marginBottom: 4,
  },
  demoNotice: {
    backgroundColor: Colors.warningMuted,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: Radius.sm,
    padding: 10,
    gap: 2,
  },
  demoNoticeTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: Colors.warning,
  },
  demoNoticeText: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  errorBox: {
    backgroundColor: Colors.errorMuted,
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: Radius.sm,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  submit: {
    marginTop: 4,
  },
  demoButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  footer: {
    marginTop: Spacing.lg,
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
