import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerPhase, PokerPlayerState } from '../types/poker';
import {
  formatPlayerBadges,
  getPlayerStatusLabel,
  type SeatAlignment,
} from '../utils/pokerTable';
import { AnimatedCard } from './AnimatedCard';
import { AnimatedChipStack } from './AnimatedChipStack';
import { DealerButton } from './DealerButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TurnIndicator } from './TurnIndicator';

type PlayerSeatProps = {
  align?: SeatAlignment;
  dealtCardCount: number;
  isBottomSeat?: boolean;
  isSelf?: boolean;
  isWinner?: boolean;
  phase: PokerPhase;
  player: PokerPlayerState;
  revealCards?: boolean;
};

function getStatusTone(player: PokerPlayerState, isWinner: boolean) {
  if (isWinner) {
    return {
      backgroundColor: 'rgba(244,208,120,0.16)',
      borderColor: 'rgba(244,208,120,0.34)',
      color: '#FFF3D1',
    };
  }

  if (player.hasFolded) {
    return {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderColor: 'rgba(255,255,255,0.1)',
      color: 'rgba(240,247,244,0.7)',
    };
  }

  if (player.isAllIn) {
    return {
      backgroundColor: 'rgba(255,121,66,0.18)',
      borderColor: 'rgba(255,121,66,0.34)',
      color: '#FFE7D8',
    };
  }

  if (player.isTurn) {
    return {
      backgroundColor: 'rgba(68,241,202,0.16)',
      borderColor: 'rgba(68,241,202,0.34)',
      color: '#E5FFF9',
    };
  }

  return {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(135,118,255,0.32)',
    color: '#EDF8F4',
  };
}

function getSurfaceColors(isBottomSeat: boolean, isSelf: boolean, isWinner: boolean) {
  if (isWinner) {
    return ['rgba(87,58,25,0.97)', 'rgba(34,22,12,0.99)'] as const;
  }

  if (isSelf) {
    return ['rgba(22,42,61,0.97)', 'rgba(8,20,33,0.99)'] as const;
  }

  if (isBottomSeat) {
    return ['rgba(27,35,52,0.96)', 'rgba(12,14,28,0.99)'] as const;
  }

  return ['rgba(31,30,40,0.95)', 'rgba(14,14,22,0.99)'] as const;
}

