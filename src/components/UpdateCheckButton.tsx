import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { DialogModal } from './DialogModal';
import { useApp } from '../state/AppProvider';
import { currentAppVersion, UPDATE_CHECK_ERROR_MESSAGE } from '../services/updater';
import { Colors, Spacing } from '../theme/colors';
import { Fonts } from '../theme/typography';

/**
 * Manual "Check for Updates" trigger shared by terminal settings and the
 * owner command center. A newer release opens the global update prompt
 * immediately; otherwise the result is reported inline.
 */
export function UpdateCheckButton() {
  const { checkForAppUpdate, checkingAppUpdate } = useApp();
  const [result, setResult] = useState<{ title: string; message: string } | null>(null);

  const handleCheck = async () => {
    if (checkingAppUpdate) return;
    setResult(null);
    try {
      const check = await checkForAppUpdate();
      if (check.error) {
        setResult({ title: 'Update Check Failed', message: UPDATE_CHECK_ERROR_MESSAGE });
      } else if (!check.available) {
        setResult({
          title: 'Up to Date',
          message: 'You are already using the latest version of the app.',
        });
      }
    } catch (error) {
      console.warn('Manual app update check failed', error);
      setResult({ title: 'Update Check Failed', message: UPDATE_CHECK_ERROR_MESSAGE });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ActionButton
          label={checkingAppUpdate ? 'CHECKING FOR UPDATES…' : 'CHECK FOR UPDATES'}
          variant="tonal"
          fullWidth
          disabled={checkingAppUpdate}
          onPress={() => void handleCheck()}
          testID="btn_check_for_updates"
        />
        {checkingAppUpdate ? (
          <ActivityIndicator style={styles.spinner} color={Colors.primary} />
        ) : null}
      </View>
      <Text style={styles.hint}>Current Version: v{currentAppVersion()}</Text>

      <DialogModal
        visible={result !== null}
        title={result?.title ?? ''}
        message={result?.message}
        onRequestClose={() => setResult(null)}
        actions={[{ label: 'Done', onPress: () => setResult(null) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  row: {
    position: 'relative',
  },
  spinner: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    fontFamily: Fonts.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.xs,
  },
});