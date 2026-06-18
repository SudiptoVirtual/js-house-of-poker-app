import { FontAwesome5 } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../theme/colors";

type SocialProvider = "facebook" | "google";

type SocialAuthButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  provider: SocialProvider;
};

const providerStyles: Record<
  SocialProvider,
  {
    backgroundColor: string;
    borderColor: string;
    iconColor: string;
    iconName: "facebook-f" | "google";
    label: string;
    textColor: string;
  }
> = {
  facebook: {
    backgroundColor: "#1877F2",
    borderColor: "rgba(255,255,255,0.20)",
    iconColor: colors.white,
    iconName: "facebook-f",
    label: "Continue with Facebook",
    textColor: colors.white,
  },
  google: {
    backgroundColor: colors.white,
    borderColor: "rgba(255,255,255,0.72)",
    iconColor: "#4285F4",
    iconName: "google",
    label: "Continue with Google",
    textColor: "#1F1F1F",
  },
};

export function SocialAuthButton({
  disabled = false,
  loading = false,
  onPress,
  provider,
}: SocialAuthButtonProps) {
  const providerStyle = providerStyles[provider];

  return (
    <Pressable
      accessibilityLabel={providerStyle.label}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: providerStyle.backgroundColor,
          borderColor: providerStyle.borderColor,
          opacity: disabled || loading ? 0.55 : 1,
        },
        !disabled && !loading && pressed ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={providerStyle.iconColor} size="small" />
      ) : (
        <FontAwesome5
          color={providerStyle.iconColor}
          name={providerStyle.iconName}
          size={19}
        />
      )}
      <Text style={[styles.label, { color: providerStyle.textColor }]}>
        {providerStyle.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: colors.spacing[12],
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: colors.spacing[16],
    paddingVertical: colors.spacing[12],
    width: "100%",
    ...colors.shadows.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
