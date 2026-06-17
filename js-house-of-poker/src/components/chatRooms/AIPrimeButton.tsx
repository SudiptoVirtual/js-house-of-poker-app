import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type AIPrimeButtonProps = {
  compact?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function AIPrimeButton({ compact = false, loading = false, onPress }: AIPrimeButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Open AI Prime chat actions"
      accessibilityRole="button"
      disabled={loading}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, compact ? styles.compactButton : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconHalo, compact ? styles.compactIconHalo : null]}>
        {loading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <MaterialCommunityIcons color={colors.background} name="creation" size={compact ? 13 : 15} />
        )}
      </View>
      <Text style={[styles.label, compact ? styles.compactLabel : null]}>AI</Text>
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
  compactButton: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  compactIconHalo: {
    height: 16,
    width: 16,
  },
  compactLabel: {
    fontSize: 7,
    letterSpacing: 0,
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
