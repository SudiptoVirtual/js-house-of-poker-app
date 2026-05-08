import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../components/ActionButton';
import type { CardSize } from '../components/AnimatedCard';
import { GameplayLayout } from '../components/gameplay/GameplayLayout';
import { GameplayFooter } from '../components/gameplay/GameplayFooter';
import { HeroActionSection } from '../components/gameplay/HeroActionSection';
import { gameplayLayoutConfig } from '../components/gameplay/layoutConfig';
import { TableSurface } from '../components/gameplay/TableSurface';
import { TableChatBar } from '../components/gameplay/TableChatBar';
import { ThreeFiveSevenActionPanel } from '../components/gameplay/ThreeFiveSevenActionPanel';
import { usePoker } from '../context/PokerProvider';
import { useGameplayAnimations } from '../hooks/useGameplayAnimations';
import { routes } from '../constants/routes';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';
import type { Poker357Decision, PokerAction, PokerRoomState } from '../types/poker';
import {
  buildSeatDescriptors,
  getPhaseTitle,
  orderPlayersForTable,
  type Point,
} from '../utils/pokerTable';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

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

type SeatBurstSpec = {
  id: string;
  label: string;
  playerId: string;
  tone: 'accent' | 'danger' | 'neutral' | 'primary';
};

type ShowdownBannerState = {
  id: number;
  tone: 'showdown' | 'winner';
  text: string;
};

type ThreeFiveSevenRevealPreview = {
  id: string;
  revealedDecisions: Record<string, Poker357Decision>;
  revealState: 'resolved';
  summaryText: string;
  winnerIds: string[];
};

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

function fitAspectBox(maxWidth: number, maxHeight: number, aspectRatio: number) {
  const safeWidth = Math.max(0, maxWidth);
  const safeHeight = Math.max(0, maxHeight);

  if (safeWidth === 0 || safeHeight === 0) {
    return { height: 0, width: 0 };
  }

  let width = safeWidth;
  let height = width / aspectRatio;

  if (height > safeHeight) {
    height = safeHeight;
    width = height * aspectRatio;
  }

  return { height, width };
}

