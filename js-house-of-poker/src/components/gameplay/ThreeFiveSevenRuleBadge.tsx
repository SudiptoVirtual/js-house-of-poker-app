import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { Poker357Mode, PokerGameMode, PokerRoomState } from '../../types/poker';

type Props = {
  state: PokerRoomState;
  wildLabel?: string | null;
};

function resolve357Mode(state: PokerRoomState): Poker357Mode {
  const settingsMode = state.gameSettings.mode;

  if (state.threeFiveSeven?.mode) {
    return state.threeFiveSeven.mode;
  }

  if (settingsMode === 'BEST_FIVE' || settingsMode === 'HOSTEST') {
    return settingsMode;
  }

  if (state.gameSettings.stips.bestFiveCards) {
    return 'BEST_FIVE';
  }

  return 'HOSTEST';
}

function getModeLabel(mode: Poker357Mode) {
  return mode === 'BEST_FIVE' ? 'BEST FIVE CARDS' : 'HOSTEST WITH THE MOSTEST';
}

function getHandLabel(mode: PokerGameMode) {
  switch (mode) {
    case 'high-low':
      return 'HIGH/LOW';
    case 'low-only':
      return 'LOW HAND ONLY';
    default:
      return 'HIGH HAND ONLY';
  }
}

export const ThreeFiveSevenRuleBadge = memo(function ThreeFiveSevenRuleBadge({
  state,
  wildLabel,
}: Props) {
  const activeMode = resolve357Mode(state);
  const ruleLabels = [getModeLabel(activeMode), getHandLabel(state.gameSettings.mode)];

  if (state.gameSettings.stips.suitedBeatsUnsuited) {
    ruleLabels.push('SUITED BEATS UNSUITED');
  }

  const resolvedWildLabel = wildLabel?.trim();

  return (
    <LinearGradient
      colors={['rgba(13, 8, 28, 0.96)', 'rgba(37, 12, 66, 0.94)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.badge}
    >
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>357 RULES</Text>
        {resolvedWildLabel ? (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            style={styles.wildLabel}
          >
            WILDS: {resolvedWildLabel.toUpperCase()}
          </Text>
        ) : null}
      </View>
      <View style={styles.ruleRow}>
        {ruleLabels.map((label) => (
          <View key={label} style={styles.rulePill}>
            <Text numberOfLines={1} style={styles.ruleText}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderColor: 'rgba(127, 235, 255, 0.42)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    maxWidth: 360,
    minWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#58D9FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  kicker: {
    color: '#7FE9FF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  rulePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ruleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  ruleText: {
    color: '#F7FCFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  wildLabel: {
    color: '#67F3BB',
    flexShrink: 1,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.35,
    textAlign: 'right',
  },
});
