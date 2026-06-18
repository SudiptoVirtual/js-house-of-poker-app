import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PokerGameSettingsUpdate } from '../../services/poker';

import { colors } from '../../theme/colors';
export type TableRulesValue = Pick<PokerGameSettingsUpdate, 'lowRule' | 'mode' | 'wildCards'>;

export type TableRulesOption = {
  description: string;
  id: string;
  label: string;
  value: TableRulesValue;
};

type TableRulesSelectorProps = {
  onSelectRules: (rules: TableRulesValue) => void;
  options: TableRulesOption[];
  selectedRuleId: string;
};

export const defaultTableRulesOptions: TableRulesOption[] = [
  {
    id: 'friendly-holdem',
    label: 'Friendly Hold’em',
    description: 'Standard hold’em room rules for quick social tables.',
    value: {},
  },
  {
    id: '8-or-better',
    label: '8 or Better',
    description: 'Adds low hand qualification for split-pot practice.',
    value: { lowRule: '8-or-better' },
  },
  {
    id: '357-hostest',
    label: '3-5-7 HOSTEST',
    description: 'Host-guided 3-5-7 decisions with no wild cards.',
    value: { mode: 'HOSTEST', wildCards: [] },
  },
];

export function TableRulesSelector({ onSelectRules, options, selectedRuleId }: TableRulesSelectorProps) {
  return (
    <View style={styles.optionStack}>
      {options.map((option) => {
        const isSelected = option.id === selectedRuleId;

        return (
          <Pressable
            accessibilityRole="button"
            key={option.id}
            onPress={() => onSelectRules(option.value)}
            style={({ pressed }) => [
              styles.ruleCard,
              isSelected ? styles.ruleCardSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={[styles.ruleIcon, isSelected ? styles.ruleIconSelected : null]}>
              <MaterialCommunityIcons color={isSelected ? colors.background : colors.secondary} name="playlist-check" size={18} />
            </View>
            <View style={styles.ruleCopy}>
              <Text style={styles.ruleTitle}>{option.label}</Text>
              <Text style={styles.ruleDescription}>{option.description}</Text>
            </View>
            <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
              {isSelected ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionStack: {
    gap: 8,
  },
  pressed: {
    opacity: 0.78,
  },
  radio: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  radioDot: {
    backgroundColor: colors.success,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  radioSelected: {
    alignItems: 'center',
    borderColor: colors.success,
    justifyContent: 'center',
  },
  ruleCard: {
    alignItems: 'center',
    backgroundColor: '#120D2C',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  ruleCardSelected: {
    backgroundColor: 'rgba(43,226,140,0.08)',
    borderColor: colors.success,
  },
  ruleIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(54,231,255,0.09)',
    borderColor: 'rgba(54,231,255,0.18)',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  ruleIconSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
  },
  ruleDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  ruleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
});
