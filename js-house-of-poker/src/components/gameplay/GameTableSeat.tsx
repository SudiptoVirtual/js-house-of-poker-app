import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type {
  Poker357Decision,
  PokerGame,
  PokerPhase,
  PokerPlayerState,
} from '../../types/poker';
import {
  getPlayerStatusLabel,
  getPlayerStatusTier,
  type SeatAlignment,
} from '../../utils/pokerTable';
import { AnimatedCard } from '../AnimatedCard';
import { DealerButton } from '../DealerButton';
import { PlayerAvatar } from '../PlayerAvatar';
import { PlayerStatusBadge } from '../player/PlayerStatusBadge';
import { TurnIndicator } from '../TurnIndicator';

type Props = {
  align?: SeatAlignment;
  anteAmount?: number;
  decision?: Poker357Decision | null;
  displayCardCount?: number;
  game: PokerGame;
  isBottomSeat?: boolean;
  isSelf?: boolean;
  isWinner?: boolean;
  phase: PokerPhase;
  player: PokerPlayerState;
  showDecisionMode?: boolean;
};

const MAX_LEG_SLOTS = 4;

function formatChipAmount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }

  return value.toLocaleString('en-US');
}

function resolveCardCount(player: PokerPlayerState, displayCardCount?: number) {
  return Math.max(displayCardCount ?? 0, player.cardCount, player.holeCards.length);
}

function shouldRevealCards(
  player: PokerPlayerState,
  phase: PokerPhase,
  isSelf: boolean,
  isWinner: boolean,
) {
  if (isSelf) {
    return true;
  }

  if (isWinner) {
    return true;
  }

  return phase === 'showdown' || phase === 'completed' || phase === 'reveal' || phase === 'resolve';
}

function getStatusRibbon(isWinner: boolean) {
  if (!isWinner) {
    return null;
  }

  return {
    color: '#FFF5D8',
    icon: 'crown',
    label: 'Winner',
    ring: '#FFCB6B',
    tone: '#5E3606',
  };
}

function getActionBadge(
  decision: Poker357Decision | null,
  player: PokerPlayerState,
  phase: PokerPhase,
  isWinner: boolean,
) {
  if (isWinner) {
    return {
      backgroundColor: '#4E2E05',
      borderColor: '#FFCB6B',
      color: '#FFF1D1',
      label: 'WIN',
    };
  }

  if (decision === 'GO') {
    return {
      backgroundColor: 'rgba(17, 104, 94, 0.9)',
      borderColor: '#4DFFD6',
      color: '#E6FFF8',
      label: 'GO',
    };
  }

  if (decision === 'STAY') {
    return {
      backgroundColor: 'rgba(71, 35, 70, 0.9)',
      borderColor: '#FF90D2',
      color: '#FFF0FA',
      label: 'STAY',
    };
  }

  if (player.isAllIn) {
    return {
      backgroundColor: 'rgba(131, 80, 14, 0.94)',
      borderColor: '#FFC66C',
      color: '#FFF4DD',
      label: 'ALL-IN',
    };
  }

  if (player.hasFolded) {
    return {
      backgroundColor: 'rgba(52, 52, 60, 0.94)',
      borderColor: 'rgba(190, 190, 208, 0.4)',
      color: '#EEF0FF',
      label: 'FOLD',
    };
  }

  if (!player.isConnected) {
    return {
      backgroundColor: 'rgba(38, 46, 59, 0.94)',
      borderColor: 'rgba(141, 157, 180, 0.4)',
      color: '#EEF4FF',
      label: 'AWAY',
    };
  }

  if (player.isTurn) {
    return {
      backgroundColor: 'rgba(7, 84, 130, 0.92)',
      borderColor: '#5EEDFF',
      color: '#E9FEFF',
      label: 'TURN',
    };
  }

  return {
    backgroundColor: 'rgba(21, 21, 29, 0.94)',
    borderColor: 'rgba(171, 109, 255, 0.36)',
    color: '#EDE7FF',
    label: getPlayerStatusLabel(player, phase, isWinner).toUpperCase(),
  };
}

