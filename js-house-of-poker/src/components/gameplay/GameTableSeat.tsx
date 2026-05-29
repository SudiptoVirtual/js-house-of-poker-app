import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  phase: PokerPhase;
  player: PokerPlayerState;
  showdownDescription?: string | null;
  showDecisionMode?: boolean;
};

const MAX_LEG_SLOTS = 4;
const SEAT_META_BADGE_SIZE = 24;
const SELF_TABLE_SEAT_SIZE_SCALE = 0.88;
const COMPACT_357_HERO_MAX_WIDTH = 480;

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
  return Math.max(
    displayCardCount ?? 0,
    player.cardCount,
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
      backgroundColor: 'rgba(77, 46, 5, 0.96)',
      borderColor: '#FFCB6B',
      color: '#FFF5D8',
      label: 'GO WIN',
      text: showdownDescription ?? 'Winning GO hand',
    };
  }

  if (isLoser) {
    return {
      backgroundColor: 'rgba(79, 14, 36, 0.96)',
      borderColor: '#FF79B4',
      color: '#FFF0F8',
      label: 'GO LOSE',
      text: showdownDescription ?? 'Losing GO hand',
    };
  }

  return {
    backgroundColor: 'rgba(11, 70, 66, 0.96)',
    borderColor: '#4DFFD6',
    color: '#E6FFF8',
    label: 'GO SHOWDOWN',
    text: showdownDescription ?? 'Cards revealed for showdown',
  };
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
  spread = 'default',
  size,
}: {
  cards: string[];
  compact?: boolean;
  count: number;
  hidden: boolean;
  spread?: 'default' | 'wide';
  size: 'md' | 'sm';
}) {
  const wideSpread = spread === 'wide';
  const overlap = wideSpread ? 14.5 : compact ? 27 : size === 'md' ? 24 : 18;
  const angleSpread = wideSpread ? 10 : compact ? 8 : size === 'md' ? 14 : 10;
  const cardScale = wideSpread ? 0.817 : compact ? 0.74 : 1;
  const slots = Array.from({ length: count });

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
              compact && !wideSpread ? styles.cardFanSlotCompact : null,
              {
                transform: [
                  { rotate: `${rotate}deg` },
                  { translateY },
                  { scale: cardScale },
                ],
              },
            ]}
          >
            <AnimatedCard
              animateOnMount="none"
              card={card}
              hidden={hidden || !card}
              size={size}
              style={compact && !wideSpread ? styles.compactFanCard : null}
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
}: {
  compact?: boolean;
  legs: number;
}) {
  const previousLegs = useRef(legs);
  const gainPulse = useRef(new Animated.Value(0)).current;
  const visibleLegs = Math.max(0, Math.min(legs, MAX_LEG_SLOTS));

  useEffect(() => {
    if (legs > previousLegs.current) {
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
  }, [gainPulse, legs]);

  return (
    <Animated.View
      accessibilityLabel={`${legs} of ${MAX_LEG_SLOTS} legs`}
      style={[
        styles.legsPipsShell,
        compact ? styles.legsPipsShellCompact : null,
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
      <Text
        style={[
          styles.legsPipsLabel,
          compact ? styles.legsPipsLabelCompact : null,
        ]}
      >
        {visibleLegs}/{MAX_LEG_SLOTS}
      </Text>
      <View style={styles.legsPipsRow}>
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
                  color="#12091A"
                  name="check"
                  size={compact ? 6 : 7}
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
  compact357Layout = false,
  decision = null,
  displayCardCount,
  game,
  isBottomSeat = false,
  isLoser = false,
  isSelf = false,
  isWinner = false,
  legCount,
  phase,
  player,
  showdownDescription = null,
  showDecisionMode = false,
}: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const turnGlow = useRef(new Animated.Value(player.isTurn ? 0.55 : 0)).current;
  const winnerGlow = useRef(new Animated.Value(isWinner ? 0.7 : 0)).current;
  const folded = useRef(
    new Animated.Value(player.hasFolded || decision === 'STAY' ? 0.82 : 1),
  ).current;
  const cardCount = resolveCardCount(player, displayCardCount);
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
  const useCompact357Seat =
    is357Game &&
    (compact357Layout || !isSelf || viewportWidth <= COMPACT_357_HERO_MAX_WIDTH);
  const useCompactDecisionSeat =
    useCompact357Seat || (showDecisionMode && !isSelf);
  const playerName = player.name;
  const selfTag = isSelf ? 'YOU' : null;
  const tableSeatSizeScale = isSelf ? SELF_TABLE_SEAT_SIZE_SCALE : 1;
  const showQuestionBadge =
    showDecisionMode && !revealCards && !isSelf && !decision;
  const useCompactSelfSeat = isBottomSeat && isSelf;
  const useSelf357MetaLayout = useCompactSelfSeat && is357Game;
  const showSelfSideCards = isBottomSeat && isSelf && cardCount > 0;
  const bottomCardSize = useCompactSelfSeat ? 'sm' : 'md';
  const showCompactActionPill =
    useCompact357Seat &&
    (isWinner ||
      isLoser ||
      Boolean(decision) ||
      player.isTurn ||
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

  const renderAvatarStack = (avatarSize: 'md' | 'sm') => (
    <View
      style={[
        styles.seatAvatarStack,
        avatarSize === 'sm' ? styles.seatAvatarStackCompact : null,
      ]}
    >
      <PlayerAvatar
        connected={player.isConnected}
        name={player.name}
        seed={player.id}
        size={avatarSize}
      />
      <View style={styles.seatAvatarStatusBubble}>
        <PlayerStatusBadge
          compact
          showLabel={false}
          size={avatarSize === 'sm' ? SEAT_META_BADGE_SIZE : 28}
          statusTier={statusTier}
        />
      </View>
      {player.isDealer ? (
        <DealerButton
          compact
          showPulse={false}
          size={avatarSize === 'sm' ? 20 : 24}
          style={styles.seatMetaButton}
        />
      ) : null}
    </View>
  );

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
    spread: 'default' | 'wide' = 'default',
  ) => (
    <View
      style={[
        styles.revealedCardStack,
        compact ? styles.revealedCardStackCompact : null,
      ]}
    >
      <CardFan
        cards={player.holeCards}
        compact={compact}
        count={cardCount}
        hidden={cardsHidden}
        spread={spread}
        size={size}
      />
      {showShowdownConnector ? renderShowdownConnector(compact) : null}
    </View>
  );

  const bottomIdentityNode = (
    <View style={styles.bottomIdentityWrap}>
      {renderAvatarStack(useCompactSelfSeat ? 'sm' : 'md')}
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
        <LegsPips compact={useCompactSelfSeat} legs={visibleLegCount} />
      ) : null}
    </View>
  );

  const self357MetaNode = (
    <View style={styles.self357MetaLayout}>
      <View style={styles.self357NameRow}>
        <Text
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
      <View style={styles.self357MetaRow}>
        {renderAvatarStack('sm')}
        <LegsPips compact legs={visibleLegCount} />
        <View style={[styles.amountBubble, styles.amountBubbleSelfCompact]}>
          <Text
            style={[styles.amountBubbleText, styles.amountBubbleTextSelfCompact]}
          >
            ${formatChipAmount(labelAmount)}
          </Text>
        </View>
      </View>
      {cardCount > 0 ? (
        <View style={styles.self357CardsRow}>
          {renderCardFan('sm', true, 'wide')}
        </View>
      ) : null}
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
      <Animated.View
        pointerEvents="none"
        style={[styles.turnGlow, { opacity: turnGlow }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.winnerGlow, { opacity: winnerGlow }]}
      />

      {statusRibbon && !showDecisionMode && !useCompact357Seat ? (
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

      {player.isTurn && !useCompact357Seat ? (
        <TurnIndicator active style={styles.turnIndicator} />
      ) : null}

      <LinearGradient
        colors={getShellGradient(isBottomSeat, showDecisionMode, isWinner)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.shell,
          showDecisionMode ? styles.shellDecision : styles.shellLive,
          isBottomSeat ? styles.shellBottom : null,
          useCompactSelfSeat ? styles.shellBottomCompact : null,
          useCompact357Seat ? styles.shell357Compact : null,
          useSelf357MetaLayout ? styles.shellSelf357Meta : null,
        ]}
      >
        <View
          style={[
            styles.shellBorder,
            useCompact357Seat ? styles.shellBorder357Compact : null,
          ]}
        />

        {!useSelf357MetaLayout &&
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

        {useSelf357MetaLayout ? (
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
              {renderAvatarStack('sm')}
              <View
                style={[
                  styles.compactNameStack,
                  align === 'right' ? styles.compactNameStackRight : null,
                ]}
              >
                <Text numberOfLines={1} style={styles.compactName}>
                  {player.name}
                </Text>
                <View style={styles.compactStackLegsRow}>
                  <Text numberOfLines={1} style={styles.compactStackText}>
                    {formatChipAmount(player.chips)}
                  </Text>
                  <LegsPips compact legs={visibleLegCount} />
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
                {showQuestionBadge ? (
                  <View
                    style={[
                      styles.compactQuestionBadge,
                      align === 'right'
                        ? styles.compactQuestionBadgeLeft
                        : null,
                    ]}
                  >
                    <MaterialCommunityIcons
                      color="#F6F2FF"
                      name="help"
                      size={12}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            <View
              style={[
                styles.compactDecisionRail,
                align === 'right' ? styles.compactDecisionRailRight : null,
              ]}
            >
              <View style={styles.compactAmountBubble}>
                <Text style={styles.compactAmountBubbleText}>
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
                          <LegsPips compact legs={visibleLegCount} />
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

        {useCompactDecisionSeat && !useSelf357MetaLayout ? null : showDecisionMode ? (
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
                  useCompactSelfSeat ? styles.amountBubbleSelfCompact : null,
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
        )}

        {showQuestionBadge && !useCompactDecisionSeat ? (
          <View
            style={[
              styles.questionBadge,
              align === 'right' ? styles.questionBadgeLeft : null,
            ]}
          >
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
  amountBubbleSelfCompact: {
    borderRadius: 999,
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  amountBubbleText: {
    color: '#FFF6FB',
    fontSize: 12,
    fontWeight: '800',
  },
  amountBubbleTextSelfCompact: {
    fontSize: 10,
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
  seatAvatarStatusBubble: {
    bottom: -5,
    position: 'absolute',
    right: -4,
    zIndex: 4,
  },
  seatMetaButton: {
    bottom: -3,
    flexShrink: 0,
    left: -3,
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
  compactAmountBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 16, 0.72)',
    borderColor: 'rgba(255, 139, 210, 0.22)',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 38,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  compactAmountBubbleText: {
    color: '#FFF6FB',
    fontSize: 9,
    fontWeight: '900',
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
  compactDecisionRail: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    marginTop: -2,
  },
  compactDecisionRailRight: {
    justifyContent: 'center',
  },
  compactDecisionSeat: {
    gap: 1,
    minHeight: 48,
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
    height: 34,
    justifyContent: 'center',
    marginTop: -6,
    position: 'relative',
    width: 92,
  },
  compactFanWrapRight: {
    alignSelf: 'center',
  },
  compactIdentityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-start',
  },
  compactIdentityRowRight: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-end',
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
  compactStackLegsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 999,
    borderWidth: 1,
    height: 12,
    justifyContent: 'center',
    width: 12,
  },
  legsPipCompact: {
    height: 9,
    width: 9,
  },
  legsPipFilled: {
    backgroundColor: '#FFCB6B',
    borderColor: 'rgba(255, 245, 216, 0.88)',
  },
  legsPipsLabel: {
    color: 'rgba(255, 245, 216, 0.74)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  legsPipsLabelCompact: {
    fontSize: 7,
  },
  legsPipsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  legsPipsShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderColor: 'rgba(255, 203, 107, 0.16)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  legsPipsShellCompact: {
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
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
    color: '#F7F4FF',
    fontSize: 12,
    fontWeight: '700',
  },
  playerNameCompact: {
    fontSize: 10,
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
  revealedCardStack: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  revealedCardStackCompact: {
    gap: 0,
  },
  selfTag: {
    backgroundColor: 'rgba(103, 237, 255, 0.18)',
    borderColor: 'rgba(103, 237, 255, 0.4)',
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
    color: '#C9FCFF',
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
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  self357MetaLayout: {
    alignItems: 'flex-end',
    alignSelf: 'center',
    gap: 4,
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 0,
  },
  self357MetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
    maxWidth: '100%',
    minWidth: 0,
  },
  self357PlayerName: {
    flexShrink: 1,
    maxWidth: 108,
  },
  self357NameRow: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
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
    borderColor: 'rgba(209, 110, 255, 0.22)',
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
    backgroundColor: 'rgba(7, 6, 13, 0.42)',
    borderRadius: 12,
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  shellSelf357Meta: {
    gap: 4,
    paddingHorizontal: 3,
    paddingVertical: 8,
  },
  shellBorder357Compact: {
    borderColor: 'rgba(209, 110, 255, 0.12)',
    borderRadius: 12,
  },
  shellDecision: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  shellLive: {
    backgroundColor: 'rgba(0,0,0,0.12)',
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
    bottom: -10,
    minWidth: 72,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
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
    color: 'rgba(255,255,255,0.86)',
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
    backgroundColor: 'rgba(8, 8, 14, 0.96)',
    borderColor: 'rgba(196, 119, 255, 0.24)',
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
    color: '#F4F1FF',
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
