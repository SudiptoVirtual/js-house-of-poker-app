import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AnimatedChipStack } from '../AnimatedChipStack';
import { CardFlight } from '../CardFlight';
import { ChipFlight } from '../ChipFlight';
import { PlayerActionBurst } from '../PlayerActionBurst';
import { TableCenterBoard } from '../TableCenterBoard';
import type { Poker357Decision, PokerRoomState } from '../../types/poker';
import type { Point, SeatDescriptor } from '../../utils/pokerTable';
import type { CardSize } from '../AnimatedCard';
import { GameTableSeat } from './GameTableSeat';
import { ThreeFiveSevenCenterBoard } from './ThreeFiveSevenCenterBoard';

type SeatBurstSpec = {
  id: string;
  label: string;
  playerId: string;
  tone: 'accent' | 'danger' | 'neutral' | 'primary';
};

type CardFlightSpec = {
  card?: string;
  delay?: number;
  destination: Point;
  hidden?: boolean;
  id: string;
  origin: Point;
  size?: CardSize;
};

type ChipFlightSpec = {
  amount: number;
  delay?: number;
  destination: Point;
  id: string;
  origin: Point;
  tone?: 'bet' | 'pot' | 'stack';
};

type Props = {
  ambientA: Animated.Value;
  ambientB: Animated.Value;
  boardCardSize: CardSize;
  boardHeight: number;
  boardTop: number;
  boardWidth: number;
  cardFlights: CardFlightSpec[];
  chipFlights: ChipFlightSpec[];
  dealtCards: Record<string, number>;
  focusMode?: boolean;
  headlineText: string;
  leftPanelGap?: number;
  leftPanelNode?: ReactNode;
  leftPanelWidth?: number;
  onLayout: (event: any) => void;
  onPressTable: () => void;
  phaseTitle: string;
  seatBursts: SeatBurstSpec[];
  seatDescriptors: SeatDescriptor[];
  seatMap: Map<string, SeatDescriptor>;
  selfId: string | null;
  state: PokerRoomState;
  tablePan: Animated.ValueXY;
  tablePanHandlers: object;
  tableViewZoom: number;
  threeFiveSevenPreview?: {
    revealedDecisions: Record<string, Poker357Decision>;
    revealState: 'revealed' | 'resolved';
  } | null;
  visibleCommunityCount: number;
  winnerIds: string[];
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function TableSurface({
  ambientA,
  ambientB,
  boardCardSize,
  boardHeight,
  boardTop,
  boardWidth,
  cardFlights,
  chipFlights,
  focusMode = false,
  headlineText,
  leftPanelGap = 0,
  leftPanelNode = null,
  leftPanelWidth,
  onLayout,
  onPressTable,
  phaseTitle,
  seatBursts,
  seatDescriptors,
  seatMap,
  selfId,
  state,
  tablePan,
  tablePanHandlers,
  tableViewZoom,
  threeFiveSevenPreview = null,
  visibleCommunityCount,
  width,
  winnerIds,
  height,
}: Props) {
  const is357 = state.gameSettings.game === '357' && Boolean(state.threeFiveSeven);
  const revealState = is357
    ? threeFiveSevenPreview?.revealState ?? state.threeFiveSeven?.revealState ?? 'hidden'
    : 'hidden';
  const revealedDecisions = is357
    ? threeFiveSevenPreview?.revealedDecisions ?? {}
    : {};
  const showDecisionMode =
    is357 &&
    (state.phase === 'decide_3' || state.phase === 'decide_5' || state.phase === 'decide_7');
  const resolvedLeftPanelWidth = leftPanelNode
    ? leftPanelWidth ?? clamp(width * 0.24, 220, 320)
    : 0;
  const resolvedLeftPanelGap = leftPanelNode
    ? leftPanelGap || clamp(width * 0.012, 12, 24)
    : 0;
  const viewportWidth = width + resolvedLeftPanelWidth + resolvedLeftPanelGap;

  return (
    <View style={[styles.tableViewport, { height, width: viewportWidth }]}>
      {leftPanelNode ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.leftPanelSlot,
            {
              marginRight: resolvedLeftPanelGap,
              width: resolvedLeftPanelWidth,
            },
          ]}
        >
          {leftPanelNode}
        </View>
      ) : null}

      <Pressable onPress={onPressTable} style={[styles.tablePressable, { width }]}>
        <View onLayout={onLayout} style={[styles.tableSurface, { height }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tableHalo,
              {
                opacity: ambientA.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0.9],
                }),
              },
            ]}
          />
          <LinearGradient
            colors={['rgba(99,24,176,0.98)', 'rgba(54,13,103,0.98)', 'rgba(22,8,43,0.99)']}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.tableOuter, focusMode ? styles.tableViewportFocused : null]}
          >
            <View style={styles.tableRail}>
              <LinearGradient
                colors={['#14051F', '#0A0415', '#05030B']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={styles.tableFelt}
              >
                <Animated.View
                  style={{
                    flex: 1,
                    transform: [{ translateX: tablePan.x }, { translateY: tablePan.y }, { scale: tableViewZoom }],
                  }}
                  {...tablePanHandlers}
                >
                  <Animated.View pointerEvents="none" style={[styles.feltGlowA, { opacity: ambientA }]} />
                  <Animated.View pointerEvents="none" style={[styles.feltGlowB, { opacity: ambientB }]} />
                  <View style={styles.tableInnerCore} />
                  <View style={styles.innerRingOuter} />
                  <View style={styles.innerRingInner} />
                  <View style={styles.centerAura} />

                  <View pointerEvents="none" style={styles.brandWatermark}>
                    <Text style={styles.brandWatermarkText}>HOUSE OF POKER</Text>
                  </View>

                  <View
                    style={[
                      styles.centerBoardZone,
                      {
                        left: width / 2 - boardWidth / 2,
                        minHeight: boardHeight,
                        top: boardTop,
                        width: boardWidth,
                      },
                    ]}
                  >
                    {is357 ? (
                      <ThreeFiveSevenCenterBoard state={state} statusText={headlineText} />
                    ) : (
                      <TableCenterBoard
                        cardSize={boardCardSize}
                        cards={state.communityCards}
                        currentBet={state.currentBet}
                        handNumber={state.handNumber}
                        phase={state.phase}
                        phaseTitle={phaseTitle}
                        pot={state.pot}
                        statusMessage={state.statusMessage}
                        visibleCount={visibleCommunityCount}
                        winnerSummary={state.phase === 'completed' ? state.lastWinnerSummary : null}
                      />
                    )}
                  </View>
                </Animated.View>
              </LinearGradient>
            </View>
          </LinearGradient>

          <View pointerEvents="box-none" style={styles.overlayLayer}>
            {seatDescriptors.map((descriptor) => {
              const isSelf = descriptor.player.id === selfId;
              const isWinner = winnerIds.includes(descriptor.player.id);
              const decision =
                is357 && revealState !== 'hidden'
                  ? revealedDecisions[descriptor.player.id] ?? descriptor.player.revealedDecision
                  : null;
              const seatZIndex = isSelf ? 16 : descriptor.isBottomSeat ? 12 : 8;
              const decisionModeHeroNudge = showDecisionMode && isSelf ? -8 : 0;

              return (
                <View
                  key={descriptor.player.id}
                  pointerEvents="box-none"
                  style={[
                    styles.seatAnchor,
                    descriptor.isBottomSeat ? styles.bottomSeatAnchor : null,
                    showDecisionMode && !isSelf ? styles.compactDecisionSeatAnchor : null,
                    {
                      height: descriptor.height,
                      left: descriptor.center.x - descriptor.width / 2,
                      top: descriptor.center.y - descriptor.height / 2 + decisionModeHeroNudge,
                      width: descriptor.width,
                      zIndex: seatZIndex,
                    },
                  ]}
                >
                  {is357 ? (
                    <GameTableSeat
                      align={descriptor.align}
                      anteAmount={state.threeFiveSeven?.anteAmount ?? 0}
                      decision={decision}
                      displayCardCount={descriptor.player.cardCount}
                      game={state.gameSettings.game}
                      isBottomSeat={descriptor.isBottomSeat}
                      isSelf={isSelf}
                      isWinner={isWinner}
                      phase={state.phase}
                      player={descriptor.player}
                      showDecisionMode={showDecisionMode}
                    />
                  ) : (
                    <GameTableSeat
                      align={descriptor.align}
                      displayCardCount={descriptor.player.cardCount}
                      game={state.gameSettings.game}
                      isBottomSeat={descriptor.isBottomSeat}
                      isSelf={isSelf}
                      isWinner={isWinner}
                      phase={state.phase}
                      player={descriptor.player}
                    />
                  )}
                </View>
              );
            })}

            {!showDecisionMode
              ? seatDescriptors.map((descriptor) => {
                  if (descriptor.player.betThisRound <= 0) {
                    return null;
                  }

                  return (
                    <View
                      key={`bet-${descriptor.player.id}`}
                      pointerEvents="none"
                      style={[
                        styles.betSpot,
                        {
                          left: descriptor.betCenter.x - 36,
                          top: descriptor.betCenter.y - 18,
                        },
                      ]}
                    >
                      <AnimatedChipStack
                        amount={descriptor.player.betThisRound}
                        highlighted={descriptor.player.isTurn}
                        size="sm"
                        tone="bet"
                      />
                    </View>
                  );
                })
              : null}

            {seatBursts.map((burst) => {
              const descriptor = seatMap.get(burst.playerId);
              if (!descriptor) {
                return null;
              }

              return (
                <View
                  key={burst.id}
                  pointerEvents="none"
                  style={[
                    styles.burstSlot,
                    {
                      left: descriptor.center.x - 58,
                      top: descriptor.center.y - descriptor.height / 2 - (descriptor.isBottomSeat ? 34 : 28),
                    },
                  ]}
                >
                  <PlayerActionBurst label={burst.label} tone={burst.tone} />
                </View>
              );
            })}

            {cardFlights.map((flight) => (
              <CardFlight key={flight.id} {...flight} />
            ))}

            {chipFlights.map((flight) => (
              <ChipFlight key={flight.id} {...flight} />
            ))}
          </View>
        </View>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  betSpot: {
    alignItems: 'center',
    minHeight: 36,
    minWidth: 72,
    position: 'absolute',
    zIndex: 10,
  },
  bottomSeatAnchor: {
    zIndex: 12,
  },
  brandWatermark: {
    alignItems: 'center',
    left: 0,
    opacity: 0.08,
    position: 'absolute',
    right: 0,
    top: '44%',
    zIndex: 1,
  },
  brandWatermarkText: {
    color: '#7A39CA',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
  burstSlot: {
    alignItems: 'center',
    position: 'absolute',
    width: 116,
    zIndex: 18,
  },
  centerBoardZone: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 6,
  },
  compactDecisionSeatAnchor: {
    zIndex: 9,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 12,
  },
  leftPanelSlot: {
    alignSelf: 'stretch',
    flexShrink: 0,
    justifyContent: 'center',
    zIndex: 34,
  },
  feltGlowA: {
    backgroundColor: 'rgba(209, 88, 255, 0.15)',
    borderRadius: 999,
    height: 240,
    left: 52,
    position: 'absolute',
    top: 46,
    width: 240,
  },
  feltGlowB: {
    backgroundColor: 'rgba(58, 182, 255, 0.12)',
    borderRadius: 999,
    bottom: 58,
    height: 250,
    position: 'absolute',
    right: 62,
    width: 250,
  },
  innerRingInner: {
    borderColor: 'rgba(192, 78, 255, 0.48)',
    borderRadius: 999,
    borderWidth: 2,
    bottom: '12%',
    left: '6%',
    position: 'absolute',
    right: '6%',
    top: '12%',
  },
  innerRingOuter: {
    borderColor: 'rgba(143, 42, 226, 0.64)',
    borderRadius: 999,
    borderWidth: 3,
    bottom: '8%',
    left: '3%',
    position: 'absolute',
    right: '3%',
    top: '8%',
  },
  seatAnchor: {
    position: 'absolute',
    zIndex: 8,
  },
  tableFelt: {
    borderRadius: 999,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tableHalo: {
    backgroundColor: 'rgba(154, 58, 255, 0.18)',
    borderRadius: 999,
    bottom: -8,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 16,
  },
  tableInnerCore: {
    backgroundColor: 'rgba(11, 7, 17, 0.96)',
    borderRadius: 999,
    bottom: '12%',
    left: '5%',
    position: 'absolute',
    right: '5%',
    top: '12%',
  },
  tableOuter: {
    borderRadius: 999,
    flex: 1,
    padding: 2,
  },
  tableRail: {
    backgroundColor: '#09050F',
    borderColor: 'rgba(204, 77, 255, 0.48)',
    borderRadius: 999,
    borderWidth: 2,
    flex: 1,
    padding: 2,
  },
  tableSurface: {
    overflow: 'visible',
    justifyContent: 'center',
    position: 'relative',
  },
  tablePressable: {
    flexShrink: 0,
  },
  tableViewport: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  tableViewportFocused: {
    shadowColor: '#B44DFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
  },
  centerAura: {
    backgroundColor: 'rgba(114, 26, 177, 0.06)',
    borderRadius: 999,
    bottom: '23%',
    left: '22%',
    position: 'absolute',
    right: '22%',
    top: '23%',
  },
});
