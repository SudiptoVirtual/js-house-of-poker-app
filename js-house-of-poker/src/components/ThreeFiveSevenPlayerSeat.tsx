import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { Poker357Decision, PokerPhase, PokerPlayerState } from '../types/poker';
import type { SeatAlignment } from '../utils/pokerTable';
import { AnimatedCard } from './AnimatedCard';
import { PlayerAvatar } from './PlayerAvatar';
import { TurnIndicator } from './TurnIndicator';

type Props = {
  align?: SeatAlignment;
  decision: Poker357Decision | null;
  displayCardCount?: number;
  isBottomSeat?: boolean;
  isSelf?: boolean;
  isWinner?: boolean;
  phase: PokerPhase;
  player: PokerPlayerState;
};

const MAX_LEG_SLOTS = 4;
const CARD_OVERLAP = 22;

function getShellColors(
  decision: Poker357Decision | null,
  isBottomSeat: boolean,
  isSelf: boolean,
  isWinner: boolean,
) {
  if (isWinner) {
    return ['rgba(101, 73, 28, 0.98)', 'rgba(33, 22, 10, 0.99)'] as const;
  }

  if (decision === 'GO') {
    return ['rgba(18, 70, 72, 0.97)', 'rgba(6, 28, 34, 0.99)'] as const;
  }

  if (decision === 'STAY') {
    return ['rgba(30, 31, 39, 0.95)', 'rgba(13, 14, 20, 0.99)'] as const;
  }

  if (isSelf || isBottomSeat) {
    return ['rgba(23, 33, 48, 0.97)', 'rgba(8, 15, 25, 0.99)'] as const;
  }

  return ['rgba(18, 21, 30, 0.95)', 'rgba(8, 10, 16, 0.99)'] as const;
}

function getBadgeTone(
  decision: Poker357Decision | null,
  player: PokerPlayerState,
  phase: PokerPhase,
  isWinner: boolean,
) {
  if (isWinner) {
    return {
      backgroundColor: '#AF7A22',
      borderColor: '#F8D588',
      color: '#FFF7E2',
      label: 'Winner',
    };
  }

  if (decision === 'GO') {
    return {
      backgroundColor: '#0B8D80',
      borderColor: '#8AF1D7',
      color: '#E9FFF9',
      label: 'GO',
    };
  }

  if (decision === 'STAY') {
    return {
      backgroundColor: '#3A3E49',
      borderColor: '#9AA1B2',
      color: '#EEF3FF',
      label: 'STAY',
    };
  }

  if (player.isTurn) {
    return {
      backgroundColor: '#D49831',
      borderColor: '#FFD88A',
      color: '#191208',
      label: 'Acting',
    };
  }

  if (!player.isConnected) {
    return {
      backgroundColor: '#2D313A',
      borderColor: '#7C8392',
      color: '#E7EEF8',
      label: 'Away',
    };
  }

  if (phase === 'waiting') {
    return {
      backgroundColor: '#25313D',
      borderColor: '#7FA7C2',
      color: '#ECF7FF',
      label: 'Waiting',
    };
  }

  return {
    backgroundColor: '#1B2634',
    borderColor: '#7AB6CA',
    color: '#F1FBFF',
    label: 'Ready',
  };
}

