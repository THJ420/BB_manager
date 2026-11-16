import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Colors, Layout, Radius } from '../theme/colors';
import { Fonts, Typography } from '../theme/typography';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  prefix?: string;
  errorText?: string;
  testID?: string;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  maxLength?: number;
  accessibilityLabel?: string;
}

/** Hollow obsidian field with a 48dp tap target and indigo focus state. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
  numberOfLines,
  prefix,
  errorText,
  testID,
  editable = true,
  style,
  maxLength,
  accessibilityLabel,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.group, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          Boolean(errorText) && styles.fieldError,
          !editable && styles.fieldDisabled,
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            !editable && styles.inputDisabled,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          editable={editable}
          maxLength={maxLength}
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 6,
  },
  label: {
    ...Typography.sectionLabel,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.minTouch,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    gap: 4,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    minHeight: 88,
    paddingVertical: 10,
  },
  fieldFocused: {
    borderColor: Colors.primary,
  },
  fieldError: {
    borderColor: Colors.error,
  },
  fieldDisabled: {
    opacity: 0.55,
  },
  inputDisabled: {
    color: Colors.textMuted,
  },
  prefix: {
    fontFamily: Fonts.jakartaBold,
    fontSize: 15,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    minHeight: Layout.minTouch,
    fontFamily: Fonts.interRegular,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 68,
    paddingTop: 2,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
  },
});