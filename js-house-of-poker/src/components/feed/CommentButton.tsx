import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type CommentButtonProps = {
  disabled?: boolean;
  onPress: () => void;
};

export function CommentButton({ disabled = false, onPress }: CommentButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
      <MaterialCommunityIcons color={colors.mutedText} name="comment-text-outline" size={18} />
      <Text style={styles.label}>Comment</Text>
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
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
