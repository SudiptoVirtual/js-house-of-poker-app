import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';


import { colors } from '../theme/colors';
type AuthTextFieldProps = TextInputProps & {
  errorText?: string;
  helperText?: string;
  label: string;
  showPasswordToggle?: boolean;
};

export function AuthTextField({
  errorText,
  helperText,
  label,
  secureTextEntry,
  showPasswordToggle = false,
  ...inputProps
}: AuthTextFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hasPasswordToggle = showPasswordToggle && secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholderTextColor={colors.mutedText}
          secureTextEntry={hasPasswordToggle ? !isPasswordVisible : secureTextEntry}
          selectionColor={colors.secondary}
          style={[
            styles.input,
            hasPasswordToggle ? styles.inputWithPasswordToggle : null,
            errorText ? styles.inputError : null,
          ]}
          {...inputProps}
        />
        {hasPasswordToggle ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={({ pressed }) => [styles.passwordToggle, pressed ? styles.passwordTogglePressed : null]}
          >
            <MaterialCommunityIcons
              color={colors.mutedText}
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      {!errorText && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  helper: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputWithPasswordToggle: {
    paddingRight: 56,
  },
  inputWrapper: {
    position: 'relative',
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  passwordToggle: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 0,
    width: 48,
  },
  passwordTogglePressed: {
    opacity: 0.65,
  },
  wrapper: {
    gap: 8,
  },
});
