import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';


import { colors } from '../../theme/colors';
export type GameSelectorOption = {
  description: string;
  id: string;
  label: string;
};

type GameSelectorProps = {
  onSelectGame: (gameId: string) => void;
  options: GameSelectorOption[];
  selectedGameId: string;
};

export const defaultGameOptions: GameSelectorOption[] = [
  {
    id: '3-5-7',
    label: '3-5-7',
    description: 'Training-table flow for three, five, and seven-card decisions.',
  },
  {
    id: 'texas-holdem',
    label: "Texas Hold'em",
    description: 'Classic hold’em table setup for casual room play.',
  },
];

export function GameSelector({ onSelectGame, options, selectedGameId }: GameSelectorProps) {
  return (
    <View style={styles.optionStack}>
      {options.map((option) => {
        const isSelected = option.id === selectedGameId;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelectGame(option.id)}
            style={({ pressed }) => [
              styles.optionCard,
              isSelected ? styles.optionCardSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.optionIcon}>
              <MaterialCommunityIcons
                color={isSelected ? colors.background : colors.secondary}
                name={option.id === '3-5-7' ? 'cards-outline' : 'cards-playing-outline'}
                size={20}
              />
            </View>
            <View style={styles.optionCopy}>
              <Text style={styles.optionTitle}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            {isSelected ? <MaterialCommunityIcons color={colors.success} name="check-circle" size={20} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  optionCardSelected: {
    borderColor: colors.success,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  optionStack: {
    gap: 8,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