function RoundWildsBadge({ label }: { label: string }) {
  return (
    <View style={styles.roundWildsBadge}>
      <Text style={styles.roundWildsKicker}>ROUND WILDS</Text>
      <Text numberOfLines={1} style={styles.roundWildsText}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function shouldShowSeatCards(player: PokerRoomState['players'][number], state: PokerRoomState) {
  if (state.phase === 'waiting') {
    return false;
  }

  return (
    player.holeCards.length > 0 ||
    player.totalContribution > 0 ||
    player.hasFolded ||
    player.isAllIn ||
    player.isDealer ||
    player.isSmallBlind ||
    player.isBigBlind ||
    player.isTurn ||
    (state.phase !== 'completed' && player.chips > 0 && player.isConnected)
  );
}

function buildInitialDealtCards(state: PokerRoomState) {
  return Object.fromEntries(
    state.players.map((player) => [
      player.id,
      shouldShowSeatCards(player, state) ? 2 : 0,
    ]),
  ) as Record<string, number>;
}

function buildQuickRaiseOptions(state: PokerRoomState) {
  const { controls, bigBlind, currentBet, pot } = state;
  if (
    !controls.canAct ||
    (!controls.availableActions.includes('bet') &&
      !controls.availableActions.includes('raise'))
  ) {
    return [];
  }

  const increment = Math.max(5, Math.floor(bigBlind / 2));
  const minTarget = controls.minRaiseTo;
  const maxTarget = controls.maxRaiseTo;
  const pressureTarget =
    currentBet === 0
      ? Math.max(minTarget, bigBlind * 3)
      : Math.max(minTarget, currentBet * 2 + bigBlind);
  const potTarget =
    currentBet === 0
      ? Math.max(minTarget, Math.max(bigBlind * 4, Math.floor(pot * 0.65)))
      : Math.max(minTarget, currentBet + pot);

  const options = [
    { label: 'Min', value: minTarget },
    {
      label: 'Pressure',
      value: clamp(roundToIncrement(pressureTarget, increment), minTarget, maxTarget),
    },
    {
      label: 'Pot',
      value: clamp(roundToIncrement(potTarget, increment), minTarget, maxTarget),
    },
    { label: 'Jam', value: maxTarget },
  ];

  const seen = new Set<number>();
  return options.filter((option) => {
    if (seen.has(option.value)) {
      return false;
    }

    seen.add(option.value);
    return true;
  });
}

function parseSeatBurst(
  logEntry: string | undefined,
  players: PokerRoomState['players'],
): Omit<SeatBurstSpec, 'id'> | null {
  if (!logEntry || /opened room/i.test(logEntry)) {
    return null;
  }

  const player = players.find(
    (candidate) =>
      logEntry.startsWith(`${candidate.name} `) ||
      logEntry.startsWith(`${candidate.name} wins`),
  );
  if (!player) {
    return null;
  }

  let label = 'Action';
  let tone: SeatBurstSpec['tone'] = 'neutral';

  if (/ folded\./i.test(logEntry)) {
    label = 'Fold';
    tone = 'danger';
  } else if (/ checked\./i.test(logEntry)) {
    label = 'Check';
    tone = 'primary';
  } else if (/ called all-in for (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/called all-in for (\d+)/i)?.[1];
    label = `Call AI ${amount}`;
    tone = 'accent';
  } else if (/ called (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/called (\d+)/i)?.[1];
    label = `Call ${amount}`;
    tone = 'primary';
  } else if (/ bet (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/bet (\d+)/i)?.[1];
    label = `Bet ${amount}`;
    tone = 'accent';
  } else if (/ raised to (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/raised to (\d+)/i)?.[1];
    label = `Raise ${amount}`;
    tone = 'accent';
  } else if (/ moved all-in for (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/moved all-in for (\d+)/i)?.[1];
    label = `All-in ${amount}`;
    tone = 'accent';
  } else if (/ wins (\d+)/i.test(logEntry)) {
    const amount = logEntry.match(/wins (\d+)/i)?.[1];
    label = amount ? `Wins ${amount}` : 'Wins pot';
    tone = 'accent';
  }

  return {
    label,
    playerId: player.id,
    tone,
  };
}

export function GameScreen({ navigation }: Props) {
  const {
    connection,
    errorMessage,
    rebuy,
    roomState,
    sendAction,
    sendTableChatMessage,
    startHand,
    transportLabel,
    transportStatus,
  } = usePoker();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const [raiseTo, setRaiseTo] = useState('');
  const [dealtCards, setDealtCards] = useState<Record<string, number>>({});
  const [visibleCommunityCount, setVisibleCommunityCount] = useState(0);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [cardFlights, setCardFlights] = useState<CardFlightSpec[]>([]);
  const [chipFlights, setChipFlights] = useState<ChipFlightSpec[]>([]);
  const [seatBursts, setSeatBursts] = useState<SeatBurstSpec[]>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showdownBanner, setShowdownBanner] = useState<ShowdownBannerState | null>(null);
  const [threeFiveSevenRevealPreview, setThreeFiveSevenRevealPreview] =
    useState<ThreeFiveSevenRevealPreview | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const previousRoomRef = useRef<PokerRoomState | null>(null);
  const animationQueueRef = useRef(Promise.resolve());
  const latest357ResolutionKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setClockNow(Date.now());
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!roomState?.roomId) {
      setRaiseTo('');
      setPendingAction(null);
      setThreeFiveSevenRevealPreview(null);
      latest357ResolutionKeyRef.current = null;
    }
  }, [roomState?.roomId]);

  useEffect(() => {
    setPendingAction(null);
  }, [
    errorMessage,
    roomState?.actionLog[0],
    roomState?.currentTurnPlayerId,
    roomState?.phase,
    roomState?.pot,
    roomState?.updatedAt,
  ]);

  useEffect(() => {
    if (!roomState?.controls.canAct) {
      return;
    }

    if (roomState.controls.minRaiseTo > 0) {
      setRaiseTo(String(roomState.controls.minRaiseTo));
    }
  }, [roomState?.controls.canAct, roomState?.controls.minRaiseTo]);

  const activeState = roomState ?? null;
  const tableState = activeState;
  const is357Table = tableState?.gameSettings.game === '357';
  const tableAspectRatio = isLandscape
    ? gameplayLayoutConfig.table.aspectRatioLandscape
    : gameplayLayoutConfig.table.aspectRatio;
  const layoutSideGap = clamp(windowWidth * 0.008, 8, 16);
  const estimatedFooterHeight = isLandscape ? 38 : 50;
  const estimatedTopInset = Math.max(2, insets.top ? 0 : 4);
  const estimatedTopBarHeight = isLandscape
    ? clamp(windowHeight * 0.074, 58, 78)
    : clamp(windowHeight * 0.16, 94, 144);
  const estimatedActionHeight = isLandscape
    ? clamp(windowHeight * 0.112, 88, 118)
    : clamp(windowHeight * 0.19, 126, 174);
  const estimatedActionBottom = estimatedFooterHeight + Math.max(4, insets.bottom ? 0 : 4);
  const reservedVerticalSpace = isLandscape
    ? estimatedTopInset + estimatedTopBarHeight + 4 + estimatedActionBottom + estimatedActionHeight + 4
    : estimatedTopBarHeight * 0.84 + estimatedActionBottom + estimatedActionHeight * 0.62;
  const reservedHorizontalSpace = isLandscape
    ? layoutSideGap * 2 + insets.left + insets.right
    : Math.max(18, insets.left + insets.right + 18);
  const maxTableWidth = isLandscape
    ? Math.max(gameplayLayoutConfig.table.maxWidthLandscape, windowWidth - reservedHorizontalSpace)
    : gameplayLayoutConfig.table.maxWidthPortrait;
  const tableBox = fitAspectBox(
    Math.min(maxTableWidth, windowWidth - reservedHorizontalSpace),
    windowHeight - insets.top - insets.bottom - reservedVerticalSpace,
    tableAspectRatio,
  );
  const tableWidth = Math.max(
    isLandscape ? gameplayLayoutConfig.table.minWidth : 280,
    tableBox.width,
  );
  const tableHeight = Math.max(
    isLandscape ? gameplayLayoutConfig.table.minHeight : 188,
    tableBox.height,
  );
  const heroZoneCompact = windowWidth < gameplayLayoutConfig.breakpoints.heroZoneCompact;
  const tableViewZoom = 1;
  const {
    ambientA,
    ambientB,
    animateShowdownBanner,
    handleTableLayout,
    showdownProgress,
    tableLayout,
    tablePan,
    tablePanResponder,
  } = useGameplayAnimations({
    isLandscape,
    onShowdownBannerEnd: () => setShowdownBanner(null),
    tableViewZoom,
  });
  const displayTableWidth = tableWidth;
  const displayTableHeight = tableHeight;

  useEffect(() => {
    animateShowdownBanner(Boolean(showdownBanner));
  }, [animateShowdownBanner, showdownBanner]);

  const orderedPlayers = useMemo(
    () =>
      tableState
        ? orderPlayersForTable(tableState.players, tableState.selfId)
        : [],
    [tableState],
  );

  const fallbackLayout = useMemo(
    () => ({ height: displayTableHeight, width: displayTableWidth }),
    [displayTableHeight, displayTableWidth],
  );
  const resolvedLayout =
    tableLayout.width > 0 && tableLayout.height > 0 ? tableLayout : fallbackLayout;
  const seatDescriptors = useMemo(
    () =>
      buildSeatDescriptors(
        orderedPlayers,
        resolvedLayout.width,
        resolvedLayout.height,
      ),
    [orderedPlayers, resolvedLayout.height, resolvedLayout.width],
  );
  const seatMap = useMemo(
    () => new Map(seatDescriptors.map((descriptor) => [descriptor.player.id, descriptor])),
    [seatDescriptors],
  );

  const boardCardSize: CardSize =
    resolvedLayout.width < 430 ? 'sm' : resolvedLayout.width > 760 ? 'lg' : 'md';
  const boardCardWidth =
    boardCardSize === 'sm' ? 48 : boardCardSize === 'lg' ? 68 : 58;
  const boardCardHeight =
    boardCardSize === 'sm' ? 66 : boardCardSize === 'lg' ? 94 : 80;
  const boardGap = 6;
  const boardWidth = is357Table
    ? clamp(Math.floor(resolvedLayout.width * 0.44), 272, 360)
    : boardCardWidth * 5 + boardGap * 4;
  const boardCardTop =
    boardCardSize === 'sm' ? 46 : boardCardSize === 'lg' ? 54 : 50;
  const boardHeight = is357Table
    ? boardCardSize === 'lg'
      ? 244
      : boardCardSize === 'sm'
        ? 214
        : 228
    : boardCardTop + boardCardHeight + 32;
  const boardLeft = resolvedLayout.width / 2 - boardWidth / 2;
  const boardTop = clamp(
    resolvedLayout.height * (is357Table ? 0.18 : boardCardSize === 'lg' ? 0.2 : 0.22),
    is357Table ? 34 : 44,
    resolvedLayout.height * (is357Table ? 0.24 : 0.28),
  );

  const communityPoints = useMemo(() => {
    const firstCenterX = boardLeft + boardCardWidth / 2;

    return Array.from({ length: 5 }).map((_, index) => ({
      x: firstCenterX + index * (boardCardWidth + boardGap),
      y: boardTop + boardCardTop + boardCardHeight / 2,
    }));
  }, [boardCardHeight, boardCardTop, boardCardWidth, boardLeft, boardTop]);

  const potCenter = useMemo<Point>(
    () => ({
      x: resolvedLayout.width / 2,
      y: boardTop + 18,
    }),
    [boardTop, resolvedLayout.width],
  );
  const deckOrigin = useMemo<Point>(
    () => ({
      x: Math.max(48, boardLeft - 28),
      y: boardTop + boardCardTop + boardCardHeight / 2,
    }),
    [boardCardHeight, boardCardTop, boardLeft, boardTop],
  );
  const tableReady = seatDescriptors.length === orderedPlayers.length && orderedPlayers.length > 0;

  function schedule(callback: () => void, delay: number) {
    const timeoutId = setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      if (mountedRef.current) {
        callback();
      }
    }, delay);

    timeoutsRef.current.add(timeoutId);
  }

  function queueAnimation(task: () => Promise<void>) {
    animationQueueRef.current = animationQueueRef.current
      .catch(() => undefined)
      .then(task);
  }

  function removeCardFlight(id: string) {
    setCardFlights((current) => current.filter((flight) => flight.id !== id));
  }

  function removeChipFlight(id: string) {
    setChipFlights((current) => current.filter((flight) => flight.id !== id));
  }

  function removeSeatBurst(id: string) {
    setSeatBursts((current) => current.filter((burst) => burst.id !== id));
  }

  function addSeatBurst(spec: Omit<SeatBurstSpec, 'id'>) {
    const id = `seat-burst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSeatBursts((current) => [...current, { ...spec, id }]);
    schedule(() => removeSeatBurst(id), 1100);
  }

  async function runCardFlights(specs: Array<Omit<CardFlightSpec, 'id'>>) {
    if (specs.length === 0 || !mountedRef.current) {
      return;
    }

    const flights = specs.map((spec, index) => ({
      ...spec,
      id: `card-flight-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    const maxDuration = flights.reduce(
      (current, flight) => Math.max(current, (flight.delay ?? 0) + 420),
      0,
    );

    setCardFlights((current) => [...current, ...flights]);
    flights.forEach((flight) => {
      schedule(() => removeCardFlight(flight.id), (flight.delay ?? 0) + 450);
    });
    await wait(maxDuration + 40);
  }

  async function runChipFlights(specs: Array<Omit<ChipFlightSpec, 'id'>>) {
    if (specs.length === 0 || !mountedRef.current) {
      return;
    }

    const flights = specs.map((spec, index) => ({
      ...spec,
      id: `chip-flight-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    }));
    const maxDuration = flights.reduce(
      (current, flight) => Math.max(current, (flight.delay ?? 0) + 360),
      0,
    );

    setChipFlights((current) => [...current, ...flights]);
    flights.forEach((flight) => {
      schedule(() => removeChipFlight(flight.id), (flight.delay ?? 0) + 390);
    });
    await wait(maxDuration + 36);
  }

  function initializeVisualState(state: PokerRoomState) {
    setCardFlights([]);
    setChipFlights([]);
    setSeatBursts([]);
    setDealtCards(buildInitialDealtCards(state));
    setVisibleCommunityCount(state.communityCards.length);
    setWinnerIds([]);
  }

  useEffect(() => {
    if (!tableState?.roomId || tableState.gameSettings.game !== '357') {
      latest357ResolutionKeyRef.current = null;
      setThreeFiveSevenRevealPreview(null);
      return;
    }

    const resolution = tableState.threeFiveSeven?.lastResolution;
    if (!resolution) {
      latest357ResolutionKeyRef.current = '';
      return;
    }

    const resolutionKey = `${tableState.roomId}:${resolution.handNumber}:${resolution.winnerIds.join(',')}:${Object.entries(
      resolution.revealedDecisions,
    )
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .map(([playerId, decision]) => `${playerId}:${decision}`)
      .join('|')}`;

    if (latest357ResolutionKeyRef.current == null) {
      latest357ResolutionKeyRef.current = resolutionKey;
      return;
    }

    if (latest357ResolutionKeyRef.current === resolutionKey) {
      return;
    }

    latest357ResolutionKeyRef.current = resolutionKey;
    setThreeFiveSevenRevealPreview({
      id: resolutionKey,
      revealedDecisions: { ...resolution.revealedDecisions },
      revealState: 'resolved',
      summaryText: tableState.lastWinnerSummary ?? '357 resolved.',
      winnerIds: [...resolution.winnerIds],
    });

    const timeoutId = setTimeout(() => {
      timeoutsRef.current.delete(timeoutId);
      setThreeFiveSevenRevealPreview((current) =>
        current?.id === resolutionKey ? null : current,
      );
    }, 1900);

    timeoutsRef.current.add(timeoutId);

    return () => {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(timeoutId);
    };
  }, [tableState]);

  useEffect(() => {
    if (!tableState?.roomId) {
      previousRoomRef.current = null;
      setDealtCards({});
      setVisibleCommunityCount(0);
      setWinnerIds([]);
      setCardFlights([]);
      setChipFlights([]);
      setSeatBursts([]);
      return;
    }

    if (!tableReady) {
      if (
        !previousRoomRef.current ||
        previousRoomRef.current.roomId !== tableState.roomId
      ) {
        initializeVisualState(tableState);
        previousRoomRef.current = tableState;
      }
      return;
    }

    const previous = previousRoomRef.current;
    previousRoomRef.current = tableState;

    if (!previous || previous.roomId !== tableState.roomId) {
      initializeVisualState(tableState);
      return;
    }

    queueAnimation(async () => {
      if (!mountedRef.current) {
        return;
      }

      const previousPlayers = new Map(
        previous.players.map((player) => [player.id, player]),
      );
      const currentPlayers = new Map(
        tableState.players.map((player) => [player.id, player]),
      );
      const latestAction = tableState.actionLog[0];

      if (latestAction && latestAction !== previous.actionLog[0]) {
        const burst = parseSeatBurst(latestAction, tableState.players);
        if (burst) {
          addSeatBurst(burst);
        }
      }

      if (
        tableState.handNumber !== previous.handNumber &&
        tableState.phase === 'preflop'
      ) {
        setWinnerIds([]);
        setVisibleCommunityCount(0);
        setDealtCards(
          Object.fromEntries(
            tableState.players.map((player) => [player.id, 0]),
          ) as Record<string, number>,
        );

        const blindFlights = orderedPlayers.flatMap((player, index) => {
          const descriptor = seatMap.get(player.id);
          if (!descriptor || player.betThisRound <= 0) {
            return [];
          }

          return [
            {
              amount: player.betThisRound,
              delay: index * 90,
              destination: descriptor.betCenter,
              origin: descriptor.center,
              tone: 'bet' as const,
            },
          ];
        });

        await runChipFlights(blindFlights);

        const participants = orderedPlayers.filter((player) =>
          shouldShowSeatCards(player, tableState),
        );
        const dealFlights = participants.flatMap((player, playerIndex) => {
          const descriptor = seatMap.get(player.id);
          if (!descriptor) {
            return [];
          }

          return [0, 1].map((roundIndex) => {
            const delay = roundIndex * participants.length * 86 + playerIndex * 86;

            schedule(() => {
              setDealtCards((current) => ({
                ...current,
                [player.id]: Math.min(2, (current[player.id] ?? 0) + 1),
              }));
            }, delay + 300);

            return {
              delay,
              destination: descriptor.center,
              hidden: true,
              origin: deckOrigin,
              size: descriptor.isBottomSeat ? ('md' as const) : ('sm' as const),
            };
          });
        });

        await runCardFlights(dealFlights);
        return;
      }

      if (previous.phase !== tableState.phase && tableState.phase !== 'preflop') {
        const closeActionFlights = tableState.players.flatMap((player, index) => {
          const previousPlayer = previousPlayers.get(player.id);
          const descriptor = seatMap.get(player.id);
          if (!previousPlayer || !descriptor) {
            return [];
          }

          const contributionDelta =
            player.totalContribution - previousPlayer.totalContribution;
          if (
            contributionDelta <= 0 ||
            previousPlayer.betThisRound <= 0 ||
            player.betThisRound > 0
          ) {
            return [];
          }

          return [
            {
              amount: contributionDelta,
              delay: index * 70,
              destination: descriptor.betCenter,
              origin: descriptor.center,
              tone: 'bet' as const,
            },
          ];
        });

        await runChipFlights(closeActionFlights);

        const collectionFlights = tableState.players.flatMap((player, index) => {
          const previousPlayer = previousPlayers.get(player.id);
          const descriptor = seatMap.get(player.id);
          if (!previousPlayer || !descriptor || previousPlayer.betThisRound <= 0) {
            return [];
          }

          const extraCommitted = Math.max(
            0,
            player.totalContribution - previousPlayer.totalContribution,
          );

          return [
            {
              amount: previousPlayer.betThisRound + extraCommitted,
              delay: index * 70,
              destination: potCenter,
              origin: descriptor.betCenter,
              tone: 'pot' as const,
            },
          ];
        });

        await runChipFlights(collectionFlights);
      }

      if (tableState.communityCards.length > previous.communityCards.length) {
        const startIndex = previous.communityCards.length;
        const revealFlights = tableState.communityCards
          .slice(startIndex)
          .map((card, offset) => {
            const delay = offset * 140;

            schedule(() => {
              setVisibleCommunityCount(startIndex + offset + 1);
            }, delay + 320);

            return {
              card,
              delay,
              destination: communityPoints[startIndex + offset],
              hidden: true,
              origin: deckOrigin,
              size: boardCardSize,
            };
          });

        await runCardFlights(revealFlights);
      } else {
        setVisibleCommunityCount(tableState.communityCards.length);
      }

      const betFlights = tableState.players.flatMap((player, index) => {
        const previousPlayer = previousPlayers.get(player.id);
        const descriptor = seatMap.get(player.id);
        if (!previousPlayer || !descriptor) {
          return [];
        }

        const roundBetDelta = player.betThisRound - previousPlayer.betThisRound;
        if (roundBetDelta <= 0) {
          return [];
        }

        return [
          {
            amount: roundBetDelta,
            delay: index * 60,
            destination: descriptor.betCenter,
            origin: descriptor.center,
            tone: 'bet' as const,
          },
        ];
      });

      await runChipFlights(betFlights);

      if (tableState.phase === 'completed') {
        const winners = tableState.players
          .filter((player) => {
            const previousPlayer = previousPlayers.get(player.id);
            return Boolean(previousPlayer && player.chips > previousPlayer.chips);
          })
          .map((player) => player.id);

        setWinnerIds(winners);
        if (winners.length > 0) {
          setShowdownBanner({
            id: Date.now(),
            text: tableState.lastWinnerSummary ?? 'Pot awarded',
            tone: 'winner',
          });
        }

        const payoutFlights = winners.flatMap((winnerId, index) => {
          const currentPlayer = currentPlayers.get(winnerId);
          const previousPlayer = previousPlayers.get(winnerId);
          const descriptor = seatMap.get(winnerId);

          if (!currentPlayer || !previousPlayer || !descriptor) {
            return [];
          }

          return [
            {
              amount: Math.max(
                currentPlayer.chips - previousPlayer.chips,
                Math.floor(tableState.pot / Math.max(winners.length, 1)),
              ),
              delay: index * 120,
              destination: descriptor.center,
              origin: potCenter,
              tone: 'pot' as const,
            },
          ];
        });

        await wait(130);
        await runChipFlights(payoutFlights);
      } else {
        setWinnerIds([]);
        if (previous.phase !== 'showdown' && tableState.phase === 'showdown') {
          setShowdownBanner({
            id: Date.now(),
            text: 'Showdown',
            tone: 'showdown',
          });
        }
      }
    });
  }, [
    boardCardSize,
    communityPoints,
    deckOrigin,
    orderedPlayers,
    potCenter,
    seatMap,
    tableReady,
    tableState,
  ]);

  if (!tableState?.roomId) {
    return (
      <SafeAreaView edges={['bottom', 'left', 'right', 'top']} style={styles.safeArea}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#04020A', '#090314', '#05030B']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No active table</Text>
          <Text style={styles.emptyText}>
            Start a demo table from the lobby to enter the poker room.
          </Text>
          <ActionButton
            icon="cards-playing-club-outline"
            label="Back to lobby"
            onPress={() => navigation.navigate(routes.Home)}
            tone="primary"
          />
        </View>
      </SafeAreaView>
    );
  }

  const currentTableState = tableState;
  const is357Current =
    currentTableState.gameSettings.game === '357' &&
    Boolean(currentTableState.threeFiveSeven);
  const showDecisionLayout =
    is357Current &&
    (currentTableState.phase === 'decide_3' ||
      currentTableState.phase === 'decide_5' ||
      currentTableState.phase === 'decide_7');
  const phaseTitle = getPhaseTitle(currentTableState.phase);
  const selfPlayer =
    currentTableState.players.find(
      (player) => player.id === currentTableState.selfId,
    ) ?? null;
  const headlineText =
    is357Current
      ? threeFiveSevenRevealPreview?.summaryText ?? currentTableState.statusMessage
      : currentTableState.phase === 'completed'
        ? currentTableState.lastWinnerSummary ?? currentTableState.statusMessage
        : currentTableState.actionLog[0] ?? currentTableState.statusMessage;
  const quickRaiseOptions = is357Current ? [] : buildQuickRaiseOptions(currentTableState);
  function handleGameAction(action: PokerAction, amount?: number) {
    if (pendingAction) {
      return;
    }

    setPendingAction(action);
    sendAction(action, amount);
  }

  function handleStartHand() {
    if (pendingAction) {
      return;
    }

    setPendingAction('start');
    startHand();
  }

  function handleRebuy() {
    if (pendingAction) {
      return;
    }

    setPendingAction('rebuy');
    rebuy();
  }

  function handleRaiseSubmit() {
    const amount = Number(raiseTo);
    if (!Number.isFinite(amount)) {
      return;
    }

    if (currentTableState.currentBet === 0) {
      handleGameAction('bet', amount);
      return;
    }

    handleGameAction('raise', amount);
  }

  const connectedCount = currentTableState.players.filter((player) => player.isConnected).length;
  const inviteNotificationCount = currentTableState.tableInvites.filter(
    (invite) => invite.status === 'pending',
  ).length;
  const chatNotificationCount = Math.max(currentTableState.chatMessages.length - 3, 0);
  const serverTimeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(clockNow);
  const latencyLabel =
    transportStatus === 'disconnected' || transportStatus === 'error'
      ? 'Offline'
      : typeof connection.latencyMs === 'number'
        ? `${Math.round(connection.latencyMs)}ms`
        : '--ms';
  const tableNode = (
    <TableSurface
      ambientA={ambientA}
      ambientB={ambientB}
      boardCardSize={boardCardSize}
      boardHeight={boardHeight}
      boardTop={boardTop}
      boardWidth={boardWidth}
      cardFlights={cardFlights}
      chipFlights={chipFlights}
      dealtCards={dealtCards}
      focusMode={isLandscape}
      headlineText={headlineText}
      onLayout={handleTableLayout}
      onPressTable={() => undefined}
      phaseTitle={phaseTitle}
      seatBursts={seatBursts}
      seatDescriptors={seatDescriptors}
      seatMap={seatMap}
      selfId={currentTableState.selfId}
      state={currentTableState}
      tablePan={tablePan}
      tablePanHandlers={tablePanResponder.panHandlers}
      tableViewZoom={tableViewZoom}
      threeFiveSevenPreview={threeFiveSevenRevealPreview}
      visibleCommunityCount={visibleCommunityCount}
      height={displayTableHeight}
      width={displayTableWidth}
      winnerIds={is357Current ? threeFiveSevenRevealPreview?.winnerIds ?? [] : winnerIds}
    />
  );

  const topBar = (
    <TableChatBar
      chatNotificationCount={chatNotificationCount}
      connectedCount={connectedCount}
      inviteNotificationCount={inviteNotificationCount}
      messages={currentTableState.chatMessages}
      onInvitePress={() => navigation.navigate(routes.PlayerDirectory)}
      onSendMessage={sendTableChatMessage}
      roomId={currentTableState.roomId ?? 'Table'}
      tableName={currentTableState.tableName}
      transportLabel={transportLabel}
      transportStatus={transportStatus}
    />
  );

  const heroSection = is357Current ? (
    <ThreeFiveSevenActionPanel
      controls={currentTableState.controls}
      onAction={(action) => handleGameAction(action)}
      onRebuy={handleRebuy}
      onStartHand={handleStartHand}
      pendingAction={pendingAction}
      player={selfPlayer}
      safeAreaBottom={isLandscape ? 0 : insets.bottom}
      safeAreaHorizontal={isLandscape ? 0 : Math.max(insets.left, insets.right)}
      showDecisionPrompt={showDecisionLayout}
      statusMessage={headlineText}
    />
  ) : (
    <HeroActionSection
      barMode={false}
      compact={heroZoneCompact && !isLandscape}
      controls={currentTableState.controls}
      currentBet={currentTableState.currentBet}
      onAction={(action) => handleGameAction(action)}
      onRaiseChange={setRaiseTo}
      onRaiseSubmit={handleRaiseSubmit}
      onRebuy={handleRebuy}
      onStartHand={handleStartHand}
      pendingAction={pendingAction}
      phase={currentTableState.phase}
      player={selfPlayer}
      quickRaiseOptions={quickRaiseOptions}
      raiseTo={raiseTo}
      recentActions={currentTableState.actionLog.slice(0, 3)}
      safeAreaBottom={isLandscape ? 0 : insets.bottom}
      safeAreaHorizontal={isLandscape ? 0 : Math.max(insets.left, insets.right)}
      statusMessage={currentTableState.statusMessage}
    />
  );

  const footerNode = (
    <GameplayFooter
      latencyLabel={latencyLabel}
      serverTimeLabel={serverTimeLabel}
      transportStatus={transportStatus}
    />
  );
  const activeWildLabel =
    currentTableState.threeFiveSeven?.activeWildDefinition.label ??
    currentTableState.threeFiveSeven?.activeWildDefinition.wildRanks.join(', ') ??
    'No wilds';
  const bottomRightNode = is357Current ? (
    <RoundWildsBadge label={activeWildLabel} />
  ) : null;

  return (
    <SafeAreaView edges={['bottom', 'left', 'right', 'top']} style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#04020A', '#090314', '#05030B']}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.screenGlowA,
          {
            opacity: ambientA,
            transform: [
              {
                scale: ambientA.interpolate({
                  inputRange: [0.42, 1],
                  outputRange: [0.96, 1.06],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.screenGlowB,
          {
            opacity: ambientB,
            transform: [
              {
                scale: ambientB.interpolate({
                  inputRange: [0.34, 0.88],
                  outputRange: [1.02, 0.94],
                }),
              },
            ],
          },
        ]}
      />

      <GameplayLayout
        bottomRightNode={bottomRightNode}
        errorMessage={errorMessage}
        footerNode={footerNode}
        heroSection={heroSection}
        insets={insets}
        isLandscape={isLandscape}
        tableNode={tableNode}
        topBar={topBar}
      />

      {showdownBanner ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.showdownBanner,
            showdownBanner.tone === 'winner' ? styles.showdownBannerWinner : null,
            {
              opacity: showdownProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
              transform: [
                {
                  translateY: showdownProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
                {
                  scale: showdownProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.showdownKicker}>
            {showdownBanner.tone === 'winner' ? 'Winner' : 'Showdown'}
          </Text>
          <Text numberOfLines={2} style={styles.showdownText}>
            {showdownBanner.text}
          </Text>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  betSpot: {
    alignItems: 'center',
    minHeight: 32,
    minWidth: 60,
    marginTop: 4,
  },
  burstSlot: {
    alignItems: 'center',
    position: 'absolute',
    width: 116,
    zIndex: 18,
  },
  centerBoardSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 16,
    paddingHorizontal: 4,
    paddingBottom: 30,
    paddingTop: 6,
  },
  deckDock: {
    alignItems: 'center',
    gap: 8,
  },
  deckLabel: {
    color: '#E8F8F1',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  deckLabelPill: {
    backgroundColor: 'rgba(11,15,44,0.88)',
    borderColor: 'rgba(128,113,255,0.32)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deckOffsetCard: {
    left: -6,
    position: 'absolute',
    top: -6,
  },
  deckStack: {
    height: 72,
    position: 'relative',
    width: 52,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  emptyText: {
    color: 'rgba(229,244,238,0.68)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#F7FCF9',
    fontSize: 30,
    fontWeight: '900',
  },
  feltGlowA: {
    backgroundColor: 'rgba(80,240,255,0.16)',
    borderRadius: 999,
    height: 230,
    left: 24,
    position: 'absolute',
    top: 28,
    width: 230,
  },
  feltGlowB: {
    backgroundColor: 'rgba(173,89,255,0.15)',
    borderRadius: 999,
    bottom: 42,
    height: 200,
    position: 'absolute',
    right: 32,
    width: 200,
  },
  messageBanner: {
    backgroundColor: 'rgba(54,43,15,0.92)',
    borderColor: 'rgba(243,210,130,0.22)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBannerError: {
    backgroundColor: 'rgba(96,30,49,0.92)',
    borderColor: 'rgba(239,134,164,0.28)',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBannerKicker: {
    color: '#F8E6B2',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  messageBannerText: {
    color: '#F7FBF9',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  roundWildsBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(5, 4, 13, 0.88)',
    borderColor: 'rgba(180, 84, 255, 0.48)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#B35CFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
  },
  roundWildsKicker: {
    color: '#8B5CFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  roundWildsText: {
    color: '#F7F4FF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  screen: {
    flex: 1,
  },
  focusBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05070B',
  },
  focusBadge: {
    backgroundColor: 'rgba(18,14,56,0.82)',
    borderColor: 'rgba(93,233,255,0.54)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  focusBadgeText: {
    color: '#DEFCEE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  focusExitButton: {
    backgroundColor: 'rgba(10,18,24,0.72)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  focusExitText: {
    color: '#F6FCF9',
    fontSize: 12,
    fontWeight: '800',
  },
  focusedTableStage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 42,
  },
  focusedTableStageLandscape: {
    paddingTop: 34,
    paddingHorizontal: 10,
  },
  landscapeLayoutRow: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
    position: 'relative',
    width: '100%',
  },
  landscapeTableColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    minWidth: 0,
  },
  landscapePanel: {
    backgroundColor: 'rgba(9,16,36,0.72)',
    borderColor: 'rgba(117,105,255,0.28)',
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  landscapePanelContent: {
    gap: 10,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  landscapeTableCenter: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
  leftOverlayPanel: {
    backgroundColor: 'rgba(9,16,36,0.94)',
    borderColor: 'rgba(117,105,255,0.34)',
    borderRadius: 20,
    borderWidth: 1,
    bottom: 10,
    left: 4,
    overflow: 'hidden',
    position: 'absolute',
    top: 10,
    zIndex: 35,
  },
  sidePanelToggle: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,14,30,0.92)',
    borderColor: 'rgba(120,224,255,0.46)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    right: 12,
    top: 8,
    zIndex: 40,
  },
  sidePanelToggleText: {
    color: '#E8FCFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  focusLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  focusOverlayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 5,
  },
  focusOverlayHeaderLandscape: {
    paddingTop: 8,
  },
  screenGlowA: {
    backgroundColor: 'rgba(193, 70, 255, 0.12)',
    borderRadius: 999,
    height: 340,
    left: -40,
    position: 'absolute',
    top: 60,
    width: 340,
  },
  screenGlowB: {
    backgroundColor: 'rgba(69, 181, 255, 0.12)',
    borderRadius: 999,
    bottom: 120,
    height: 280,
    position: 'absolute',
    right: -40,
    width: 280,
  },
  showdownBanner: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(13,18,39,0.9)',
    borderColor: 'rgba(94,233,255,0.58)',
    borderRadius: 16,
    borderWidth: 1,
    bottom: 14,
    maxWidth: '86%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    zIndex: 140,
  },
  showdownBannerWinner: {
    backgroundColor: 'rgba(57,37,18,0.94)',
    borderColor: 'rgba(243,204,121,0.58)',
  },
  showdownKicker: {
    color: '#D7FAFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  showdownText: {
    color: '#F5FBFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  seatSlot: {
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: 180,
  },
  tableFelt: {
    borderRadius: 180,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tablePanLayer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  tableLayoutZones: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  tableLogoBlock: {
    alignItems: 'center',
    left: 0,
    opacity: 0.2,
    position: 'absolute',
    right: 0,
    top: '46%',
    zIndex: 1,
  },
  tableLogoKicker: {
    color: '#D6FFEE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  tableLogoText: {
    color: '#F1ECFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
  },
  tableOuter: {
    borderRadius: 200,
    flex: 1,
    padding: 7,
  },
  tableRail: {
    backgroundColor: '#1F140D',
    borderColor: 'rgba(255,208,136,0.28)',
    borderRadius: 190,
    borderWidth: 1,
    flex: 1,
    padding: 7,
  },
  tableRingInner: {
    borderColor: 'rgba(128,113,255,0.32)',
    borderRadius: 170,
    borderWidth: 1,
    bottom: '18%',
    left: '12%',
    position: 'absolute',
    right: '12%',
    top: '18%',
  },
  tableRingOuter: {
    borderColor: 'rgba(127,98,255,0.36)',
    borderRadius: 185,
    borderWidth: 1,
    bottom: '11%',
    left: '7%',
    position: 'absolute',
    right: '7%',
    top: '11%',
  },
  tableShadow: {
    backgroundColor: '#000000',
    borderRadius: 200,
    bottom: 8,
    left: 18,
    opacity: 0.18,
    position: 'absolute',
    right: 18,
    top: 22,
  },
  tableSurface: {
    position: 'relative',
    width: '100%',
  },
  tableDragContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tableDragScroll: {
    maxWidth: '100%',
  },
  tableStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableViewport: {
    alignItems: 'stretch',
    gap: 6,
    position: 'relative',
    width: '100%',
  },
  tableViewportFocused: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
  },
  topOpponentZone: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-evenly',
    minHeight: 104,
  },
  centerBoardZone: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 146,
    paddingVertical: 8,
  },
  tableBottomHeroZone: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 120,
  },
  bottomHeroZone: {
    alignItems: 'stretch',
    gap: 10,
  },
  bottomHeroZoneCompact: {
    flexDirection: 'column',
  },
  bottomHeroZoneExpanded: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  bottomHeroHandSlot: {
    flexShrink: 0,
    maxWidth: 520,
    minWidth: 280,
    width: '100%',
  },
  bottomHeroHandSlotCompact: {
    maxWidth: '100%',
    minWidth: 0,
  },
  bottomHeroActionSlot: {
    flex: 1,
    minWidth: 320,
  },
  bottomHeroActionSlotCompact: {
    minWidth: 0,
    width: '100%',
  },
  actionZone: {
    alignItems: 'center',
    minHeight: 92,
  },
  statusZone: {
    minHeight: 20,
    paddingHorizontal: 12,
  },
  statusZoneText: {
    color: 'rgba(235,247,242,0.8)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