export const PlayerSeat = memo(function PlayerSeat({
  align = 'center',
  dealtCardCount,
  isBottomSeat = false,
  isSelf = false,
  isWinner = false,
  phase,
  player,
  revealCards = false,
}: PlayerSeatProps) {
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 1 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 1 : 0)).current;
  const folded = useRef(new Animated.Value(player.hasFolded ? 1 : 0)).current;
  const statusTone = getStatusTone(player, isWinner);
  const badges = formatPlayerBadges(player);
  const statusLabel = getPlayerStatusLabel(player, phase, isWinner);
  const cards = useMemo(
    () => Array.from({ length: Math.max(0, dealtCardCount) }),
    [dealtCardCount],
  );

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (player.isTurn) {
      turnGlow.setValue(0.45);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(turnGlow, {
            duration: 780,
            easing: Easing.out(Easing.quad),
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
    Animated.timing(folded, {
      duration: 220,
      toValue: player.hasFolded ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [folded, player.hasFolded]);

  useEffect(() => {
    Animated.timing(winnerGlow, {
      duration: 240,
      toValue: isWinner ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [isWinner, winnerGlow]);

  const wrapperAlignment =
    align === 'left'
      ? styles.alignLeft
      : align === 'right'
        ? styles.alignRight
        : styles.alignCenter;
  const cardSize = isBottomSeat ? 'lg' : 'sm';
  const contributionText =
    player.betThisRound > 0
      ? `Bet ${player.betThisRound}`
      : player.totalContribution > 0
        ? `Pot ${player.totalContribution}`
        : player.isConnected
          ? 'Waiting'
          : 'Away';

  return (
    <Animated.View
      style={[
        styles.wrapper,
        wrapperAlignment,
        {
          opacity: folded.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.46],
          }),
          transform: [
            {
              scale: folded.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.97],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.turnGlow,
          {
            opacity: turnGlow,
            transform: [
              {
                scale: turnGlow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1.03],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.winnerGlow,
          {
            opacity: winnerGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.92],
            }),
          },
        ]}
      />

      {player.isTurn ? (
        <TurnIndicator active style={isBottomSeat ? styles.heroTurn : styles.turnIndicator} />
      ) : null}

      <LinearGradient
        colors={getSurfaceColors(isBottomSeat, isSelf, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.surface,
          isBottomSeat ? styles.surfaceHero : styles.surfaceCompact,
          isSelf ? styles.surfaceSelf : null,
          isWinner ? styles.surfaceWinner : null,
        ]}
      >
        <View style={styles.innerBorder} />
        {player.isDealer ? (
          <DealerButton compact style={isBottomSeat ? styles.heroDealer : styles.dealerButton} />
        ) : null}

        <View style={styles.header}>
          <View style={styles.identity}>
            <PlayerAvatar
              connected={player.isConnected}
              name={player.name}
              seed={player.id}
              size={isBottomSeat ? 'md' : 'sm'}
              status={player.playerStatus}
            />

            <View style={styles.nameBlock}>
              <Text numberOfLines={1} style={styles.name}>
                {player.name}
                {isSelf ? '  YOU' : ''}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {badges || (player.isConnected ? 'Seat ready' : 'Disconnected')}
              </Text>
            </View>
          </View>

          <AnimatedChipStack
            amount={player.chips}
            highlighted={isWinner || player.isTurn}
            size={isBottomSeat ? 'md' : 'sm'}
            tone="stack"
          />
        </View>

        {cards.length > 0 ? (
          <View
            style={[
              styles.cardsRow,
              isBottomSeat ? styles.cardsRowHero : styles.cardsRowCompact,
            ]}
          >
            {cards.map((_, index) => {
              const actualCard = player.holeCards[index];
              const showFace = Boolean(actualCard) && (isSelf || revealCards);

              return (
                <View
                  key={`${player.id}-${index}-${actualCard ?? 'hidden'}`}
                  style={!isBottomSeat && index > 0 ? styles.cardOverlap : null}
                >
                  <AnimatedCard
                    animateOnMount={showFace ? 'flip' : 'pop'}
                    card={actualCard}
                    dimmed={player.hasFolded}
                    hidden={!showFace}
                    size={cardSize}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.footer}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusTone.backgroundColor,
                borderColor: statusTone.borderColor,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: statusTone.color }]}>
              {statusLabel}
            </Text>
          </View>

          <Text numberOfLines={1} style={styles.contribution}>
            {contributionText}
          </Text>
          {player.hasFolded ? (
            <Text numberOfLines={1} style={styles.foldedTag}>
              Folded
            </Text>
          ) : null}
          {player.handDescription ? (
            <Text numberOfLines={1} style={styles.handText}>
              {player.handDescription}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  alignCenter: {
    alignItems: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  cardOverlap: {
    marginLeft: -10,
  },
  cardsRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardsRowCompact: {
    justifyContent: 'center',
    marginTop: 10,
  },
  cardsRowHero: {
    gap: 8,
    marginTop: 12,
  },
  contribution: {
    color: 'rgba(220,236,255,0.84)',
    fontSize: 10,
    fontWeight: '700',
  },
  dealerButton: {
    position: 'absolute',
    right: -6,
    top: -8,
  },
  foldedTag: {
    color: 'rgba(231,204,204,0.88)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footer: {
    gap: 4,
    marginTop: 12,
    minHeight: 26,
  },
  handText: {
    color: '#F5DE94',
    fontSize: 10,
    fontWeight: '800',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  heroDealer: {
    position: 'absolute',
    right: 6,
    top: -10,
  },
  heroTurn: {
    left: 16,
    position: 'absolute',
    top: -16,
    zIndex: 3,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,232,178,0.26)',
    borderRadius: 24,
    borderWidth: 1,
    opacity: 0.8,
  },
  meta: {
    color: 'rgba(226,233,255,0.62)',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  name: {
    color: '#F8F7FF',
    fontSize: 14,
    fontWeight: '900',
  },
  nameBlock: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  surface: {
    overflow: 'visible',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '100%',
  },
  surfaceCompact: {
    borderRadius: 20,
    minHeight: 84,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  surfaceHero: {
    borderRadius: 24,
    minHeight: 154,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  surfaceSelf: {
    shadowOpacity: 0.3,
  },
  surfaceWinner: {
    shadowColor: '#F5D06D',
    shadowOpacity: 0.35,
  },
  turnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(91,242,217,0.12)',
    borderColor: 'rgba(91,242,217,0.3)',
    borderRadius: 26,
    borderWidth: 1,
  },
  turnIndicator: {
    left: 10,
    position: 'absolute',
    top: -15,
    zIndex: 3,
  },
  winnerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,204,115,0.16)',
    borderRadius: 26,
  },
  wrapper: {
    position: 'relative',
    width: '100%',
  },
});
