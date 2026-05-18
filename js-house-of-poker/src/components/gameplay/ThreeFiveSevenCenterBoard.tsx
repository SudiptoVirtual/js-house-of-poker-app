import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type {
  Poker357Decision,
  Poker357Mode,
  Poker357Resolution,
  PokerPhase,
  PokerRoomState,
} from '../../types/poker';

type Props = {
  revealedDecisions?: Record<string, Poker357Decision>;
  revealState?: 'hidden' | 'revealed' | 'resolved';
  resultSummaryVisible?: boolean;
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

function joinNames(names: string[]) {
  if (names.length <= 1) {
    return names[0] ?? '';
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function pluralizeChip(value: number) {
  return `${formatChipAmount(value)} ${value === 1 ? 'chip' : 'chips'}`;
}

function buildResolutionKey(resolution: Poker357Resolution | null) {
  if (!resolution) {
    return null;
  }

  return [
    resolution.handNumber,
    resolution.outcome,
    resolution.winnerIds.join(','),
    resolution.loserIds.join(','),
    resolution.potBeforeResolution,
    resolution.potAfterResolution,
  ].join(':');
}

function build357ResolutionSummary(
  resolution: Poker357Resolution,
  state: PokerRoomState,
) {
  const playerName = (playerId: string) =>
    state.players.find((player) => player.id === playerId)?.name ?? 'Player';
  const winnerNames = resolution.winnerIds.map(playerName);
  const loserNames = resolution.loserIds.map(playerName);
  const winnerDescription = resolution.winnerIds
    .map((playerId) => resolution.showdownDescriptions[playerId])
    .find((description) => description && description.length > 0);
  const loserDescriptions = resolution.loserIds
    .map((playerId) => {
      const description = resolution.showdownDescriptions[playerId];

      return description ? `${playerName(playerId)} had ${description}` : null;
    })
    .filter((description): description is string => Boolean(description));
  const legGains = Object.entries(resolution.legDeltaByPlayerId)
    .filter(([, delta]) => delta > 0)
    .map(
      ([playerId, delta]) =>
        `${playerName(playerId)} gained ${delta} ${delta === 1 ? 'leg' : 'legs'}`,
    );

  const winnerLabel = joinNames(winnerNames);
  const loserLabel = joinNames(loserNames);
  const winnerHand = winnerDescription ? ` with ${winnerDescription}` : '';
  const summaryParts: string[] = [];

  if (resolution.outcome === 'no_go') {
    summaryParts.push('No GO players. Pot carries forward.');
  } else if (resolution.outcome === 'solo_go') {
    const potText = resolution.potAwarded > 0
      ? ` and collected ${pluralizeChip(resolution.potAwarded)} from pot`
      : '';
    summaryParts.push(`${winnerLabel} went GO alone${potText}.`);
  } else if (resolution.winnerIds.length > 1) {
    const splitText = resolution.winnerPenaltyTotal > 0
      ? ` split ${pluralizeChip(resolution.winnerPenaltyTotal)}`
      : ' tied';
    summaryParts.push(`${winnerLabel}${splitText}${winnerHand}.`);
  } else {
    summaryParts.push(
      `${winnerLabel} beat ${loserLabel || 'the GO field'}${winnerHand}.`,
    );
  }

  if (resolution.loserIds.length > 0) {
    const paidPrefix =
      resolution.loserIds.length === 1
        ? `${loserLabel} paid`
        : `${loserLabel} each paid`;
    const winnerTarget =
      resolution.winnerIds.length > 1 ? 'winner side' : winnerLabel || 'winner';

    summaryParts.push(
      `${paidPrefix} ${formatChipAmount(
        state.threeFiveSeven?.penaltyModel.unitToWinner ?? 0,
      )} to ${winnerTarget} and ${formatChipAmount(
        state.threeFiveSeven?.penaltyModel.unitToPot ?? 0,
      )} to pot.`,
    );
  }

  if (loserDescriptions.length > 0) {
    summaryParts.push(loserDescriptions.join('; ') + '.');
  }

  if (legGains.length > 0) {
    summaryParts.push(`${joinNames(legGains)}.`);
  }

  return summaryParts.join(' ');
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
    resultSummaryVisible = false,
    showdownDescriptions = {},
    state,
    statusText,
  }: Props) {
    const variantState = state.threeFiveSeven;
    const [dismissedResolutionKey, setDismissedResolutionKey] = useState<
      string | null
    >(null);
    const resolution = variantState?.lastResolution ?? null;
    const resolutionKey = buildResolutionKey(resolution);
    const resolutionSummary = useMemo(
      () => (resolution ? build357ResolutionSummary(resolution, state) : null),
      [resolution, state],
    );

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
    const showResolutionSummary = Boolean(
      resolution &&
        resolutionSummary &&
        resultSummaryVisible &&
        resolutionKey !== dismissedResolutionKey,
    );

    if (isActive357Round) {
      return (
        <View style={styles.wrapper}>
          <View style={styles.roundInfoRow}>
            <LinearGradient
              colors={['rgba(25, 11, 40, 0.97)', 'rgba(8, 7, 18, 0.99)']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[styles.roundShell, styles.roundShellInRow]}
            >
              <Text style={styles.roundTitle}>
                ROUND {getRoundIndex(currentRound)} OF 3
              </Text>
              <Text style={styles.roundSubtitle}>{roundSubtitle}</Text>
              <Text style={styles.roundWilds}>
                {wildRanks.length > 0
                  ? `${wildRanksLabel.toUpperCase()} ARE WILD`
                  : 'NO BOARD'}
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
                      {index < ROUND_STEPS.length - 1 ? (
                        <View style={styles.stepLine} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </LinearGradient>

            <LinearGradient
              colors={['rgba(14, 10, 28, 0.98)', 'rgba(7, 6, 16, 0.99)']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[styles.potShell, styles.potShellInRow]}
            >
              <Text style={styles.potLabel}>POT</Text>
              <Text style={styles.potAmount}>
                ${formatChipAmount(state.pot)}
              </Text>
            </LinearGradient>
          </View>

          <Text numberOfLines={1} style={styles.instruction}>
            {instruction}
          </Text>

          {showGoShowdown ? (
            <LinearGradient
              colors={['rgba(11, 84, 76, 0.98)', 'rgba(8, 24, 36, 0.99)']}
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

          {showResolutionSummary ? (
            <Pressable
              accessibilityLabel="Dismiss 357 result summary"
              accessibilityRole="button"
              onPress={() => setDismissedResolutionKey(resolutionKey)}
              style={({ pressed }) => [
                styles.resultSummaryShell,
                pressed ? styles.resultSummaryShellPressed : null,
              ]}
            >
              <Text style={styles.resultSummaryTitle}>RESULT</Text>
              <Text numberOfLines={3} style={styles.resultSummaryText}>
                {resolutionSummary}
              </Text>
              <Text style={styles.resultSummaryDismiss}>Tap to dismiss</Text>
            </Pressable>
          ) : null}
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
            {formatModeLabel(variantState.mode)} | Penalty{' '}
            {variantState.penaltyModel.unitToWinner}/
            {variantState.penaltyModel.unitToPot} | {statusText}
          </Text>
        </LinearGradient>

        {showGoShowdown ? (
          <LinearGradient
            colors={['rgba(11, 84, 76, 0.98)', 'rgba(8, 24, 36, 0.99)']}
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

        {showResolutionSummary ? (
          <Pressable
            accessibilityLabel="Dismiss 357 result summary"
            accessibilityRole="button"
            onPress={() => setDismissedResolutionKey(resolutionKey)}
            style={({ pressed }) => [
              styles.resultSummaryShell,
              pressed ? styles.resultSummaryShellPressed : null,
            ]}
          >
            <Text style={styles.resultSummaryTitle}>RESULT</Text>
            <Text numberOfLines={3} style={styles.resultSummaryText}>
              {resolutionSummary}
            </Text>
            <Text style={styles.resultSummaryDismiss}>Tap to dismiss</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  chipDark: {
    backgroundColor: '#2E2D35',
  },
  chipDot: {
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  chipGold: {
    backgroundColor: '#E0A72B',
  },
  chipGreen: {
    backgroundColor: '#46B756',
  },
  chipRail: {
    flexDirection: 'row',
    gap: 8,
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
  goShowdownDetails: {
    color: 'rgba(230, 255, 248, 0.82)',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
    textAlign: 'center',
  },
  goShowdownPlayers: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  goShowdownShell: {
    alignItems: 'center',
    borderColor: 'rgba(77, 255, 214, 0.42)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: '100%',
  },
  goShowdownTitle: {
    color: '#4DFFD6',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  instruction: {
    color: '#F7F4FF',
    fontSize: 10,
    lineHeight: 13,
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
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  potLabel: {
    color: '#B35CFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  potShell: {
    alignItems: 'center',
    borderColor: 'rgba(191, 86, 255, 0.24)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 1,
    minWidth: 82,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  potShellInRow: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 74,
  },

  resultSummaryDismiss: {
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resultSummaryShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 18, 48, 0.94)',
    borderColor: 'rgba(255, 203, 107, 0.44)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: '100%',
  },
  resultSummaryShellPressed: {
    opacity: 0.72,
  },
  resultSummaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
    textAlign: 'center',
  },
  resultSummaryTitle: {
    color: '#FFCB6B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  roundInfoRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    width: '100%',
  },
  roundShell: {
    borderColor: 'rgba(255, 131, 203, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
  },
  roundShellInRow: {
    flex: 1,
    minWidth: 0,
    width: undefined,
  },
  roundSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  roundTitle: {
    color: '#FF5ABF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  roundWilds: {
    color: '#C87BFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
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
    height: 1,
    marginHorizontal: -2,
  },
  stepRail: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 2,
  },
  stepSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  stepText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  wrapper: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
});
