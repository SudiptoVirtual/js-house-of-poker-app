import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';


import { colors } from '../../theme/colors';
export type TableTierOption = {
  id: string;
  label: string;
  maxBetClips: number;
  rulesLabel: string;
  stakesLabel: string;
};

type TableTierSelectorProps = {
  onSelectTier: (tierId: string) => void;
  options: TableTierOption[];
  selectedTierId: string;
};

export const defaultTableTierOptions: TableTierOption[] = [
  { id: '1-table', label: '$1 Table', maxBetClips: 1, stakesLabel: 'Up to 1 clip per bet', rulesLabel: '40-chip maximum for each bet, raise, or all-in action' },
  { id: '5-table', label: '$5 Table', maxBetClips: 5, stakesLabel: 'Up to 5 clips per bet', rulesLabel: '200-chip maximum for each bet, raise, or all-in action' },
  { id: '10-table', label: '$10 Table', maxBetClips: 10, stakesLabel: 'Up to 10 clips per bet', rulesLabel: '400-chip maximum for each bet, raise, or all-in action' },
  { id: '20-table', label: '$20 Table', maxBetClips: 20, stakesLabel: 'Up to 20 clips per bet', rulesLabel: '800-chip maximum for each bet, raise, or all-in action' },
  { id: '100-table', label: '$100 Table', maxBetClips: 100, stakesLabel: 'Up to 100 clips per bet', rulesLabel: 'Not fixed increments — any amount through 4,000 chips per action' },
  { id: '500-table', label: '$500 Table', maxBetClips: 500, stakesLabel: 'Up to 500 clips per bet', rulesLabel: '20,000-chip maximum for each bet, raise, or all-in action' },
  { id: '1000-table', label: '$1,000 Table', maxBetClips: 1000, stakesLabel: 'Up to 1,000 clips per bet', rulesLabel: '40,000-chip maximum for each bet, raise, or all-in action' },
  { id: '10000-table', label: '$10,000 Table', maxBetClips: 10000, stakesLabel: 'Up to 10,000 clips per bet', rulesLabel: '400,000-chip maximum for each bet, raise, or all-in action' },
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
            <View style={styles.tierTopRow}>
              <View style={[styles.tierIcon, isSelected ? styles.tierIconSelected : null]}>
                <MaterialCommunityIcons
                  color={isSelected ? colors.background : colors.gold}
                  name={option.id.includes('free') ? 'school-outline' : option.id.includes('private') ? 'shield-lock-outline' : 'poker-chip'}
                  size={18}
                />
              </View>
              {isSelected ? <MaterialCommunityIcons color={colors.success} name="check-circle" size={18} /> : null}
            </View>
            <Text style={styles.tierLabel}>{option.label}</Text>
            <View style={styles.stakesPill}>
              <MaterialCommunityIcons color={colors.secondary} name="cash-multiple" size={12} />
              <Text style={styles.stakesLabel}>{option.stakesLabel}</Text>
            </View>
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
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  stakesPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(54,231,255,0.10)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tierCard: {
    backgroundColor: '#120D2C',
    borderColor: 'rgba(255,255,255,0.10)',
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
  tierIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,201,94,0.10)',
    borderColor: 'rgba(255,201,94,0.24)',
    borderRadius: 13,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  tierIconSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  tierTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
