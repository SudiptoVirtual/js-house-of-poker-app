import { FontAwesome5 } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

type SocialProvider = 'facebook' | 'google';

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
    iconName: 'facebook-f' | 'google';
  }
> = {
  facebook: {
    backgroundColor: 'rgba(57, 88, 165, 0.16)',
    borderColor: 'rgba(57, 88, 165, 0.45)',
    iconColor: '#8cb7ff',
    iconName: 'facebook-f',
  },
  google: {
    backgroundColor: 'rgba(255, 99, 195, 0.12)',
    borderColor: 'rgba(255, 99, 195, 0.35)',
    iconColor: '#ffd2ef',
    iconName: 'google',
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
      accessibilityLabel={provider === 'google' ? 'Continue with Google' : 'Continue with Facebook'}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: providerStyle.backgroundColor,
          borderColor: providerStyle.borderColor,
          opacity: disabled || loading ? 0.5 : 1,
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
          size={28}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
