import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { Poker357Mode, PokerPhase, PokerRoomState } from '../../types/poker';

type Props = {
  state: PokerRoomState;
  statusText: string;
};

const ROUND_STEPS = [3, 5, 7] as const;

function formatChipAmount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }

  return value.toLocaleString('en-US');
}

function formatModeLabel(mode: Poker357Mode) {
  return mode === 'BEST_FIVE' ? 'Best Five' : 'Hostest';
}

function getRoundIndex(round: 3 | 5 | 7 | null) {
  const index = ROUND_STEPS.findIndex((value) => value === round);
  return index >= 0 ? index + 1 : 1;
}

function isActive357RoundPhase(phase: PokerPhase) {
  return (
    phase === 'deal_3' ||
    phase === 'deal_5' ||
    phase === 'deal_7' ||
    phase === 'decide_3' ||
    phase === 'decide_5' ||
    phase === 'decide_7' ||
    phase === 'reveal' ||
    phase === 'resolve' ||
    phase === 'reshuffle'
  );
}

function getPhaseInstruction(phase: PokerPhase, currentRound: 3 | 5 | 7) {
  switch (phase) {
    case 'deal_3':
    case 'deal_5':
    case 'deal_7':
      return `Dealing the ${currentRound}-card round. Get ready to choose GO or STAY.`;
    case 'decide_3':
    case 'decide_5':
    case 'decide_7':
      return `Make the best ${currentRound}-card hand using your ${currentRound} cards.`;
    case 'reveal':
      return 'Revealing GO and STAY decisions for the table.';
    case 'resolve':
      return 'Resolving GO players, payouts, penalties, and the 357 pot.';
    case 'reshuffle':
      return 'Shuffling up the next 357 cycle while the pot carries forward.';
    default:
      return `Make the best 7-card hand using your 7 cards.`;
  }
}

export const ThreeFiveSevenCenterBoard = memo(function ThreeFiveSevenCenterBoard({
  state,
  statusText,
}: Props) {
  const variantState = state.threeFiveSeven;

  if (!variantState) {
    return null;
  }

  const currentRound =
    variantState.activeRound ?? variantState.hiddenDecisionState.currentRound ?? 7;
  const wildRanks = variantState.activeWildDefinition.wildRanks;
  const wildRanksLabel = wildRanks.length > 0 ? wildRanks.join(', ') : 'No board';
  const isActive357Round = isActive357RoundPhase(state.phase);
  const roundSubtitle = `${currentRound} CARD ROUND`;
  const instruction = getPhaseInstruction(state.phase, currentRound);

  if (isActive357Round) {
    return (
      <View style={styles.wrapper}>
        <LinearGradient
          colors={['rgba(25, 11, 40, 0.97)', 'rgba(8, 7, 18, 0.99)']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.roundShell}
        >
          <Text style={styles.roundTitle}>ROUND {getRoundIndex(currentRound)} OF 3</Text>
          <Text style={styles.roundSubtitle}>{roundSubtitle}</Text>
          <Text style={styles.roundWilds}>
            {wildRanks.length > 0 ? `${wildRanksLabel.toUpperCase()} ARE WILD` : 'NO BOARD'}
          </Text>

          <View style={styles.stepRail}>
            {ROUND_STEPS.map((step, index) => {
              const active = step === currentRound;
              const reached = step <= currentRound;

              return (
                <View key={`357-step-${step}`} style={styles.stepSlot}>
                  <View
                    style={[
                      styles.stepDot,
                      reached ? styles.stepDotReached : null,
                      active ? styles.stepDotActive : null,
                    ]}
                  >
                    <Text style={styles.stepText}>{index + 1}</Text>
                  </View>
                  {index < ROUND_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                </View>
              );
            })}
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['rgba(14, 10, 28, 0.98)', 'rgba(7, 6, 16, 0.99)']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.potShell}
        >
          <Text style={styles.potLabel}>POT</Text>
          <Text style={styles.potAmount}>${formatChipAmount(state.pot)}</Text>
        </LinearGradient>

        <Text style={styles.instruction}>{instruction}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(14, 10, 28, 0.98)', 'rgba(7, 6, 16, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.potShell}
      >
        <Text style={styles.potLabel}>POT</Text>
        <Text style={styles.potAmount}>{formatChipAmount(state.pot)}</Text>
      </LinearGradient>

      <View style={styles.chipRail}>
        <View style={[styles.chipDot, styles.chipGreen]} />
        <View style={[styles.chipDot, styles.chipRed]} />
        <View style={[styles.chipDot, styles.chipGold]} />
        <View style={[styles.chipDot, styles.chipDark]} />
      </View>

      <LinearGradient
        colors={['rgba(17, 11, 32, 0.96)', 'rgba(8, 7, 18, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.messageShell}
      >
        <Text style={styles.gameTitle}>THREE FIVE SEVEN</Text>
        <Text style={styles.gameSubTitle}>
          {wildRanks.length > 0 ? `${wildRanksLabel} wild` : 'No Board'}
        </Text>
        <Text style={styles.instruction}>{instruction}</Text>
        <Text style={styles.meta}>
          {formatModeLabel(variantState.mode)} | Penalty {variantState.penaltyModel.unitToWinner}/
          {variantState.penaltyModel.unitToPot} | {statusText}
        </Text>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  chipDark: {
    backgroundColor: '#2E2D35',
  },
  chipDot: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 2,
    height: 28,
    width: 28,
  },
  chipGold: {
    backgroundColor: '#E0A72B',
  },
  chipGreen: {
    backgroundColor: '#46B756',
  },
  chipRail: {
    flexDirection: 'row',
    gap: 10,
  },
  chipRed: {
    backgroundColor: '#BF465E',
  },
  gameSubTitle: {
    color: '#FFCB6B',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  gameTitle: {
    color: '#B35CFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  instruction: {
    color: '#F7F4FF',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  messageShell: {
    borderColor: 'rgba(191, 86, 255, 0.2)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  meta: {
    color: 'rgba(206, 194, 246, 0.76)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  potAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  potLabel: {
    color: '#B35CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  potShell: {
    alignItems: 'center',
    borderColor: 'rgba(191, 86, 255, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 3,
    minWidth: 160,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  roundShell: {
    borderColor: 'rgba(255, 131, 203, 0.24)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
  },
  roundSubtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  roundTitle: {
    color: '#FF5ABF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  roundWilds: {
    color: '#C87BFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
    zIndex: 1,
  },
  stepDotActive: {
    backgroundColor: '#FF5ABF',
    borderColor: '#FFA6DA',
  },
  stepDotReached: {
    backgroundColor: 'rgba(255, 90, 191, 0.24)',
    borderColor: 'rgba(255, 166, 218, 0.54)',
  },
  stepLine: {
    backgroundColor: 'rgba(255, 166, 218, 0.26)',
    flex: 1,
    height: 2,
    marginHorizontal: -2,
  },
  stepRail: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  stepSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  stepText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  wrapper: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
});
