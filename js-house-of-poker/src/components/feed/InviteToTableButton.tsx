import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type InviteToTableButtonProps = {
  onPress: () => void;
};

export function InviteToTableButton({ onPress }: InviteToTableButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}>
      <MaterialCommunityIcons color={colors.gold} name="account-plus-outline" size={17} />
      <Text style={styles.label}>Invite to Table</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,201,94,0.10)',
    borderColor: 'rgba(255,201,94,0.32)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
