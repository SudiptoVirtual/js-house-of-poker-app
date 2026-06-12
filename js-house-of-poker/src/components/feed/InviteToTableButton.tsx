import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';

type JoinTableButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function JoinTableButton({ disabled = false, loading = false, onPress }: JoinTableButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, disabled ? styles.disabled : null, pressed ? styles.pressed : null]}>
      {loading ? (
        <ActivityIndicator color={colors.gold} size="small" />
      ) : (
        <MaterialCommunityIcons color={colors.gold} name="login-variant" size={17} />
      )}
      <Text style={styles.label}>Join Table</Text>
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
  disabled: {
    opacity: 0.45,
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
