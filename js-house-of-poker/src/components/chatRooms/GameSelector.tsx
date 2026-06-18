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
            <View style={[styles.optionIcon, isSelected ? styles.optionIconSelected : null]}>
              <MaterialCommunityIcons
                color={isSelected ? colors.background : colors.secondary}
                name={option.id === '3-5-7' ? 'cards-outline' : 'cards-playing-outline'}
                size={20}
              />
            </View>
            <View style={styles.optionCopy}>
              <View style={styles.optionTitleRow}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.formatBadge}>{option.id === '3-5-7' ? 'Training' : 'Classic'}</Text>
              </View>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
            {isSelected ? <MaterialCommunityIcons color={colors.success} name="check-decagram" size={22} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionCard: {
    alignItems: 'center',
    backgroundColor: '#120D2C',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255,201,94,0.08)',
    borderColor: colors.gold,
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
    backgroundColor: 'rgba(54,231,255,0.09)',
    borderColor: 'rgba(54,231,255,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  formatBadge: {
    backgroundColor: 'rgba(255,201,94,0.12)',
    borderRadius: 999,
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  optionIconSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  optionStack: {
    gap: 8,
  },
  optionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
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
