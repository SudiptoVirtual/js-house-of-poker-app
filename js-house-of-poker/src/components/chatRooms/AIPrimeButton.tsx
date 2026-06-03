import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type AIPrimeButtonProps = {
  onPress: () => void;
};

export function AIPrimeButton({ onPress }: AIPrimeButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Open AI Prime chat actions"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconHalo}>
        <MaterialCommunityIcons color={colors.background} name="creation" size={17} />
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
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconHalo: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  label: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.78,
  },
});
