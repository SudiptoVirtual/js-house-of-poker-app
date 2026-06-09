import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type SupportButtonProps = {
  disabled?: boolean;
  isSupported: boolean;
  loading?: boolean;
  onPress: () => void;
  supportersCount: number;
};

export function SupportButton({ disabled = false, isSupported, loading = false, onPress, supportersCount }: SupportButtonProps) {
  const supportersLabel = supportersCount === 1 ? '1 Supporter' : `${supportersCount.toLocaleString()} Supporters`;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, isSupported ? styles.buttonActive : null, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}
    >
      {loading ? (
        <ActivityIndicator color={isSupported ? colors.gold : colors.mutedText} size="small" />
      ) : (
        <MaterialCommunityIcons
          color={isSupported ? colors.gold : colors.mutedText}
          name={isSupported ? 'cards-heart' : 'cards-heart-outline'}
          size={18}
        />
      )}
      <View style={styles.copy}>
        <Text style={[styles.label, isSupported ? styles.labelActive : null]}>Support</Text>
        <Text style={[styles.countLabel, isSupported ? styles.countLabelActive : null]}>{supportersLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: '30%',
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  buttonActive: {
    backgroundColor: 'rgba(255,201,94,0.10)',
  },
  copy: {
    alignItems: 'flex-start',
    gap: 1,
  },
  countLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: '800',
  },
  countLabelActive: {
    color: colors.gold,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  labelActive: {
    color: colors.gold,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.74,
  },
});
