import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type SupportButtonProps = {
  isSupported: boolean;
  onPress: () => void;
};

export function SupportButton({ isSupported, onPress }: SupportButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, isSupported ? styles.buttonActive : null, pressed ? styles.pressed : null]}
    >
      <MaterialCommunityIcons
        color={isSupported ? colors.gold : colors.mutedText}
        name={isSupported ? 'cards-heart' : 'cards-heart-outline'}
        size={18}
      />
      <Text style={[styles.label, isSupported ? styles.labelActive : null]}>Support</Text>
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
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  labelActive: {
    color: colors.gold,
  },
  pressed: {
    opacity: 0.74,
  },
});