function getShellGradient(
  isBottomSeat: boolean,
  showDecisionMode: boolean,
  isWinner: boolean,
) {
  if (isWinner) {
    return ['rgba(72, 42, 8, 0.98)', 'rgba(17, 10, 4, 0.99)'] as const;
  }

  if (showDecisionMode) {
    return ['rgba(28, 12, 42, 0.96)', 'rgba(7, 6, 17, 0.98)'] as const;
  }

  if (isBottomSeat) {
    return ['rgba(25, 10, 38, 0.97)', 'rgba(8, 7, 18, 0.99)'] as const;
  }

  return ['rgba(18, 10, 30, 0.95)', 'rgba(6, 5, 14, 0.98)'] as const;
}

function CardFan({
  count,
  cards,
  hidden,
  compact = false,
  size,
}: {
  cards: string[];
  compact?: boolean;
  count: number;
  hidden: boolean;
  size: 'md' | 'sm';
}) {
  const overlap = compact ? 27 : size === 'md' ? 24 : 18;
  const angleSpread = compact ? 8 : size === 'md' ? 14 : 10;
  const cardScale = compact ? 0.74 : 1;
  const slots = Array.from({ length: count });

  return (
    <View style={styles.cardFan}>
      {slots.map((_, index) => {
        const card = cards[index];
        const rotate = (index - (count - 1) / 2) * angleSpread;
        const translateY = Math.abs(index - (count - 1) / 2) * (size === 'md' ? 1.8 : 1.2);

        return (
          <View
            key={`fan-${index}`}
            style={[
              styles.cardFanSlot,
              index > 0 ? { marginLeft: -overlap } : null,
              compact ? styles.cardFanSlotCompact : null,
              { transform: [{ rotate: `${rotate}deg` }, { translateY }, { scale: cardScale }] },
            ]}
          >
            <AnimatedCard
              animateOnMount="none"
              card={card}
              hidden={hidden || !card}
              size={size}
              style={compact ? styles.compactFanCard : null}
            />
          </View>
        );
      })}
    </View>
  );
}

