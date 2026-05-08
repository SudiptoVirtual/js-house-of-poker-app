import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '../theme/colors';

type AuthTextFieldProps = TextInputProps & {
  errorText?: string;
  helperText?: string;
  label: string;
};

export function AuthTextField({ errorText, helperText, label, ...inputProps }: AuthTextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedText}
        selectionColor={colors.secondary}
        style={[styles.input, errorText ? styles.inputError : null]}
        {...inputProps}
      />
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
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  wrapper: {
    gap: 8,
  },
});
