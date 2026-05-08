import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerPhase, PokerPlayerState } from '../types/poker';
import { getPlayerStatusLabel, type SeatAlignment } from '../utils/pokerTable';
import { AnimatedCard } from './AnimatedCard';
import { DealerButton } from './DealerButton';
import { PlayerAvatar } from './PlayerAvatar';
import { TurnIndicator } from './TurnIndicator';

type ClassicPlayerSeatProps = {
  align?: SeatAlignment;
  isBottomSeat?: boolean;
  isSelf?: boolean;
  isWinner?: boolean;
  phase: PokerPhase;
  player: PokerPlayerState;
};

function getSeatColors(isBottomSeat: boolean, isSelf: boolean, isWinner: boolean) {
  if (isWinner) {
    return ['rgba(84, 56, 18, 0.95)', 'rgba(32, 20, 10, 0.98)'] as const;
  }

  if (isSelf || isBottomSeat) {
    return ['rgba(24, 33, 42, 0.92)', 'rgba(8, 13, 22, 0.97)'] as const;
  }

  return ['rgba(13, 16, 20, 0.9)', 'rgba(5, 8, 12, 0.96)'] as const;
}

function getBannerColors(player: PokerPlayerState, phase: PokerPhase, isWinner: boolean) {
  const label = getPlayerStatusLabel(player, phase, isWinner);

  if (isWinner) {
    return { background: '#A5751E', border: '#F5D487', color: '#FFF6DE', label: 'Winner' };
  }

  if (player.hasFolded) {
    return { background: '#423D37', border: '#857867', color: '#F0E3D4', label };
  }

  if (player.isTurn) {
    return { background: '#C8932B', border: '#FFD878', color: '#13100A', label: 'Turn' };
  }

  if (player.isAllIn) {
    return { background: '#9C5520', border: '#F0A66A', color: '#FFF2E7', label: 'All-in' };
  }

  if (!player.isConnected) {
    return { background: '#2E343B', border: '#78818D', color: '#E1E7F0', label: 'Away' };
  }

  return { background: '#0A0D12', border: '#CDA04E', color: '#FFD978', label };
}

function getSuitName(card?: string) {
  const suit = card?.slice(-1).toLowerCase();
  switch (suit) {
    case 'h':
      return 'Hearts';
    case 'd':
      return 'Diamonds';
    case 'c':
      return 'Clubs';
    case 's':
      return 'Spades';
    default:
      return 'Hidden';
  }
}

export const ClassicPlayerSeat = memo(function ClassicPlayerSeat({
  align = 'center',
  isBottomSeat = false,
  isSelf = false,
  isWinner = false,
  phase,
  player,
}: ClassicPlayerSeatProps) {
  const folded = useRef(new Animated.Value(player.hasFolded ? 1 : 0)).current;
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 0.6 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 0.7 : 0)).current;

  useEffect(() => {
    Animated.timing(folded, {
      duration: 220,
      toValue: player.hasFolded ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [folded, player.hasFolded]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (player.isTurn) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(turnGlow, {
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(turnGlow, {
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.34,
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
      toValue: isWinner ? 0.72 : 0,
      useNativeDriver: true,
    }).start();
  }, [isWinner, winnerGlow]);

  const wrapperAlignment =
    align === 'left'
      ? styles.alignLeft
      : align === 'right'
        ? styles.alignRight
        : styles.alignCenter;
  const banner = getBannerColors(player, phase, isWinner);
  const secondaryText =
    player.betThisRound > 0
      ? `Bet $${player.betThisRound}`
      : `$${player.chips.toLocaleString('en-US')}`;
  const showHoleCards = player.holeCards.length > 0;
  const holeCards = showHoleCards ? player.holeCards.slice(0, 2) : [undefined, undefined];
  const holeCardLabel = `${getSuitName(holeCards[0])} / ${getSuitName(holeCards[1])}`;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        wrapperAlignment,
        {
          opacity: folded.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.5],
          }),
          transform: [
            {
              scale: folded.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.95],
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

      <LinearGradient
        colors={getSeatColors(isBottomSeat, isSelf, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.shell,
          isBottomSeat ? styles.shellBottom : styles.shellSide,
        ]}
      >
        <View style={styles.innerBorder} />

        <View
          style={[
            styles.banner,
            {
              backgroundColor: banner.background,
              borderColor: banner.border,
            },
          ]}
        >
          <Text style={[styles.bannerText, { color: banner.color }]}>{banner.label}</Text>
        </View>

        {player.isTurn ? <TurnIndicator active style={styles.turnIndicator} /> : null}
        {player.isDealer ? <DealerButton compact style={styles.dealerButton} /> : null}

        <View style={[styles.portraitFrame, isBottomSeat ? styles.portraitFrameBottom : null]}>
          <View style={styles.portraitGlow} />
          <PlayerAvatar
            connected={player.isConnected}
            name={player.name}
            seed={player.id}
            size="sm"
            status={player.playerStatus}
          />
        </View>

        <Text numberOfLines={1} style={styles.name}>
          {player.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {secondaryText}
        </Text>
        <View style={styles.holeCardsRow}>
          {holeCards.map((card, index) => (
            <AnimatedCard
              key={`${player.id}-hole-${index}`}
              animateOnMount="none"
              card={card}
              hidden={!showHoleCards}
              size="sm"
            />
          ))}
        </View>
        <Text numberOfLines={1} style={styles.holeCardsLabel}>
          {holeCardLabel}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  alignCenter: { alignItems: 'center' },
  alignLeft: { alignItems: 'flex-start' },
  alignRight: { alignItems: 'flex-end' },
  banner: {
    borderRadius: 9,
    borderWidth: 1,
    left: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    position: 'absolute',
    right: 5,
    top: 5,
    zIndex: 3,
  },
  bannerText: {
    fontSize: 8,
    fontWeight: '900',
    textAlign: 'center',
  },
  dealerButton: {
    position: 'absolute',
    right: -4,
    top: -6,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
  },
  meta: {
    color: '#F7F7F4',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 1,
  },
  name: {
    color: '#DCE5EB',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    maxWidth: '100%',
  },
  portraitFrame: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  portraitFrameBottom: {
    height: 48,
    width: 48,
  },
  portraitGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shell: {
    alignItems: 'center',
    overflow: 'visible',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    width: '100%',
  },
  shellBottom: {
    borderRadius: 16,
    minHeight: 116,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 18,
  },
  shellSide: {
    borderRadius: 16,
    minHeight: 116,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 18,
  },
  holeCardsLabel: {
    color: 'rgba(201, 224, 255, 0.86)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  holeCardsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  turnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,210,118,0.14)',
    borderColor: 'rgba(255,210,118,0.26)',
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
    backgroundColor: 'rgba(255,208,115,0.18)',
    borderRadius: 16,
  },
  wrapper: {
    position: 'relative',
    width: '100%',
  },
});
