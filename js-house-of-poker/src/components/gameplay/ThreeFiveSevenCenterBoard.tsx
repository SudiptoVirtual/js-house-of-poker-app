import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type {
  Poker357Decision,
  Poker357Mode,
  PokerPhase,
  PokerRoomState,
} from '../../types/poker';

import { colors } from '../../theme/colors';
type Props = {
  revealedDecisions?: Record<string, Poker357Decision>;
  revealState?: 'hidden' | 'revealed' | 'resolved';
  showdownDescriptions?: Record<string, string>;
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

export const ThreeFiveSevenCenterBoard = memo(
  function ThreeFiveSevenCenterBoard({
    revealedDecisions = {},
    revealState = 'hidden',
    showdownDescriptions = {},
    state,
    statusText,
  }: Props) {
    const variantState = state.threeFiveSeven;
    if (!variantState) {
      return null;
    }

    const currentRound =
      variantState.activeRound ??
      variantState.hiddenDecisionState.currentRound ??
      7;
    const wildRanks = variantState.activeWildDefinition.wildRanks;
    const wildRanksLabel =
      wildRanks.length > 0 ? wildRanks.join(', ') : 'No board';
    const isActive357Round = isActive357RoundPhase(state.phase);
    const roundSubtitle = `${currentRound} CARD ROUND`;
    const instruction = getPhaseInstruction(state.phase, currentRound);
    const goPlayerIds = Object.entries(revealedDecisions)
      .filter(([, decision]) => decision === 'GO')
      .map(([playerId]) => playerId);
    const goPlayerNames = goPlayerIds
      .map(
        (playerId) =>
          state.players.find((player) => player.id === playerId)?.name,
      )
      .filter(Boolean);
    const showdownSummary = Object.entries(showdownDescriptions)
      .filter(([playerId]) => goPlayerIds.includes(playerId))
      .map(([playerId, description]) => {
        const playerName =
          state.players.find((player) => player.id === playerId)?.name ?? 'GO';
        return `${playerName}: ${description}`;
      });
    const showGoShowdown = revealState !== 'hidden' && goPlayerIds.length > 0;

    if (isActive357Round) {
      return (
        <View style={styles.wrapper}>
          <LinearGradient
            colors={[colors.surface, colors.background]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.roundShell}
          >
            <View style={styles.roundSummaryHeader}>
              <Text style={styles.roundTitle}>
                ROUND {getRoundIndex(currentRound)} OF 3
              </Text>
              <View style={styles.roundPotChip}>
                <Text style={styles.potLabel}>POT</Text>
                <Text style={[styles.potAmount, styles.roundPotAmount]}>
                  ${formatChipAmount(state.pot)}
                </Text>
              </View>
            </View>

            <View style={styles.roundSummaryMeta}>
              <Text numberOfLines={1} style={styles.roundSubtitle}>
                {roundSubtitle}
              </Text>
              <Text numberOfLines={1} style={styles.roundWilds}>
                {wildRanks.length > 0
                  ? `${wildRanksLabel.toUpperCase()} ARE WILD`
                  : 'NO BOARD'}
              </Text>
            </View>

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
                    {index < ROUND_STEPS.length - 1 ? (
                      <View style={styles.stepLine} />
                    ) : null}
                  </View>
                );
              })}
            </View>
            <Text numberOfLines={1} style={styles.instruction}>
              {instruction}
            </Text>
          </LinearGradient>


          {showGoShowdown ? (
            <LinearGradient
              colors={colors.gradients.feltTable}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.goShowdownShell}
            >
              <Text style={styles.goShowdownTitle}>GO SHOWDOWN</Text>
              <Text numberOfLines={1} style={styles.goShowdownPlayers}>
                {goPlayerNames.length > 0
                  ? goPlayerNames.join(' vs ')
                  : `${goPlayerIds.length} GO players`}
              </Text>
              {showdownSummary.length > 0 ? (
                <Text numberOfLines={2} style={styles.goShowdownDetails}>
                  {showdownSummary.join(' • ')}
                </Text>
              ) : null}
            </LinearGradient>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.wrapper}>
        <LinearGradient
          colors={[colors.surface, colors.background]}
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
          colors={[colors.surface, colors.background]}
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
            {formatModeLabel(variantState.mode)} | Penalty{' '}
            {variantState.penaltyModel.unitToWinner}/
            {variantState.penaltyModel.unitToPot} | {statusText}
          </Text>
        </LinearGradient>

        {showGoShowdown ? (
          <LinearGradient
            colors={colors.gradients.feltTable}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.goShowdownShell}
          >
            <Text style={styles.goShowdownTitle}>GO SHOWDOWN</Text>
            <Text numberOfLines={1} style={styles.goShowdownPlayers}>
              {goPlayerNames.length > 0
                ? goPlayerNames.join(' vs ')
                : `${goPlayerIds.length} GO players`}
            </Text>
            {showdownSummary.length > 0 ? (
              <Text numberOfLines={2} style={styles.goShowdownDetails}>
                {showdownSummary.join(' • ')}
              </Text>
            ) : null}
          </LinearGradient>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  chipDark: {
    backgroundColor: colors.muted,
  },
  chipDot: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 2,
    height: 19,
    width: 19,
  },
  chipGold: {
    backgroundColor: colors.gold,
  },
  chipGreen: {
    backgroundColor: colors.success,
  },
  chipRail: {
    flexDirection: 'row',
    gap: 6,
  },
  chipRed: {
    backgroundColor: colors.danger,
  },
  gameSubTitle: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  gameTitle: {
    color: colors.action,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  goShowdownDetails: {
    color: 'rgba(230, 255, 248, 0.82)',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    textAlign: 'center',
  },
  goShowdownPlayers: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  goShowdownShell: {
    alignItems: 'center',
    borderColor: colors.success,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: '100%',
  },
  goShowdownTitle: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  instruction: {
    color: colors.text,
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
  },
  messageShell: {
    borderColor: colors.glowCyan,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    width: '100%',
  },
  meta: {
    color: 'rgba(206, 194, 246, 0.76)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  potAmount: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  potLabel: {
    color: colors.action,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  potShell: {
    alignItems: 'center',
    borderColor: colors.glowCyan,
    borderRadius: 12,
    borderWidth: 1,
    gap: 1,
    minWidth: 74,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roundPotAmount: {
    fontSize: 11,
  },
  roundPotChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: colors.glowCyan,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roundShell: {
    alignSelf: 'center',
    borderColor: colors.glowGold,
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    width: '92%',
  },
  roundSummaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'space-between',
  },
  roundSummaryMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  roundSubtitle: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  roundTitle: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  roundWilds: {
    color: colors.action,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 17,
    justifyContent: 'center',
    width: 17,
    zIndex: 1,
  },
  stepDotActive: {
    backgroundColor: colors.danger,
    borderColor: colors.glowDanger,
  },
  stepDotReached: {
    backgroundColor: colors.glowDanger,
    borderColor: colors.danger,
  },
  stepLine: {
    backgroundColor: colors.glowDanger,
    flex: 1,
    height: 1,
    marginHorizontal: -2,
  },
  stepRail: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 1,
  },
  stepSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  stepText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  wrapper: {
    alignItems: 'center',
    gap: 6,
    width: '90%',
  },
});
