import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

import { colors } from '../../theme/colors';
type Props = {
  align?: SeatAlignment;
  anteAmount?: number;
  compact357Layout?: boolean;
  decision?: Poker357Decision | null;
  displayCardCount?: number;
  game: PokerGame;
  isBottomSeat?: boolean;
  isLoser?: boolean;
  isSelf?: boolean;
  isWinner?: boolean;
  legCount?: number;
  legPulseKey?: string | null;
  onPressPlayerAvatar?: (player: PokerPlayerState) => void;
  phase: PokerPhase;
  player: PokerPlayerState;
  showdownCards?: string[] | null;
  showdownDescription?: string | null;
  showDecisionMode?: boolean;
};

const MAX_LEG_SLOTS = 4;
const SEAT_META_BADGE_SIZE = 24;
const COMPACT_357_META_BADGE_SIZE = 16;
const SELF_TABLE_SEAT_SIZE_SCALE = 0.88;
const CARD_DIMENSIONS = {
  md: { height: 72, width: 52 },
  sm: { height: 58, width: 42 },
} as const;

function formatChipAmount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }

  return value.toLocaleString('en-US');
}

function formatSelfAnchorChairName(name: string) {
  const trimmedName = name.trim();
  const words = trimmedName.split(/\s+/);

  if (words.length <= 2) {
    return trimmedName;
  }

  return `${words.slice(0, 2).join(' ')}...`;
}

function resolveCardCount(player: PokerPlayerState, displayCardCount?: number) {
  return Math.max(
    displayCardCount ?? 0,
    Number.isFinite(player.cardCount) ? player.cardCount : 0,
    player.holeCards.length,
  );
}

function shouldRevealCards(
  phase: PokerPhase,
  isSelf: boolean,
  isWinner: boolean,
  game: PokerGame,
  decision: Poker357Decision | null,
) {
  if (isSelf) {
    return true;
  }

  if (game === '357') {
    return decision === 'GO';
  }

  if (isWinner) {
    return true;
  }

  return (
    phase === 'showdown' ||
    phase === 'completed' ||
    phase === 'reveal' ||
    phase === 'resolve'
  );
}

function getShowdownResult(
  decision: Poker357Decision | null,
  isLoser: boolean,
  isWinner: boolean,
  showdownDescription?: string | null,
) {
  if (decision !== 'GO') {
    return null;
  }

  if (isWinner) {
    return {
      backgroundColor: colors.surfaces.goldTint,
      borderColor: colors.gold,
      color: colors.gold,
      label: 'GO WIN',
      text: showdownDescription ?? 'Winning GO hand',
    };
  }

  if (isLoser) {
    return {
      backgroundColor: colors.destructivePanel,
      borderColor: colors.danger,
      color: colors.text,
      label: 'GO LOSE',
      text: showdownDescription ?? 'Losing GO hand',
    };
  }

  return {
    backgroundColor: colors.surfaces.feltTint,
    borderColor: colors.success,
    color: colors.textSoft,
    label: 'GO SHOWDOWN',
    text: showdownDescription ?? 'Cards revealed for showdown',
  };
}

function getStatusRibbon(isWinner: boolean) {
  if (!isWinner) {
    return null;
  }

  return {
    color: colors.gold,
    icon: 'crown',
    label: 'Winner',
    ring: colors.gold,
    tone: colors.surfaces.goldTint,
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
      backgroundColor: colors.surfaces.goldTint,
      borderColor: colors.gold,
      color: colors.text,
      label: 'WIN',
    };
  }

  if (decision === 'GO') {
    return {
      backgroundColor: colors.surfaces.feltTint,
      borderColor: colors.success,
      color: colors.textSoft,
      label: 'GO',
    };
  }

  if (decision === 'STAY') {
    return {
      backgroundColor: colors.surfaces.mutedTint,
      borderColor: colors.danger,
      color: colors.text,
      label: 'STAY',
    };
  }

  if (player.isAllIn) {
    return {
      backgroundColor: colors.surfaces.goldTint,
      borderColor: colors.gold,
      color: colors.text,
      label: 'ALL-IN',
    };
  }

  if (player.hasFolded) {
    return {
      backgroundColor: colors.surfaces.mutedTint,
      borderColor: colors.muted,
      color: colors.text,
      label: 'FOLD',
    };
  }

  if (!player.isConnected) {
    return {
      backgroundColor: colors.surfaces.mutedTint,
      borderColor: colors.muted,
      color: colors.text,
      label: 'AWAY',
    };
  }

  if (player.isTurn) {
    return {
      backgroundColor: colors.surfaces.actionTint,
      borderColor: colors.secondary,
      color: colors.text,
      label: 'TURN',
    };
  }

  return {
    backgroundColor: colors.surface,
    borderColor: colors.glowCyan,
    color: colors.text,
    label: getPlayerStatusLabel(player, phase, isWinner).toUpperCase(),
  };
}

