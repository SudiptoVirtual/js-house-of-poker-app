import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type AIPrimeButtonProps = {
  loading?: boolean;
  onPress: () => void;
};

export function AIPrimeButton({ loading = false, onPress }: AIPrimeButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Open AI Prime chat actions"
      accessibilityRole="button"
      disabled={loading}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconHalo}>
        {loading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <MaterialCommunityIcons color={colors.background} name="creation" size={15} />
        )}
      </View>
      <Text style={styles.label}>AI</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,198,108,0.16)',
    borderColor: colors.gold,
    borderRadius: 14,
    borderWidth: 1,
    gap: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconHalo: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  label: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.78,
  },
});
