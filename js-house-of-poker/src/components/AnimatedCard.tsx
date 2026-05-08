import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../theme/colors';

export type CardSize = 'lg' | 'md' | 'sm';
export type CardVariant = 'default' | 'board';

type AnimatedCardProps = {
  animateOnMount?: 'flip' | 'none' | 'pop';
  card?: string;
  dimmed?: boolean;
  hidden?: boolean;
  large?: boolean;
  size?: CardSize;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

const DEFAULT_SIZE_MAP = {
  lg: {
    backLabel: 12,
    backPatternGap: 3,
    borderRadius: 20,
    centerIcon: 30,
    height: 88,
    innerBorderInset: 4,
    miniIcon: 16,
    padX: 10,
    padY: 10,
    rank: 22,
    rankLineHeight: 25,
    topIcon: 18,
    width: 64,
  },
  md: {
    backLabel: 11,
    backPatternGap: 3,
    borderRadius: 16,
    centerIcon: 23,
    height: 72,
    innerBorderInset: 4,
    miniIcon: 13,
    padX: 8,
    padY: 8,
    rank: 18,
    rankLineHeight: 21,
    topIcon: 14,
    width: 52,
  },
  sm: {
    backLabel: 9,
    backPatternGap: 2,
    borderRadius: 12,
    centerIcon: 18,
    height: 58,
    innerBorderInset: 3,
    miniIcon: 11,
    padX: 6,
    padY: 6,
    rank: 15,
    rankLineHeight: 18,
    topIcon: 12,
    width: 42,
  },
} as const;

const BOARD_SIZE_MAP = {
  lg: {
    backLabel: 12,
    backPatternGap: 3,
    borderRadius: 8,
    centerIcon: 40,
    height: 94,
    innerBorderInset: 3,
    miniIcon: 18,
    padX: 7,
    padY: 6,
    rank: 25,
    rankLineHeight: 25,
    topIcon: 17,
    width: 68,
  },
  md: {
    backLabel: 11,
    backPatternGap: 3,
    borderRadius: 7,
    centerIcon: 34,
    height: 80,
    innerBorderInset: 3,
    miniIcon: 15,
    padX: 6,
    padY: 6,
    rank: 21,
    rankLineHeight: 21,
    topIcon: 14,
    width: 58,
  },
  sm: {
    backLabel: 9,
    backPatternGap: 2,
    borderRadius: 6,
    centerIcon: 28,
    height: 66,
    innerBorderInset: 2,
    miniIcon: 12,
    padX: 5,
    padY: 5,
    rank: 17,
    rankLineHeight: 18,
    topIcon: 12,
    width: 48,
  },
} as const;

function parseCard(card?: string) {
  if (!card || card.length < 2) {
    return { rank: '?', suit: 's' };
  }

  return {
    rank: card.slice(0, -1),
    suit: card.slice(-1).toLowerCase(),
  };
}

function getDisplayRank(rank: string) {
  return rank.toUpperCase() === 'T' ? '10' : rank.toUpperCase();
}

function getSuitMeta(suit: string, variant: CardVariant) {
  if (variant === 'board') {
    switch (suit) {
      case 'h':
      case 'd':
        return {
          color: '#D6231B',
          icon: suit === 'h' ? ('cards-heart' as const) : ('cards-diamond' as const),
        };
      case 'c':
        return { color: '#091018', icon: 'cards-club' as const };
      case 's':
      default:
        return { color: '#0A1118', icon: 'cards-spade' as const };
    }
  }

  switch (suit) {
    case 'h':
      return { color: '#D24563', icon: 'cards-heart' as const };
    case 'd':
      return { color: '#E26D4B', icon: 'cards-diamond' as const };
    case 'c':
      return { color: '#162031', icon: 'cards-club' as const };
    case 's':
    default:
      return { color: '#101827', icon: 'cards-spade' as const };
  }
}

export const AnimatedCard = memo(function AnimatedCard({
  animateOnMount = 'pop',
  card,
  dimmed = false,
  hidden = false,
  large = false,
  size,
  style,
  variant = 'default',
}: AnimatedCardProps) {
  const resolvedSize = size ?? (large ? 'lg' : 'md');
  const isBoardVariant = variant === 'board';
  const config = (isBoardVariant ? BOARD_SIZE_MAP : DEFAULT_SIZE_MAP)[resolvedSize];
  const flip = useRef(
    new Animated.Value(hidden || animateOnMount === 'flip' ? 0 : 1),
  ).current;
  const pop = useRef(
    new Animated.Value(animateOnMount === 'none' ? 1 : 0.88),
  ).current;
  const flash = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(hidden);
  const cardRef = useRef(card);
  const { rank, suit } = parseCard(card);
  const displayRank = getDisplayRank(rank);
  const suitMeta = getSuitMeta(suit, variant);

  useEffect(() => {
    Animated.spring(pop, {
      damping: 12,
      mass: 0.8,
      stiffness: 180,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  useEffect(() => {
    if (hiddenRef.current === hidden) {
      return;
    }

    hiddenRef.current = hidden;
    Animated.timing(flip, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
      toValue: hidden ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [flip, hidden]);

  useEffect(() => {
    if (cardRef.current === card && hiddenRef.current === hidden) {
      return;
    }

    cardRef.current = card;
    Animated.sequence([
      Animated.timing(flash, {
        duration: 140,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [card, flash, hidden]);

  const frontRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '0deg'],
  });
  const backRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const cardFrameStyle = useMemo<ViewStyle>(
    () => ({
      height: config.height,
      width: config.width,
    }),
    [config.height, config.width],
  );
  const faceStyle = useMemo<ViewStyle>(
    () => ({
      borderRadius: config.borderRadius,
      paddingHorizontal: config.padX,
      paddingVertical: config.padY,
    }),
    [config.borderRadius, config.padX, config.padY],
  );

  return (
    <Animated.View
      style={[
        styles.frame,
        cardFrameStyle,
        style,
        dimmed ? styles.frameDimmed : null,
        { transform: [{ scale: pop }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.face,
          faceStyle,
          {
            transform: [{ perspective: 900 }, { rotateY: backRotation }],
          },
        ]}
      >
        <LinearGradient
          colors={['#16355B', '#102341', '#0A172B']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: config.borderRadius }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.innerBorder,
            {
              borderColor: 'rgba(132,182,255,0.46)',
              borderRadius: config.borderRadius - 2,
              bottom: config.innerBorderInset,
              left: config.innerBorderInset,
              right: config.innerBorderInset,
              top: config.innerBorderInset,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[styles.cardGlow, { borderRadius: config.borderRadius }]}
        />
        <View style={[styles.backPattern, { gap: config.backPatternGap }]}>
          <View style={styles.backStripe} />
          <View style={styles.backStripe} />
          <View style={styles.backStripe} />
        </View>
        <Text style={[styles.backLabel, { fontSize: config.backLabel }]}>HOP</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.face,
          isBoardVariant ? styles.faceBoard : null,
          faceStyle,
          {
            transform: [{ perspective: 900 }, { rotateY: frontRotation }],
          },
        ]}
      >
        {isBoardVariant ? (
          <>
            <View
              style={[
                styles.boardSurface,
                { borderRadius: config.borderRadius },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.innerBorder,
                {
                  borderColor: 'rgba(18,24,36,0.18)',
                  borderRadius: config.borderRadius - 1,
                  bottom: config.innerBorderInset,
                  left: config.innerBorderInset,
                  right: config.innerBorderInset,
                  top: config.innerBorderInset,
                },
              ]}
            />
            <View style={styles.boardCorner}>
              <Text
                style={[
                  styles.rank,
                  styles.rankBoard,
                  {
                    color: suitMeta.color,
                    fontSize: displayRank.length > 1 ? config.rank - 2 : config.rank,
                    lineHeight: config.rankLineHeight,
                  },
                ]}
              >
                {displayRank}
              </Text>
              <MaterialCommunityIcons
                color={suitMeta.color}
                name={suitMeta.icon}
                size={config.topIcon}
                style={styles.boardCornerSuit}
              />
            </View>
            <View style={styles.boardPipWrap}>
              <MaterialCommunityIcons
                color={suitMeta.color}
                name={suitMeta.icon}
                size={config.centerIcon}
              />
            </View>
          </>
        ) : (
          <>
            <LinearGradient
              colors={['#FFFEFB', colors.cardFace, '#ECEAF6']}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: config.borderRadius }]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.innerBorder,
                {
                  borderColor: 'rgba(37,41,52,0.12)',
                  borderRadius: config.borderRadius - 2,
                  bottom: config.innerBorderInset,
                  left: config.innerBorderInset,
                  right: config.innerBorderInset,
                  top: config.innerBorderInset,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.faceSheen,
                {
                  borderRadius: config.borderRadius,
                },
              ]}
            />

            <View style={styles.faceTop}>
              <View>
                <Text
                  style={[
                    styles.rank,
                    {
                      color: suitMeta.color,
                      fontSize: displayRank.length > 1 ? config.rank - 2 : config.rank,
                      lineHeight: config.rankLineHeight,
                    },
                  ]}
                >
                  {displayRank}
                </Text>
                <MaterialCommunityIcons
                  color={suitMeta.color}
                  name={suitMeta.icon}
                  size={config.topIcon}
                />
              </View>
              <MaterialCommunityIcons
                color={suitMeta.color}
                name={suitMeta.icon}
                size={config.miniIcon}
              />
            </View>

            <View style={styles.faceCenter}>
              <MaterialCommunityIcons
                color={suitMeta.color}
                name={suitMeta.icon}
                size={config.centerIcon}
              />
            </View>

            <View style={styles.faceBottom}>
              <MaterialCommunityIcons
                color={suitMeta.color}
                name={suitMeta.icon}
                size={config.miniIcon}
              />
              <Text
                style={[
                  styles.rank,
                  {
                    color: suitMeta.color,
                    fontSize: displayRank.length > 1 ? config.rank - 2 : config.rank,
                    lineHeight: config.rankLineHeight,
                  },
                ]}
              >
                {displayRank}
              </Text>
            </View>
          </>
        )}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.flashOverlay,
          {
            borderRadius: config.borderRadius,
            opacity: flash,
          },
        ]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  backLabel: {
    color: '#D9F2FF',
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  backPattern: {
    marginBottom: 8,
    width: '72%',
  },
  backStripe: {
    backgroundColor: 'rgba(230,241,255,0.26)',
    borderRadius: 999,
    height: 3,
    width: '100%',
  },
  boardCorner: {
    alignItems: 'flex-start',
  },
  boardCornerSuit: {
    marginTop: -2,
  },
  boardPipWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 4,
  },
  boardSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFDF8',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(82,144,255,0.12)',
  },
  face: {
    alignItems: 'stretch',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    bottom: 0,
    justifyContent: 'space-between',
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    top: 0,
  },
  faceBoard: {
    borderColor: 'rgba(27,35,46,0.22)',
    justifyContent: 'flex-start',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  faceBottom: {
    alignItems: 'flex-end',
  },
  faceCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  faceSheen: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: '48%',
    left: '4%',
    position: 'absolute',
    top: '2%',
    width: '70%',
  },
  faceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  frame: {
    position: 'relative',
  },
  frameDimmed: {
    opacity: 0.45,
  },
  innerBorder: {
    borderWidth: 1,
    position: 'absolute',
  },
  rank: {
    fontWeight: '900',
  },
  rankBoard: {
    letterSpacing: -0.4,
  },
});