function getShellGradient(
  isBottomSeat: boolean,
  showDecisionMode: boolean,
  isWinner: boolean,
) {
  if (isWinner) {
    return colors.gradients.actionGold;
  }

  if (showDecisionMode) {
    return colors.gradients.actionSecondary;
  }

  if (isBottomSeat) {
    return [colors.surface, colors.background] as const;
  }

  return [colors.surface, colors.background] as const;
}

function CardFan({
  count,
  cards,
  hidden,
  compact = false,
  spread = 'default',
  size,
}: {
  cards: string[];
  compact?: boolean;
  count: number;
  hidden: boolean;
  spread?: 'default' | 'wide' | 'anchor' | 'anchorSelf';
  size: 'md' | 'sm';
}) {
  const wideSpread = spread === 'wide';
  const anchorSpread = spread === 'anchor' || spread === 'anchorSelf';
  const anchorSelfSpread = spread === 'anchorSelf';
  const overlap = wideSpread ? 32 : size === 'md' ? 24 : 18;
  const angleSpread = wideSpread ? 5 : size === 'md' ? 14 : 10;
  const slots = Array.from({ length: count });

  if (compact) {
    const dimensions = CARD_DIMENSIONS[size];
    const compactScale = anchorSelfSpread
      ? 0.55
      : anchorSpread
        ? 0.5
        : wideSpread
          ? 0.58
          : 0.55;
    const baseCompactStep = anchorSpread
      ? anchorSelfSpread
        ? count >= 7
          ? 6
          : count >= 5
            ? 7
            : 9
        : count >= 7
          ? 5.5
          : count >= 5
            ? 6.5
            : 8
      : count >= 7
        ? 7
        : count >= 5
          ? 8
          : 10;
    const compactStep = anchorSelfSpread
      ? baseCompactStep * 1.2
      : baseCompactStep;
    const compactWidth = Math.ceil(
      dimensions.width * compactScale +
        compactStep * Math.max(0, count - 1) +
        (anchorSpread ? 4 : 6),
    );
    const compactHeight = Math.ceil(
      dimensions.height * compactScale +
        (anchorSelfSpread ? 11 : anchorSpread ? 7 : 18),
    );
    const compactAngleSpread = anchorSpread ? 3 : wideSpread ? 4 : 4.5;

    return (
      <View
        style={[
          styles.cardFan,
          styles.cardFanCompactAbsolute,
          { height: compactHeight, width: compactWidth },
        ]}
      >
        {slots.map((_, index) => {
          const card = cards[index];
          const rotate = (index - (count - 1) / 2) * compactAngleSpread;
          const topOffset =
            Math.abs(index - (count - 1) / 2) *
            (anchorSpread && !anchorSelfSpread ? 0.4 : 0.6);

          return (
            <View
              key={`fan-${index}`}
              style={[
                styles.cardFanSlot,
                styles.cardFanSlotAbsolute,
                {
                  height: dimensions.height,
                  left: index * compactStep,
                  top: topOffset,
                  transform: [
                    { rotate: `${rotate}deg` },
                    { scale: compactScale },
                  ],
                  width: dimensions.width,
                  zIndex: index + 1,
                },
              ]}
            >
              <AnimatedCard
                animateOnMount="none"
                card={card}
                hidden={hidden || !card}
                size={size}
                style={styles.compactFanCard}
              />
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.cardFan}>
      {slots.map((_, index) => {
        const card = cards[index];
        const rotate = (index - (count - 1) / 2) * angleSpread;
        const translateY =
          Math.abs(index - (count - 1) / 2) * (size === 'md' ? 1.8 : 1.2);

        return (
          <View
            key={`fan-${index}`}
            style={[
              styles.cardFanSlot,
              index > 0 ? { marginLeft: -overlap } : null,
              {
                transform: [
                  { rotate: `${rotate}deg` },
                  { translateY },
                ],
              },
            ]}
          >
            <AnimatedCard
              animateOnMount="none"
              card={card}
              hidden={hidden || !card}
              size={size}
            />
          </View>
        );
      })}
    </View>
  );
}

function LegsPips({
  compact = false,
  legs,
  mini = false,
  pulseKey = null,
}: {
  compact?: boolean;
  legs: number;
  mini?: boolean;
  pulseKey?: string | null;
}) {
  const previousLegs = useRef(legs);
  const previousPulseKey = useRef(pulseKey);
  const gainPulse = useRef(new Animated.Value(0)).current;
  const visibleLegs = Math.max(0, Math.min(legs, MAX_LEG_SLOTS));

  useEffect(() => {
    const didLegsIncrease = legs > previousLegs.current;
    const didPulseKeyChange = Boolean(
      pulseKey && pulseKey !== previousPulseKey.current,
    );

    if (didLegsIncrease || didPulseKeyChange) {
      gainPulse.setValue(0);
      Animated.sequence([
        Animated.timing(gainPulse, {
          duration: 180,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(gainPulse, {
          duration: 360,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }

    previousLegs.current = legs;
    previousPulseKey.current = pulseKey;
  }, [gainPulse, legs, pulseKey]);

  return (
    <Animated.View
      accessibilityLabel={`${legs} of ${MAX_LEG_SLOTS} legs`}
      style={[
        styles.legsPipsShell,
        compact ? styles.legsPipsShellCompact : null,
        mini ? styles.legsPipsShellMini : null,
        {
          transform: [
            {
              scale: gainPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
              }),
            },
          ],
        },
      ]}
    >
      {mini ? null : (
        <Text
          style={[
            styles.legsPipsLabel,
            compact ? styles.legsPipsLabelCompact : null,
          ]}
        >
          {visibleLegs}/{MAX_LEG_SLOTS}
        </Text>
      )}
      <View style={[styles.legsPipsRow, mini ? styles.legsPipsRowMini : null]}>
        {Array.from({ length: MAX_LEG_SLOTS }).map((_, index) => {
          const filled = index < visibleLegs;
          const justGained =
            index >= previousLegs.current && index < visibleLegs;

          return (
            <Animated.View
              key={`leg-pip-${index}`}
              style={[
                styles.legsPip,
                compact ? styles.legsPipCompact : null,
                mini ? styles.legsPipMini : null,
                filled ? styles.legsPipFilled : null,
                justGained
                  ? {
                      opacity: gainPulse.interpolate({
                        inputRange: [0, 0.25, 1],
                        outputRange: [1, 0.7, 1],
                      }),
                      transform: [
                        {
                          scale: gainPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.45],
                          }),
                        },
                      ],
                    }
                  : null,
              ]}
            >
              {filled ? (
                <MaterialCommunityIcons
                  color={colors.background}
                  name="check"
                  size={mini ? 3 : compact ? 4 : 7}
                />
              ) : null}
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

export const GameTableSeat = memo(function GameTableSeat({
  align = 'center',
  anteAmount = 0,
  compact357Layout: _compact357Layout = false,
  decision = null,
  displayCardCount,
  game,
  isBottomSeat = false,
  isLoser = false,
  isSelf = false,
  isWinner = false,
  legCount,
  legPulseKey = null,
  onPressPlayerAvatar,
  phase,
  player,
  showdownCards = null,
  showdownDescription = null,
  showDecisionMode = false,
}: Props) {
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 0.55 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 0.7 : 0)).current;
  const folded = useRef(
    new Animated.Value(player.hasFolded || decision === 'STAY' ? 0.82 : 1),
  ).current;
  const displayCards = showdownCards ?? player.holeCards;
  const cardCount = Math.max(
    resolveCardCount(player, displayCardCount),
    displayCards.length,
  );
  const visibleLegCount = legCount ?? player.legs;
  const revealCards = shouldRevealCards(
    phase,
    isSelf,
    isWinner,
    game,
    decision,
  );
  const cardsHidden = !revealCards && cardCount > 0;
  const actionBadge = getActionBadge(decision, player, phase, isWinner);
  const showdownResult = getShowdownResult(
    decision,
    isLoser,
    isWinner,
    showdownDescription,
  );
  const showShowdownConnector = Boolean(showdownResult) && revealCards;
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
  const is357Game = game === '357';
  const useCompact357Seat = is357Game;
  const useCompactDecisionSeat =
    useCompact357Seat || (showDecisionMode && !isSelf);
  const playerName = player.name;
  const anchorChairPlayerName = isSelf
    ? formatSelfAnchorChairName(playerName)
    : playerName;
  const selfTag = isSelf ? 'YOU' : null;
  const tableSeatSizeScale = isSelf ? SELF_TABLE_SEAT_SIZE_SCALE : 1;
  const useCompactSelfSeat = isBottomSeat && isSelf;
  const useSelf357MetaLayout = useCompactSelfSeat && is357Game;
  const showSelfSideCards = isBottomSeat && isSelf && cardCount > 0;
  const bottomCardSize = useCompactSelfSeat ? 'sm' : 'md';
  const showCompactActionPill =
    useCompact357Seat &&
    (isWinner ||
      isLoser ||
      Boolean(decision) ||
      player.hasFolded ||
      !player.isConnected ||
      player.isAllIn);

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

  const renderAvatarStack = (
    avatarSize: 'md' | 'sm',
    compact357 = false,
  ) => {
    const avatarNode = (
      <PlayerAvatar
        avatar={player.avatar}
        connected={player.isConnected}
        name={player.name}
        seed={player.id}
        size={avatarSize}
      />
    );
    const actionableAvatar = !isSelf && Boolean(onPressPlayerAvatar);

    return (
      <View
        style={[
          styles.seatAvatarStack,
          avatarSize === 'sm' ? styles.seatAvatarStackCompact : null,
          compact357 ? styles.seatAvatarStack357Compact : null,
        ]}
      >
        {actionableAvatar ? (
          <Pressable
            accessibilityLabel={`Open ${player.name} player card`}
            accessibilityRole="button"
            onPress={() => onPressPlayerAvatar?.(player)}
            style={({ pressed }) => [
              styles.seatAvatarPressable,
              pressed ? styles.seatAvatarPressablePressed : null,
            ]}
          >
            {avatarNode}
          </Pressable>
        ) : (
          avatarNode
        )}
        <View style={styles.seatAvatarStatusBubble}>
          <PlayerStatusBadge
            compact
            showLabel={false}
            size={
              compact357
                ? COMPACT_357_META_BADGE_SIZE
                : avatarSize === 'sm'
                  ? SEAT_META_BADGE_SIZE
                  : 28
            }
            statusTier={statusTier}
          />
        </View>
        {player.isDealer ? (
          <DealerButton
            compact
            showPulse={false}
            size={compact357 ? 16 : avatarSize === 'sm' ? 20 : 24}
            style={styles.seatMetaButton}
          />
        ) : null}
      </View>
    );
  };

  const renderShowdownConnector = (compact = false) => {
    if (!showdownResult) {
      return null;
    }

    return (
      <View
        style={[
          styles.showdownConnector,
          compact ? styles.showdownConnectorCompact : null,
          {
            backgroundColor: showdownResult.backgroundColor,
            borderColor: showdownResult.borderColor,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.showdownConnectorLabel,
            compact ? styles.showdownConnectorLabelCompact : null,
            { color: showdownResult.color },
          ]}
        >
          {showdownResult.label}
        </Text>
        {compact ? null : (
          <Text numberOfLines={2} style={styles.showdownConnectorText}>
            {showdownResult.text}
          </Text>
        )}
      </View>
    );
  };

  const renderCardFan = (
    size: 'md' | 'sm',
    compact = false,
    spread: 'default' | 'wide' | 'anchor' | 'anchorSelf' = 'default',
  ) => (
    <View
      style={[
        styles.revealedCardStack,
        compact ? styles.revealedCardStackCompact : null,
      ]}
    >
      <CardFan
        cards={displayCards}
        compact={compact}
        count={cardCount}
        hidden={cardsHidden}
        spread={spread}
        size={size}
      />
      {showShowdownConnector ? renderShowdownConnector(compact) : null}
    </View>
  );

  const anchorChairSeatNode = (
    <View
      style={[
        styles.anchorChairSeat,
        !isSelf ? styles.anchorChairSeatOpponentCompact : null,
      ]}
    >
      <View style={styles.anchorChairTopRow}>
        {renderAvatarStack('sm', true)}
        <View style={styles.anchorChairIdentityColumn}>
          <View style={styles.anchorChairNameRow}>
            <Text
              adjustsFontSizeToFit={!isSelf}
              ellipsizeMode="tail"
              minimumFontScale={isSelf ? 1 : 0.68}
              numberOfLines={1}
              style={[
                styles.anchorChairName,
                isSelf ? styles.anchorChairNameRowTextSelf : null,
                isSelf ? styles.anchorChairSelfName : null,
              ]}
            >
              {anchorChairPlayerName}
            </Text>
          </View>
          <View style={styles.anchorChairAmountsRow}>
            <View style={styles.anchorChairChipsPill}>
              <MaterialCommunityIcons
                color={colors.gold}
                name="poker-chip"
                size={7}
              />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={styles.anchorChairChipsText}
              >
                {formatChipAmount(player.chips)}
              </Text>
            </View>
            {selfTag ? (
              <View style={[styles.selfTag, styles.anchorChairSelfTag]}>
                <Text style={[styles.selfTagText, styles.anchorChairSelfTagText]}>
                  {selfTag}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {showCompactActionPill ? (
        <View
          style={[
            styles.anchorChairActionRow,
            !isSelf ? styles.anchorChairActionRowOverlay : null,
          ]}
        >
          <View
            style={[
              styles.compactActionPill,
              styles.anchorChairActionPill,
              {
                backgroundColor: actionBadge.backgroundColor,
                borderColor: actionBadge.borderColor,
              },
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[
                styles.compactActionPillText,
                styles.anchorChairActionPillText,
                { color: actionBadge.color },
              ]}
            >
              {actionBadge.label}
            </Text>
          </View>
        </View>
      ) : null}

      {isSelf ? (
        <View style={styles.anchorChairLegsRow}>
          <LegsPips
            compact
            legs={visibleLegCount}
            pulseKey={legPulseKey}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.anchorChairHandRow,
          !isSelf ? styles.anchorChairHandRowOpponentCompact : null,
        ]}
      >
        {isSelf ? (
          <View style={styles.anchorChairStakePill}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={styles.anchorChairStakeText}
            >
              ${formatChipAmount(labelAmount)}
            </Text>
          </View>
        ) : (
          <View style={styles.anchorChairMetaStack}>
            <LegsPips
              compact
              mini
              legs={visibleLegCount}
              pulseKey={legPulseKey}
            />
            <View
              style={[
                styles.anchorChairStakePill,
                styles.anchorChairStakePillOpponentCompact,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={1}
                style={styles.anchorChairStakeText}
              >
                ${formatChipAmount(labelAmount)}
              </Text>
            </View>
          </View>
        )}
        <View
          style={[
            styles.anchorChairCardsTray,
            !isSelf ? styles.anchorChairCardsTrayOpponentCompact : null,
            cardCount === 0 ? styles.anchorChairCardsTrayEmpty : null,
          ]}
        >
          {cardCount > 0
            ? renderCardFan('sm', true, isSelf ? 'anchorSelf' : 'anchor')
            : null}
        </View>
      </View>
    </View>
  );

  const bottomIdentityNode = (
    <View style={styles.bottomIdentityWrap}>
      {renderAvatarStack(
        useCompactSelfSeat ? 'sm' : 'md',
        useCompactSelfSeat && is357Game,
      )}
      {!showDecisionMode ? (
        <View
          style={[
            styles.stackPlate,
            useCompactSelfSeat ? styles.stackPlateCompact : null,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.stackText,
              useCompactSelfSeat ? styles.stackTextCompact : null,
            ]}
          >
            {formatChipAmount(player.chips)}
          </Text>
        </View>
      ) : null}
      {is357Game ? (
        <LegsPips
          compact={useCompactSelfSeat}
          legs={visibleLegCount}
          pulseKey={legPulseKey}
        />
      ) : null}
    </View>
  );

  const self357MetaNode = (
    <View style={styles.self357MetaLayout}>
      <View style={styles.self357InfoColumn}>
        <View style={styles.self357NameRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={[
              styles.playerName,
              styles.playerNameCompact,
              styles.self357PlayerName,
            ]}
          >
            {playerName}
          </Text>
          {selfTag ? (
            <View style={[styles.selfTag, styles.selfTagCompact]}>
              <Text style={[styles.selfTagText, styles.selfTagTextCompact]}>
                {selfTag}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.self357AnchorBody}>
          <View style={styles.self357MetaRow}>
            {renderAvatarStack('sm', true)}
            <View style={styles.self357LegsChipColumn}>
              <LegsPips
                compact
                legs={visibleLegCount}
                pulseKey={legPulseKey}
              />
              <View
                style={[styles.amountBubble, styles.amountBubbleSelfCompact]}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={[
                    styles.amountBubbleText,
                    styles.amountBubbleTextSelfCompact,
                  ]}
                >
                  ${formatChipAmount(labelAmount)}
                </Text>
              </View>
            </View>
          </View>
          {cardCount > 0 ? (
            <View style={styles.self357CardsRow}>
              {renderCardFan('sm', true, 'wide')}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

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
                outputRange: [
                  0.96 * tableSeatSizeScale,
                  tableSeatSizeScale,
                ],
              }),
            },
          ],
        },
      ]}
    >
      {!is357Game ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.turnGlow, { opacity: turnGlow }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.winnerGlow, { opacity: winnerGlow }]}
          />
        </>
      ) : null}

      {statusRibbon && !showDecisionMode && !is357Game ? (
        <View
          style={[
            styles.statusRibbon,
            {
              backgroundColor: statusRibbon.tone,
              borderColor: statusRibbon.ring,
            },
          ]}
        >
          <MaterialCommunityIcons
            color={statusRibbon.color}
            name={statusRibbon.icon as any}
            size={12}
          />
          <Text
            numberOfLines={1}
            style={[styles.statusRibbonText, { color: statusRibbon.color }]}
          >
            {statusRibbon.label}
          </Text>
        </View>
      ) : null}

      {player.isTurn && !is357Game ? (
        <TurnIndicator active style={styles.turnIndicator} />
      ) : null}

      <LinearGradient
        colors={getShellGradient(isBottomSeat, showDecisionMode, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.shell,
          showDecisionMode ? styles.shellDecision : styles.shellLive,
          is357Game ? styles.shell357Compact : null,
          is357Game ? styles.shellAnchorChair : null,
          is357Game && isSelf ? styles.shellAnchorChairSelf : null,
          !is357Game && isBottomSeat ? styles.shellBottom : null,
          !is357Game && useCompactSelfSeat ? styles.shellBottomCompact : null,
          !is357Game && useSelf357MetaLayout
            ? styles.shellSelf357Meta
            : null,
        ]}
      >
        {is357Game ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.turnGlow,
                styles.anchorChairTurnGlow,
                { opacity: turnGlow },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.winnerGlow,
                styles.anchorChairWinnerGlow,
                { opacity: winnerGlow },
              ]}
            />
          </>
        ) : null}

        <View
          style={[
            styles.shellBorder,
            useCompact357Seat ? styles.shellBorder357Compact : null,
          ]}
        />

        {!is357Game &&
        !useSelf357MetaLayout &&
        !useCompactDecisionSeat &&
        (showDecisionMode || isBottomSeat) ? (
          <View
            style={[
              styles.nameRail,
              useCompactSelfSeat ? styles.nameRailCompact : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.playerName,
                useCompactSelfSeat ? styles.playerNameCompact : null,
              ]}
            >
              {playerName}
            </Text>
            {selfTag ? (
              <View
                style={[
                  styles.selfTag,
                  useCompactSelfSeat ? styles.selfTagCompact : null,
                ]}
              >
                <Text
                  style={[
                    styles.selfTagText,
                    useCompactSelfSeat ? styles.selfTagTextCompact : null,
                  ]}
                >
                  {selfTag}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {is357Game ? (
          anchorChairSeatNode
        ) : useSelf357MetaLayout ? (
          self357MetaNode
        ) : useCompactDecisionSeat ? (
          <View
            style={[
              styles.compactDecisionSeat,
              align === 'right' ? styles.compactDecisionSeatRight : null,
            ]}
          >
            <View
              style={[
                styles.compactIdentityRow,
                align === 'right' ? styles.compactIdentityRowRight : null,
              ]}
            >
              {renderAvatarStack('sm', true)}
              <View
                style={[
                  styles.compactNameStack,
                  align === 'right' ? styles.compactNameStackRight : null,
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                  style={styles.compactName}
                >
                  {player.name}
                </Text>
                <View style={styles.compactStackLegsRow}>
                  <View style={styles.compactChipsPill}>
                    <MaterialCommunityIcons
                      color={colors.gold}
                      name="poker-chip"
                      size={7}
                    />
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      numberOfLines={1}
                      style={styles.compactStackText}
                    >
                      {formatChipAmount(player.chips)}
                    </Text>
                  </View>
                  <LegsPips
                    compact
                    legs={visibleLegCount}
                    pulseKey={legPulseKey}
                  />
                </View>
              </View>
            </View>
            {cardCount > 0 ? (
              <View
                style={[
                  styles.compactFanWrap,
                  align === 'right' ? styles.compactFanWrapRight : null,
                ]}
              >
                {renderCardFan('sm', true)}
              </View>
            ) : null}
            <View
              style={[
                styles.compactDecisionRail,
                align === 'right' ? styles.compactDecisionRailRight : null,
              ]}
            >
              <View style={[styles.amountBubble, styles.amountBubble357Compact]}>
                <Text
                  style={[
                    styles.amountBubbleText,
                    styles.amountBubbleText357Compact,
                  ]}
                >
                  ${formatChipAmount(labelAmount)}
                </Text>
              </View>
              {showCompactActionPill ? (
                <View
                  style={[
                    styles.compactActionPill,
                    {
                      backgroundColor: actionBadge.backgroundColor,
                      borderColor: actionBadge.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.compactActionPillText,
                      { color: actionBadge.color },
                    ]}
                  >
                    {actionBadge.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.cluster,
              sideLayout,
              useCompactSelfSeat ? styles.clusterCompact : null,
            ]}
          >
            {isBottomSeat ? (
              showSelfSideCards ? (
                <View style={styles.bottomSelfAnchorCluster}>
                  {bottomIdentityNode}
                  <View
                    pointerEvents="none"
                    style={styles.bottomSelfCardsRight}
                  >
                    {renderCardFan(bottomCardSize)}
                  </View>
                </View>
              ) : (
                <>
                  {cardCount > 0 ? renderCardFan(bottomCardSize) : null}
                  {bottomIdentityNode}
                </>
              )
            ) : (
              <>
                {align === 'right' && cardCount > 0
                  ? renderCardFan('sm')
                  : null}

                <View style={styles.sideIdentityWrap}>
                  {renderAvatarStack('sm')}

                  {!showDecisionMode ? (
                    <View style={styles.nameBox}>
                      <Text numberOfLines={1} style={styles.nameBoxName}>
                        {player.name}
                      </Text>
                      <View style={styles.nameBoxStackRow}>
                        <Text numberOfLines={1} style={styles.nameBoxStack}>
                          {formatChipAmount(player.chips)}
                        </Text>
                        {is357Game ? (
                          <LegsPips
                            compact
                            legs={visibleLegCount}
                            pulseKey={legPulseKey}
                          />
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>

                {align !== 'right' && cardCount > 0
                  ? renderCardFan('sm')
                  : null}
              </>
            )}
          </View>
        )}

        {!is357Game ? (
          useCompactDecisionSeat && !useSelf357MetaLayout ? null : showDecisionMode ? (
            useSelf357MetaLayout ? null : (
              <View
                style={[
                  styles.decisionRail,
                  useCompactSelfSeat ? styles.decisionRailSelfCompact : null,
                ]}
              >
                <View
                  style={[
                    styles.amountBubble,
                    useCompactSelfSeat
                      ? styles.amountBubbleSelfCompact
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.amountBubbleText,
                      useCompactSelfSeat
                        ? styles.amountBubbleTextSelfCompact
                        : null,
                    ]}
                  >
                    ${formatChipAmount(labelAmount)}
                  </Text>
                </View>
              </View>
            )
          ) : (
            <View
              style={[
                styles.liveFooter,
                useCompactSelfSeat ? styles.liveFooterCompact : null,
              ]}
            >
              <View
                style={[
                  styles.actionBadge,
                  useCompactSelfSeat ? styles.actionBadgeCompact : null,
                  {
                    backgroundColor: actionBadge.backgroundColor,
                    borderColor: actionBadge.borderColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionBadgeText,
                    useCompactSelfSeat ? styles.actionBadgeTextCompact : null,
                    { color: actionBadge.color },
                  ]}
                >
                  {actionBadge.label}
                </Text>
              </View>
            </View>
          )
        ) : (
          null
        )}

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
  actionBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actionBadgeTextCompact: {
    fontSize: 9,
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
  anchorChairActionPill: {
    flexShrink: 1,
    maxWidth: 52,
    minWidth: 30,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  anchorChairActionPillText: {
    fontSize: 7,
    letterSpacing: 0.2,
  },
  anchorChairActionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 11,
  },
  anchorChairActionRowOverlay: {
    minHeight: 0,
    position: 'absolute',
    right: 0,
    top: 28,
    zIndex: 7,
  },
  anchorChairAmountsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    minWidth: 0,
  },
  anchorChairCardsTray: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
    overflow: 'visible',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  anchorChairCardsTrayOpponentCompact: {
    minHeight: 33,
  },
  anchorChairCardsTrayEmpty: {
    minHeight: 12,
  },
  anchorChairChipsPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaces.goldTint,
    borderColor: colors.glowGold,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    flexShrink: 1,
    maxWidth: 50,
    minWidth: 36,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  anchorChairChipsText: {
    color: colors.gold,
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '900',
  },
  anchorChairIdentityColumn: {
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  anchorChairHandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 0,
  },
  anchorChairHandRowOpponentCompact: {
    gap: 2,
    minHeight: 35,
  },
  anchorChairLegsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 10,
  },
  anchorChairMetaStack: {
    alignItems: 'center',
    flexShrink: 0,
    gap: 1,
    justifyContent: 'center',
    minWidth: 30,
  },
  anchorChairName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '900',
  },
  anchorChairNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    minWidth: 0,
  },
  anchorChairNameRowTextSelf: {
    flexShrink: 0,
    maxWidth: 80,
  },
  anchorChairSeat: {
    alignItems: 'stretch',
    gap: 2,
    justifyContent: 'center',
    minHeight: 84,
    minWidth: 0,
    width: '100%',
  },
  anchorChairSeatOpponentCompact: {
    gap: 1,
    minHeight: 68,
  },
  anchorChairSelfTag: {
    flexShrink: 0,
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  anchorChairSelfTagText: {
    fontSize: 5,
    letterSpacing: 0.1,
  },
  anchorChairSelfName: {
    fontSize: 10,
    lineHeight: 13,
  },
  anchorChairStakePill: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.mutedTint,
    borderColor: colors.glowGold,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    minWidth: 30,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  anchorChairStakePillOpponentCompact: {
    maxWidth: 38,
    minWidth: 28,
    paddingHorizontal: 4,
  },
  anchorChairStakeText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '900',
  },
  anchorChairTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    minHeight: 30,
    minWidth: 0,
  },
  anchorChairTurnGlow: {
    backgroundColor: colors.surfaces.goldTint,
    borderColor: colors.gold,
    borderRadius: 10,
    borderWidth: 2,
    zIndex: 2,
  },
  anchorChairWinnerGlow: {
    borderRadius: 12,
  },
  amountBubble: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.glowGold,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  amountBubbleSelfCompact: {
    borderRadius: 999,
    minWidth: 36,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  amountBubble357Compact: {
    backgroundColor: colors.surfaces.glowPanel,
    borderColor: colors.glowGold,
    borderRadius: 999,
    minWidth: 30,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  amountBubbleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  amountBubbleTextSelfCompact: {
    fontSize: 9,
  },
  amountBubbleText357Compact: {
    fontSize: 8,
    letterSpacing: 0.15,
  },
  seatAvatarPressable: {
    borderRadius: 999,
  },
  seatAvatarPressablePressed: {
    opacity: 0.76,
    transform: [{ scale: 0.96 }],
  },
  seatAvatarStack: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    position: 'relative',
    width: 58,
  },
  seatAvatarStackCompact: {
    height: 42,
    width: 44,
  },
  seatAvatarStack357Compact: {
    height: 30,
    transform: [{ scale: 0.76 }],
    width: 32,
  },
  seatAvatarStatusBubble: {
    bottom: -4,
    position: 'absolute',
    right: -3,
    zIndex: 4,
  },
  seatMetaButton: {
    bottom: -2,
    flexShrink: 0,
    left: -2,
    position: 'absolute',
    zIndex: 5,
  },
  bottomIdentityWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  bottomSelfAnchorCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 58,
    position: 'relative',
    width: '100%',
  },
  bottomSelfCardsRight: {
    marginLeft: 6,
    zIndex: 4,
  },
  cardFan: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cardFanCompactAbsolute: {
    overflow: 'visible',
    position: 'relative',
  },
  cardFanSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFanSlotAbsolute: {
    position: 'absolute',
  },
  centerCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  cluster: {
    gap: 8,
    minHeight: 72,
  },
  clusterCompact: {
    gap: 5,
    minHeight: 58,
  },
  compactActionPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 28,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  compactActionPillText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  compactChipsPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.goldTint,
    borderColor: colors.glowGold,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    maxWidth: 44,
    minWidth: 30,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compactDecisionRail: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 14,
  },
  compactDecisionRailRight: {
    justifyContent: 'center',
  },
  compactDecisionSeat: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    justifyContent: 'center',
    minHeight: 120,
    minWidth: 0,
  },
  compactDecisionSeatRight: {
    alignItems: 'flex-end',
  },
  compactFanCard: {
    shadowOpacity: 0.12,
  },
  compactFanWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 66,
    overflow: 'visible',
    position: 'relative',
    width: '100%',
  },
  compactFanWrapRight: {
    alignSelf: 'center',
  },
  compactIdentityRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 0,
  },
  compactIdentityRowRight: {
    flexDirection: 'row-reverse',
  },
  compactName: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '800',
    maxWidth: 62,
  },
  compactNameStack: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaces.glowPanel,
    borderColor: colors.glowCyan,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    gap: 2,
    justifyContent: 'center',
    maxWidth: 76,
    minWidth: 0,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  compactNameStackRight: {
    alignItems: 'flex-end',
  },
  compactStackText: {
    color: colors.gold,
    flexShrink: 1,
    fontSize: 8,
    fontWeight: '900',
  },
  compactStackLegsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    maxWidth: '100%',
  },
  decisionRail: {
    alignItems: 'center',
    gap: 6,
  },
  decisionRailSelfCompact: {
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legsPip: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.mutedTint,
    borderColor: colors.muted,
    borderRadius: 999,
    borderWidth: 1,
    height: 12,
    justifyContent: 'center',
    width: 12,
  },
  legsPipCompact: {
    height: 6,
    width: 6,
  },
  legsPipMini: {
    borderWidth: 0,
    height: 4,
    width: 4,
  },
  legsPipFilled: {
    backgroundColor: colors.gold,
    borderColor: colors.glowGold,
  },
  legsPipsLabel: {
    color: colors.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  legsPipsLabelCompact: {
    fontSize: 6,
  },
  legsPipsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  legsPipsRowMini: {
    gap: 1,
  },
  legsPipsShell: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.glowPanel,
    borderColor: colors.glowGold,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  legsPipsShellCompact: {
    backgroundColor: colors.surfaces.goldTint,
    gap: 2,
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  legsPipsShellMini: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    gap: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
  liveFooterCompact: {
    minHeight: 20,
  },
  nameBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.glowCyan,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  nameBoxName: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  nameBoxStack: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  nameBoxStackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  nameRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 16,
  },
  nameRailCompact: {
    minHeight: 12,
  },
  playerName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  playerNameCompact: {
    fontSize: 10,
  },
  rightCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  revealedCardStack: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  revealedCardStackCompact: {
    gap: 0,
  },
  selfTag: {
    backgroundColor: colors.surfaces.actionTint,
    borderColor: colors.glowCyan,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selfTagCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  selfTagText: {
    color: colors.action,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  selfTagTextCompact: {
    fontSize: 8,
    letterSpacing: 0.5,
  },
  self357CardsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 39,
    overflow: 'visible',
    width: '100%',
  },
  self357AnchorBody: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  self357InfoColumn: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  self357LegsChipColumn: {
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
    minWidth: 0,
  },
  self357MetaLayout: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 2,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 104,
    minWidth: 0,
  },
  self357MetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },
  self357PlayerName: {
    flexShrink: 1,
    maxWidth: 108,
  },
  self357NameRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,
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
    borderColor: colors.glowCyan,
    borderRadius: 18,
    borderWidth: 1,
  },
  shellBottom: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  shellBottomCompact: {
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  shell357Compact: {
    backgroundColor: colors.surfaces.glowPanel,
    borderRadius: 10,
    gap: 1,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  shellAnchorChair: {
    maxWidth: 108,
    minWidth: 94,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  shellAnchorChairSelf: {
    maxWidth: 120,
    minWidth: 108,
  },
  shellSelf357Meta: {
    gap: 0,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  shellBorder357Compact: {
    borderColor: colors.surfaces.actionTint,
    borderRadius: 12,
  },
  shellDecision: {
    backgroundColor: colors.surfaces.mutedTint,
  },
  shellLive: {
    backgroundColor: colors.surfaces.glowPanel,
  },
  showdownConnector: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -2,
    maxWidth: 138,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  showdownConnectorCompact: {
    borderRadius: 999,
    marginTop: 1,
    minWidth: 72,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  showdownConnectorLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  showdownConnectorLabelCompact: {
    fontSize: 7,
    letterSpacing: 0.2,
  },
  showdownConnectorText: {
    color: colors.text,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
    textAlign: 'center',
  },
  sideIdentityWrap: {
    alignItems: 'center',
    gap: 7,
  },
  stackPlate: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.glowCyan,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stackPlateCompact: {
    borderRadius: 12,
    minWidth: 74,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  stackText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  stackTextCompact: {
    fontSize: 11,
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
    backgroundColor: colors.surfaces.actionTint,
    borderColor: colors.glowCyan,
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
    backgroundColor: colors.glowGold,
    borderRadius: 18,
  },
  wrapper: {
    position: 'relative',
    width: '100%',
  },
});