function LegsTrack({ legs }: { legs: number }) {
  return (
    <View style={styles.legsShell}>
      <Text style={styles.legsLabel}>LEGS</Text>
      <View style={styles.legsRow}>
        {Array.from({ length: MAX_LEG_SLOTS }).map((_, index) => {
          const filled = index < Math.min(legs, MAX_LEG_SLOTS);

          return (
            <View
              key={`leg-${index}`}
              style={[styles.legOrb, filled ? styles.legOrbFilled : null]}
            >
              {filled ? <View style={styles.legOrbCore} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CompactLegsTrack({ legs }: { legs: number }) {
  return (
    <View style={styles.compactLegsRow}>
      {Array.from({ length: MAX_LEG_SLOTS }).map((_, index) => (
        <View
          key={`compact-leg-${index}`}
          style={[styles.compactLegDot, index < legs ? styles.compactLegDotFilled : null]}
        />
      ))}
    </View>
  );
}

export const GameTableSeat = memo(function GameTableSeat({
  align = 'center',
  anteAmount = 0,
  decision = null,
  displayCardCount,
  game,
  isBottomSeat = false,
  isSelf = false,
  isWinner = false,
  phase,
  player,
  showDecisionMode = false,
}: Props) {
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 0.55 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 0.7 : 0)).current;
  const folded = useRef(new Animated.Value(player.hasFolded || decision === 'STAY' ? 0.82 : 1)).current;
  const cardCount = resolveCardCount(player, displayCardCount);
  const revealCards = shouldRevealCards(player, phase, isSelf, isWinner);
  const cardsHidden = !revealCards && cardCount > 0;
  const actionBadge = getActionBadge(decision, player, phase, isWinner);
  const statusRibbon = getStatusRibbon(isWinner);
  const statusTier = getPlayerStatusTier(player.playerStatus);
  const labelAmount =
    player.betThisRound > 0
      ? player.betThisRound
      : player.totalContribution > 0
        ? player.totalContribution
        : anteAmount;
  const wrapperAlignment =
    align === 'left'
      ? styles.alignLeft
      : align === 'right'
        ? styles.alignRight
        : styles.alignCenter;
  const seatSize = isBottomSeat ? 'md' : 'sm';
  const useCompactDecisionSeat = showDecisionMode && !isSelf;
  const playerName = player.name;
  const selfTag = isSelf ? 'YOU' : null;
  const showQuestionBadge = showDecisionMode && !revealCards && !isSelf && !decision;

  const sideLayout = useMemo(() => {
    if (isBottomSeat) {
      return styles.centerCluster;
    }

    return align === 'right' ? styles.rightCluster : styles.leftCluster;
  }, [align, isBottomSeat]);

  useEffect(() => {
    Animated.timing(folded, {
      duration: 220,
      toValue: player.hasFolded || decision === 'STAY' ? 0.72 : 1,
      useNativeDriver: true,
    }).start();
  }, [decision, folded, player.hasFolded]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (player.isTurn) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(turnGlow, {
            duration: 820,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(turnGlow, {
            duration: 820,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.28,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      Animated.timing(turnGlow, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }

    return () => loop?.stop();
  }, [player.isTurn, turnGlow]);

  useEffect(() => {
    Animated.timing(winnerGlow, {
      duration: 240,
      toValue: isWinner ? 0.82 : 0,
      useNativeDriver: true,
    }).start();
  }, [isWinner, winnerGlow]);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        wrapperAlignment,
        {
          opacity: folded,
          transform: [
            {
              scale: folded.interpolate({
                inputRange: [0.72, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.turnGlow, { opacity: turnGlow }]} />
      <Animated.View pointerEvents="none" style={[styles.winnerGlow, { opacity: winnerGlow }]} />

      {statusRibbon && !showDecisionMode ? (
        <View
          style={[
            styles.statusRibbon,
            {
              backgroundColor: statusRibbon.tone,
              borderColor: statusRibbon.ring,
            },
          ]}
        >
          <MaterialCommunityIcons color={statusRibbon.color} name={statusRibbon.icon as any} size={12} />
          <Text numberOfLines={1} style={[styles.statusRibbonText, { color: statusRibbon.color }]}>
            {statusRibbon.label}
          </Text>
        </View>
      ) : null}

      {player.isTurn ? <TurnIndicator active style={styles.turnIndicator} /> : null}

      <LinearGradient
        colors={getShellGradient(isBottomSeat, showDecisionMode, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.shell,
          showDecisionMode ? styles.shellDecision : styles.shellLive,
          isBottomSeat ? styles.shellBottom : null,
        ]}
      >
        <View style={styles.shellBorder} />

        {!useCompactDecisionSeat && (showDecisionMode || isBottomSeat) ? (
          <View style={styles.nameRail}>
            <Text numberOfLines={1} style={styles.playerName}>
              {playerName}
            </Text>
            {selfTag ? (
              <View style={styles.selfTag}>
                <Text style={styles.selfTagText}>{selfTag}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {useCompactDecisionSeat ? (
          <View style={[styles.compactDecisionSeat, align === 'right' ? styles.compactDecisionSeatRight : null]}>
            <View style={[styles.compactIdentityRow, align === 'right' ? styles.compactIdentityRowRight : null]}>
              <View style={styles.avatarWrap}>
                <PlayerAvatar
                  connected={player.isConnected}
                  name={player.name}
                  seed={player.id}
                  size="sm"
                  status={player.playerStatus}
                />
                {player.isDealer ? <DealerButton compact style={styles.compactDealerButton} /> : null}
              </View>
              <View style={[styles.compactNameStack, align === 'right' ? styles.compactNameStackRight : null]}>
                <Text numberOfLines={1} style={styles.compactName}>
                  {player.name}
                </Text>
                <Text numberOfLines={1} style={styles.compactStackText}>
                  {formatChipAmount(player.chips)}
                </Text>
              </View>
              {cardCount > 0 ? (
                <View style={styles.compactFanWrap}>
                  <CardFan
                    cards={player.holeCards}
                    compact
                    count={cardCount}
                    hidden={cardsHidden}
                    size="sm"
                  />
                  {showQuestionBadge ? (
                    <View style={[styles.compactQuestionBadge, align === 'right' ? styles.compactQuestionBadgeLeft : null]}>
                      <MaterialCommunityIcons color="#F6F2FF" name="help" size={12} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={[styles.compactDecisionRail, align === 'right' ? styles.compactDecisionRailRight : null]}>
              <CompactLegsTrack legs={player.legs} />
              <View style={styles.compactAmountBubble}>
                <Text style={styles.compactAmountBubbleText}>${formatChipAmount(labelAmount)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.cluster, sideLayout]}>
            {isBottomSeat ? (
              <>
                {cardCount > 0 ? (
                  <CardFan
                    cards={player.holeCards}
                    count={cardCount}
                    hidden={cardsHidden}
                    size="md"
                  />
                ) : null}
                <View style={styles.bottomIdentityWrap}>
                  <PlayerStatusBadge statusTier={statusTier} />
                  <View style={styles.avatarWrap}>
                    <PlayerAvatar
                      connected={player.isConnected}
                      name={player.name}
                      seed={player.id}
                      size="md"
                    />
                    {player.isDealer ? <DealerButton compact style={styles.dealerButton} /> : null}
                  </View>
                  {!showDecisionMode ? (
                    <View style={styles.stackPlate}>
                      <Text numberOfLines={1} style={styles.stackText}>
                        {formatChipAmount(player.chips)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                {align === 'right' && cardCount > 0 ? (
                  <CardFan
                    cards={player.holeCards}
                    count={cardCount}
                    hidden={cardsHidden}
                    size="sm"
                  />
                ) : null}

                <View style={styles.sideIdentityWrap}>
                  <PlayerStatusBadge compact showLabel={false} statusTier={statusTier} />
                  <View style={styles.avatarWrap}>
                    <PlayerAvatar
                      connected={player.isConnected}
                      name={player.name}
                      seed={player.id}
                      size="md"
                    />
                    {player.isDealer ? <DealerButton compact style={styles.dealerButton} /> : null}
                  </View>

                  {!showDecisionMode ? (
                    <View style={styles.nameBox}>
                      <Text numberOfLines={1} style={styles.nameBoxName}>
                        {player.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.nameBoxStack}>
                        {formatChipAmount(player.chips)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {align !== 'right' && cardCount > 0 ? (
                  <CardFan
                    cards={player.holeCards}
                    count={cardCount}
                    hidden={cardsHidden}
                    size="sm"
                  />
                ) : null}
              </>
            )}
          </View>
        )}

        {useCompactDecisionSeat ? null : showDecisionMode ? (
          <View style={styles.decisionRail}>
            <LegsTrack legs={player.legs} />
            <View style={styles.amountBubble}>
              <Text style={styles.amountBubbleText}>${formatChipAmount(labelAmount)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.liveFooter}>
            <View
              style={[
                styles.actionBadge,
                {
                  backgroundColor: actionBadge.backgroundColor,
                  borderColor: actionBadge.borderColor,
                },
              ]}
            >
              <Text style={[styles.actionBadgeText, { color: actionBadge.color }]}>
                {actionBadge.label}
              </Text>
            </View>

            {game === '357' ? (
              <View style={styles.legsInline}>
                {Array.from({ length: MAX_LEG_SLOTS }).map((_, index) => (
                  <View
                    key={`inline-leg-${index}`}
                    style={[styles.inlineLegDot, index < player.legs ? styles.inlineLegDotFilled : null]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}

        {showQuestionBadge && !useCompactDecisionSeat ? (
          <View style={[styles.questionBadge, align === 'right' ? styles.questionBadgeLeft : null]}>
            <MaterialCommunityIcons color="#F6F2FF" name="help" size={14} />
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  actionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  alignCenter: {
    alignItems: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  amountBubble: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 10, 16, 0.96)',
    borderColor: 'rgba(255, 139, 210, 0.32)',
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  amountBubbleText: {
    color: '#FFF6FB',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarWrap: {
    position: 'relative',
  },
  bottomIdentityWrap: {
    alignItems: 'center',
    gap: 8,
  },
  cardFan: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cardFanSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFanSlotCompact: {
    height: 45,
    width: 36,
  },
  centerCluster: {
    alignItems: 'center',
  },
  cluster: {
    gap: 8,
    minHeight: 72,
  },
  compactAmountBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 16, 0.88)',
    borderColor: 'rgba(255, 139, 210, 0.28)',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 46,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  compactAmountBubbleText: {
    color: '#FFF6FB',
    fontSize: 10,
    fontWeight: '900',
  },
  compactDealerButton: {
    position: 'absolute',
    right: -7,
    top: -9,
  },
  compactDecisionRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-start',
  },
  compactDecisionRailRight: {
    justifyContent: 'flex-end',
  },
  compactDecisionSeat: {
    gap: 5,
    minHeight: 72,
  },
  compactDecisionSeatRight: {
    alignItems: 'flex-end',
  },
  compactFanCard: {
    shadowOpacity: 0.12,
  },
  compactFanWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 1,
    position: 'relative',
  },
  compactIdentityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'flex-start',
  },
  compactIdentityRowRight: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
  },
  compactLegDot: {
    backgroundColor: 'rgba(255, 118, 190, 0.16)',
    borderColor: 'rgba(255, 118, 190, 0.35)',
    borderRadius: 999,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  compactLegDotFilled: {
    backgroundColor: '#FF70B7',
    borderColor: '#FFC7E5',
  },
  compactLegsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  compactName: {
    color: '#F7F4FF',
    fontSize: 10,
    fontWeight: '800',
    maxWidth: 58,
  },
  compactNameStack: {
    alignItems: 'flex-start',
    maxWidth: 62,
  },
  compactNameStackRight: {
    alignItems: 'flex-end',
  },
  compactQuestionBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 15, 30, 0.98)',
    borderColor: 'rgba(255, 131, 203, 0.36)',
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    top: 2,
    width: 24,
  },
  compactQuestionBadgeLeft: {
    left: -3,
    right: undefined,
  },
  compactStackText: {
    color: 'rgba(244, 241, 255, 0.78)',
    fontSize: 10,
    fontWeight: '800',
  },
  decisionRail: {
    alignItems: 'center',
    gap: 6,
  },
  dealerButton: {
    position: 'absolute',
    right: -6,
    top: -8,
  },
  inlineLegDot: {
    backgroundColor: 'rgba(255, 118, 190, 0.18)',
    borderColor: 'rgba(255, 118, 190, 0.38)',
    borderRadius: 999,
    borderWidth: 1,
    height: 10,
    width: 10,
  },
  inlineLegDotFilled: {
    backgroundColor: '#FF70B7',
    borderColor: '#FFC7E5',
  },
  legsInline: {
    flexDirection: 'row',
    gap: 5,
  },
  legOrb: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255, 118, 190, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  legOrbCore: {
    backgroundColor: '#FFF5FA',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  legOrbFilled: {
    backgroundColor: '#FF70B7',
    borderColor: '#FFC7E5',
  },
  legsLabel: {
    color: '#FF8CD2',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  legsShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 9, 21, 0.96)',
    borderColor: 'rgba(255, 118, 190, 0.22)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  leftCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  liveFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 8, 14, 0.96)',
    borderColor: 'rgba(196, 119, 255, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  nameBoxName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  nameBoxStack: {
    color: '#F4F1FF',
    fontSize: 12,
    fontWeight: '800',
  },
  nameRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 16,
  },
  playerName: {
    color: '#F7F4FF',
    fontSize: 12,
    fontWeight: '700',
  },
  questionBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 15, 30, 0.98)',
    borderColor: 'rgba(255, 131, 203, 0.26)',
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: -8,
    top: 28,
    width: 32,
  },
  questionBadgeLeft: {
    left: -8,
    right: undefined,
  },
  rightCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  selfTag: {
    backgroundColor: 'rgba(103, 237, 255, 0.18)',
    borderColor: 'rgba(103, 237, 255, 0.4)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selfTagText: {
    color: '#C9FCFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  shell: {
    borderRadius: 18,
    gap: 8,
    minWidth: 0,
    overflow: 'visible',
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  shellBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(209, 110, 255, 0.22)',
    borderRadius: 18,
    borderWidth: 1,
  },
  shellBottom: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  shellDecision: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  shellLive: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  sideIdentityWrap: {
    alignItems: 'center',
    gap: 7,
  },
  stackPlate: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 8, 14, 0.96)',
    borderColor: 'rgba(196, 119, 255, 0.24)',
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stackText: {
    color: '#F4F1FF',
    fontSize: 14,
    fontWeight: '800',
  },
  statusRibbon: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusRibbonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  turnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(97, 234, 255, 0.1)',
    borderColor: 'rgba(97, 234, 255, 0.2)',
    borderRadius: 18,
    borderWidth: 1,
  },
  turnIndicator: {
    left: 10,
    position: 'absolute',
    top: -12,
    zIndex: 6,
  },
  winnerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 198, 108, 0.16)',
    borderRadius: 18,
  },
  wrapper: {
    position: 'relative',
    width: '100%',
  },
});
