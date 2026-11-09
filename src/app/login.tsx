import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
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
import { DEMO_EMAIL, DEMO_PASSWORD } from '../constants/branches';

export default function LoginScreen() {
  const router = useRouter();
  const { state, login, isLiveBackend } = useApp();
  const [username, setUsername] = useState(isLiveBackend ? '' : DEMO_EMAIL);
  const [password, setPassword] = useState(isLiveBackend ? '' : DEMO_PASSWORD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!state.hydrated) {
    return <LoadingScreen label="Starting up…" />;
  }

  if (state.session) {
    return (
      <Redirect
        href={state.session.role === 'owner' ? '/(app)/analytics' : '/(app)'}
      />
    );
  }

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const result = await login(username, password);
    setIsLoading(false);

    if (result.ok) {
      router.replace(result.role === 'owner' ? '/(app)/analytics' : '/(app)');
    } else {
      setErrorMessage(result.error ?? 'Unable to sign in.');
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
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              accessibilityLabel="BB Manager"
            />
            <Text style={styles.appName}>BB MANAGER</Text>
            <Text style={styles.tagline}>Restaurant Operations Terminal</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Use the username and password provided by your manager.
            </Text>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TextField
              label="Username"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setErrorMessage(null);
              }}
              placeholder="e.g. edk-mosina"
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

            <ActionButton
              label={isLoading ? 'SIGNING IN…' : 'SIGN IN'}
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
                  setUsername(DEMO_EMAIL);
                  setPassword(DEMO_PASSWORD);
                  setErrorMessage(null);
                }}
                accessibilityRole="button"
                style={styles.demoButton}
                testID="login_demo_btn"
              >
                <Text style={styles.demoText}>Use Demo Account</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.footer}>BB Manager · Secure staff access</Text>
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
  logo: {
    width: 96,
    height: 96,
    borderRadius: Radius.lg,
    marginBottom: 8,
    backgroundColor: Colors.surface,
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
    lineHeight: 17,
    color: Colors.textSecondary,
    marginTop: -8,
    marginBottom: 4,
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
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
