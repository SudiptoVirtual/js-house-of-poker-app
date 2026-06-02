import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export type TableTierOption = {
  id: string;
  label: string;
  rulesLabel: string;
  stakesLabel: string;
};

type TableTierSelectorProps = {
  onSelectTier: (tierId: string) => void;
  options: TableTierOption[];
  selectedTierId: string;
};

export const defaultTableTierOptions: TableTierOption[] = [
  {
    id: 'free-training',
    label: 'Free training',
    stakesLabel: 'No-stakes practice',
    rulesLabel: 'Visible table code and friendly pacing',
  },
  {
    id: '5k-casual',
    label: '5K casual',
    stakesLabel: '5K play-chip buy-in',
    rulesLabel: 'Standard blinds with room invite access',
  },
  {
    id: 'private-study',
    label: 'Private study',
    stakesLabel: 'Free-play invite table',
    rulesLabel: 'Host controls seats and launch timing',
  },
];

export function TableTierSelector({ onSelectTier, options, selectedTierId }: TableTierSelectorProps) {
  return (
    <View style={styles.tierGrid}>
      {options.map((option) => {
        const isSelected = option.id === selectedTierId;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelectTier(option.id)}
            style={({ pressed }) => [
              styles.tierCard,
              isSelected ? styles.tierCardSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.tierLabel}>{option.label}</Text>
            <Text style={styles.stakesLabel}>{option.stakesLabel}</Text>
            <Text style={styles.rulesLabel}>{option.rulesLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.78,
  },
  rulesLabel: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
  stakesLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  tierCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    gap: 5,
    minWidth: '46%',
    padding: 12,
  },
  tierCardSelected: {
    backgroundColor: 'rgba(54,231,255,0.12)',
    borderColor: colors.secondary,
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