export const ThreeFiveSevenPlayerSeat = memo(function ThreeFiveSevenPlayerSeat({
  align = 'center',
  decision,
  displayCardCount,
  isBottomSeat = false,
  isSelf = false,
  isWinner = false,
  phase,
  player,
}: Props) {
  const folded = useRef(new Animated.Value(decision === 'STAY' ? 0.72 : 1)).current;
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 0.5 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 0.78 : 0)).current;
  const badge = getBadgeTone(decision, player, phase, isWinner);
  const cardCount = Math.max(displayCardCount ?? 0, player.cardCount, player.holeCards.length);
  const cards = Array.from({ length: cardCount });
  const wrapperAlignment =
    align === 'left'
      ? styles.alignLeft
      : align === 'right'
        ? styles.alignRight
        : styles.alignCenter;

  useEffect(() => {
    Animated.timing(folded, {
      duration: 220,
      toValue: decision === 'STAY' ? 0.58 : 1,
      useNativeDriver: true,
    }).start();
  }, [decision, folded]);

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
            toValue: 0.26,
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
      duration: 220,
      toValue: isWinner ? 0.84 : 0,
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
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.turnGlow,
          {
            opacity: turnGlow,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.winnerGlow,
          {
            opacity: winnerGlow,
          },
        ]}
      />

      {player.isTurn ? <TurnIndicator active style={styles.turnIndicator} /> : null}

      <LinearGradient
        colors={getShellColors(decision, isBottomSeat, isSelf, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.shell, isBottomSeat ? styles.shellBottom : null]}
      >
        <View style={styles.innerBorder} />

        <View style={styles.topRow}>
          <View style={styles.identity}>
            <PlayerAvatar
              connected={player.isConnected}
              name={player.name}
              seed={player.id}
              size="sm"
              status={player.playerStatus}
            />
            <View style={styles.nameBlock}>
              <Text numberOfLines={1} style={styles.name}>
                {player.name}
                {isSelf ? '  YOU' : ''}
              </Text>
              <Text numberOfLines={1} style={styles.stack}>
                ${player.chips.toLocaleString('en-US')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: badge.backgroundColor,
                borderColor: badge.borderColor,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.handRow}>
          {cards.map((_, index) => {
            const card = player.holeCards[index];

            return (
              <View
                key={`${player.id}-357-card-${index}`}
                style={[styles.cardSlot, index > 0 ? styles.cardSlotOverlap : null]}
              >
                <AnimatedCard
                  animateOnMount="none"
                  card={card}
                  dimmed={decision === 'STAY'}
                  hidden={!card}
                  size="sm"
                />
              </View>
            );
          })}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.legsRow}>
            {Array.from({ length: MAX_LEG_SLOTS }).map((_, index) => {
              const filled = index < Math.min(player.legs, MAX_LEG_SLOTS);

              return (
                <View
                  key={`${player.id}-leg-${index}`}
                  style={[styles.legSlot, filled ? styles.legSlotFilled : null]}
                >
                  {filled ? <View style={styles.legCore} /> : null}
                </View>
              );
            })}
          </View>
          <Text style={styles.legsText}>{Math.min(player.legs, MAX_LEG_SLOTS)} / 4 legs</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  alignCenter: { alignItems: 'center' },
  alignLeft: { alignItems: 'flex-start' },
  alignRight: { alignItems: 'flex-end' },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSlot: {
    width: 42,
  },
  cardSlotOverlap: {
    marginLeft: -CARD_OVERLAP,
  },
  handRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 60,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minWidth: 0,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
  },
  legCore: {
    backgroundColor: '#FFE5F2',
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  legSlot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255, 150, 205, 0.32)',
    borderRadius: 999,
    borderWidth: 1,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  legSlotFilled: {
    backgroundColor: '#FF6FB3',
    borderColor: '#FFB9DA',
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  legsText: {
    color: '#FFC4E0',
    fontSize: 10,
    fontWeight: '800',
  },
  name: {
    color: '#EAF5FF',
    fontSize: 10,
    fontWeight: '800',
  },
  nameBlock: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  shell: {
    borderRadius: 16,
    gap: 8,
    overflow: 'visible',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    width: '100%',
  },
  shellBottom: {
    paddingHorizontal: 12,
  },
  stack: {
    color: 'rgba(236, 245, 252, 0.78)',
    fontSize: 10,
    fontWeight: '700',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  turnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(101, 238, 255, 0.14)',
    borderColor: 'rgba(101, 238, 255, 0.24)',
    borderRadius: 16,
    borderWidth: 1,
  },
  turnIndicator: {
    left: 10,
    position: 'absolute',
    top: -12,
    zIndex: 4,
  },
  winnerGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 208, 123, 0.18)',
    borderRadius: 16,
  },
  wrapper: {
    position: 'relative',
    width: '100%',
  },
});
