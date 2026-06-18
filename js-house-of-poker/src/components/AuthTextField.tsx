import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

import { colors } from "../theme/colors";

type AuthTextFieldProps = TextInputProps & {
  errorText?: string;
  helperText?: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  showPasswordToggle?: boolean;
};

export function AuthTextField({
  errorText,
  helperText,
  iconName,
  label,
  onBlur,
  onFocus,
  secureTextEntry,
  showPasswordToggle = false,
  ...inputProps
}: AuthTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hasPasswordToggle = showPasswordToggle && secureTextEntry;
  const iconColor = errorText
    ? colors.danger
    : isFocused
      ? colors.secondary
      : colors.mutedText;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, isFocused ? styles.labelFocused : null]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputFrame,
          isFocused ? styles.inputFrameFocused : null,
          errorText ? styles.inputFrameError : null,
        ]}
      >
        {iconName ? (
          <MaterialCommunityIcons
            color={iconColor}
            name={iconName}
            size={21}
            style={styles.leadingIcon}
          />
        ) : null}
        <TextInput
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.mutedText}
          secureTextEntry={
            hasPasswordToggle ? !isPasswordVisible : secureTextEntry
          }
          selectionColor={colors.secondary}
          style={[
            styles.input,
            iconName ? styles.inputWithIcon : null,
            hasPasswordToggle ? styles.inputWithPasswordToggle : null,
          ]}
          {...inputProps}
        />
        {hasPasswordToggle ? (
          <Pressable
            accessibilityLabel={
              isPasswordVisible ? "Hide password" : "Show password"
            }
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={({ pressed }) => [
              styles.passwordToggle,
              pressed ? styles.passwordTogglePressed : null,
            ]}
          >
            <MaterialCommunityIcons
              color={iconColor}
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
      {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      {!errorText && helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    ...colors.typography.caption,
    color: colors.danger,
  },
  helper: {
    ...colors.typography.caption,
    color: colors.mutedText,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: colors.typography.body.fontSize,
    fontWeight: colors.typography.body.fontWeight,
    minHeight: 52,
    paddingHorizontal: colors.spacing[16],
    paddingVertical: colors.spacing[12],
  },
  inputFrame: {
    alignItems: "center",
    backgroundColor: colors.roles.inputField,
    borderColor: colors.border,
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  inputFrameError: {
    backgroundColor: "rgba(255,95,137,0.10)",
    borderColor: colors.danger,
  },
  inputFrameFocused: {
    backgroundColor: "rgba(31,22,72,0.96)",
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  inputWithIcon: {
    paddingLeft: colors.spacing[8],
  },
  inputWithPasswordToggle: {
    paddingRight: 52,
  },
  label: {
    ...colors.typography.chipLabel,
    color: colors.mutedText,
  },
  labelFocused: {
    color: colors.secondary,
  },
  leadingIcon: {
    marginLeft: colors.spacing[16],
  },
  passwordToggle: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 0,
    width: 48,
  },
  passwordTogglePressed: {
    opacity: 0.65,
  },
  wrapper: {
    gap: colors.spacing[8],
  },
});
