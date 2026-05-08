import type {
  PokerAction,
  PokerGameSettingsUpdate,
  PokerRoomState,
  PokerTableChatMessage,
} from '../../types/poker';

import { buildRoomStateFromLegacy } from './roomStateAdapter';
import type {
  CreatePokerTableInput,
  JoinPokerTableInput,
  PokerConnectionState,
  PokerServerEvent,
  PokerTransport,
  PokerTransportListener,
  SendPokerTableInviteInput,
  SitAtSeatInput,
} from './types';
import {
  appendTableChatMessage,
  createLocalTableChatMessage,
  normalizeTableChatText,
} from '../../utils/tableChat';

type InternalPlayer = {
  accountId: string;
  chips: number;
  id: string;
  isConnected: boolean;
  name: string;
  pendingRemoval: boolean;
  socketId: string | null;
};

type InternalHandPlayer = {
  allIn: boolean;
  betThisRound: number;
  cards: string[];
  folded: boolean;
  hasActed: boolean;
  totalContribution: number;
};

type InternalRoom = {
  actionLog: string[];
  chatMessages: PokerTableChatMessage[];
  gameSettings?: {
    game: string;
    locked: boolean;
    lowRule: string;
    mode: string;
    stips: {
      bestFiveCards: boolean;
      hostestWithTheMostest: boolean;
      suitedBeatsUnsuited: boolean;
      wildCards: boolean;
    };
    wildCards: string[];
  };
  hand: {
    communityCards: string[];
    currentBet: number;
    currentPlayerId: string | null;
    dealerId: string;
    minRaise: number;
    phase: string;
    players: Record<string, InternalHandPlayer>;
    threeFiveSeven?: {
      decisionHistoryByPlayerId: Record<string, Record<number, 'GO' | 'STAY' | null>>;
      finalDecisionByPlayerId: Record<string, 'GO' | 'STAY' | null>;
      phaseSequence: string[];
      visibleDecisionsByPlayerId: Record<string, 'GO' | 'STAY' | null>;
    };
  } | null;
  handCount: number;
  hostId: string | null;
  id: string;
  lastDealerId: string | null;
  lastWinnerSummary: string | null;
  players: InternalPlayer[];
  threeFiveSeven?: {
    activeRound: number | null;
    activeWildDefinition: {
      wildRanks: string[];
    };
    mode: string;
  };
};

const pokerGame = require('../../game/pokerEngine') as {
  BIG_BLIND: number;
  buildRoomState: (room: InternalRoom, playerId: string) => Record<string, unknown>;
  createRoom: (
    rooms: Map<string, InternalRoom>,
    socketId: string,
    name: string,
    options?: { seedMockStatuses?: boolean },
  ) => { player: InternalPlayer; room: InternalRoom };
  joinRoom: (
    room: InternalRoom,
    socketId: string,
    name: string,
    options?: { seedMockStatuses?: boolean },
  ) => InternalPlayer;
  leaveRoom: (room: InternalRoom, playerId: string) => void;
  performAction: (
    room: InternalRoom,
    playerId: string,
    actionType: PokerAction,
    amount?: number,
  ) => void;
  rebuy: (room: InternalRoom, playerId: string) => void;
  removePendingPlayers: (room: InternalRoom) => void;
  sendTableInvite: (
    room: InternalRoom,
    playerId: string,
    input: SendPokerTableInviteInput,
  ) => void;
  startHand: (room: InternalRoom, playerId: string) => void;
  updateGameSettings: (
    room: InternalRoom,
    playerId: string,
    update: PokerGameSettingsUpdate,
  ) => void;
};

const BOT_NAMES = ['Thor', 'Artie', 'Poker4Ever', 'Ullii67', 'vossell'];
const DEFAULT_MAX_SEATS = 6;

function estimateLocalLatencyMs() {
  return 12 + Math.round((Date.now() % 37) + Math.random() * 9);
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createLocalPokerTransport(): PokerTransport {
  const listeners = new Set<PokerTransportListener>();
  const rooms = new Map<string, InternalRoom>();
  let connectionState: PokerConnectionState = {
    backendUrl: null,
    kind: 'local',
    label: 'Mock realtime table',
    lastDisconnectReason: null,
    lastError: null,
    latencyMs: estimateLocalLatencyMs(),
    reconnectAttempts: 0,
    socketId: 'local-socket',
    status: 'connected',
  };
  let room: InternalRoom | null = null;
  let previousRoomState: PokerRoomState | null = null;
  let selfId: string | null = null;
  let selfName: string | null = null;
  let preferredSeatIndex: number | null = null;
  let botTimer: ReturnType<typeof setTimeout> | null = null;

  function notify(listenerPayload: Parameters<PokerTransportListener>[0]) {
    listeners.forEach((listener) => listener(listenerPayload));
  }

  function pushConnection(patch: Partial<PokerConnectionState> & Pick<PokerConnectionState, 'status'>) {
    connectionState = {
      ...connectionState,
      ...patch,
    };
    notify({
      connection: patch,
      type: 'connection',
    });
  }

  function pushError(message: string | null) {
    connectionState = {
      ...connectionState,
      lastError: message,
    };
    notify({
      message,
      type: 'error',
    });
  }

  function pushSession() {
    notify({
      session: {
        playerId: selfId,
        playerName: selfName,
        seatIndex: preferredSeatIndex,
        shouldResume: Boolean(room?.id && selfName),
        tableId: room?.id ?? null,
      },
      type: 'session',
    });
  }

  function pushTableSync(events: PokerServerEvent[]) {
    const legacyState =
      room && selfId
        ? (pokerGame.buildRoomState(room, selfId) as Parameters<
            typeof buildRoomStateFromLegacy
          >[0])
        : null;
    const nextState = buildRoomStateFromLegacy(legacyState, previousRoomState);

    previousRoomState = nextState.roomState;
    notify({
      events: events.length > 0 ? events : nextState.events,
      roomState: nextState.roomState,
      type: 'table-sync',
    });
    pushSession();
  }

  function clearBotTimer() {
    if (!botTimer) {
      return;
    }

    clearTimeout(botTimer);
    botTimer = null;
  }

  function cleanupRoom(targetRoom: InternalRoom | null) {
    if (!targetRoom) {
      return;
    }

    pokerGame.removePendingPlayers(targetRoom);
    if (targetRoom.players.length === 0) {
      rooms.delete(targetRoom.id);
    }
  }

  function releaseCurrentSeat() {
    if (!room || !selfId) {
      return;
    }

    clearBotTimer();
    pokerGame.leaveRoom(room, selfId);
    cleanupRoom(room);
    room = null;
    selfId = null;
    preferredSeatIndex = null;
  }

  function estimateStrength(cards: string[]) {
    const rankValues: Record<string, number> = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      T: 10,
      J: 11,
      Q: 12,
      K: 13,
      A: 14,
    };

    const [first, second] = cards;
    const firstRank = rankValues[first?.[0] ?? '2'];
    const secondRank = rankValues[second?.[0] ?? '2'];
    const pairBonus = first?.[0] === second?.[0] ? 0.35 : 0;
    const suitedBonus = first?.[1] === second?.[1] ? 0.08 : 0;
    const connectedBonus = Math.abs(firstRank - secondRank) <= 1 ? 0.06 : 0;
    const highCardScore = (firstRank + secondRank) / 28;

    return highCardScore + pairBonus + suitedBonus + connectedBonus;
  }

  function estimate357Strength(cards: string[], wildRanks: string[]) {
    const rankCounts = new Map<string, number>();
    let highCards = 0;
    let wildCount = 0;

    cards.forEach((card) => {
      const rank = card?.[0] ?? '2';
      if (wildRanks.includes(rank)) {
        wildCount += 1;
        return;
      }

      rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
      if (['A', 'K', 'Q', 'J', 'T'].includes(rank)) {
        highCards += 1;
      }
    });

    const bestMatch = Math.max(0, ...Array.from(rankCounts.values()));
    return (
      wildCount * 0.42 +
      bestMatch * 0.16 +
      highCards * 0.05 +
      cards.length * 0.04
    );
  }

  function chooseBotAction() {
    if (!room?.hand) {
      return null;
    }

    const hand = room.hand;
    const botId = hand.currentPlayerId;
    if (!botId || botId === selfId) {
      return null;
    }

    const roomPlayer = room.players.find((player) => player.id === botId);
    const handPlayer = hand.players[botId];
    if (!roomPlayer || !handPlayer) {
      return null;
    }

    if (room.gameSettings?.game === '357') {
      const wildRanks = room.threeFiveSeven?.activeWildDefinition?.wildRanks ?? [];
      const roundSize = room.threeFiveSeven?.activeRound ?? handPlayer.cards.length;
      const strength = estimate357Strength(handPlayer.cards, wildRanks);
      const threshold = roundSize >= 7 ? 0.9 : roundSize >= 5 ? 0.72 : 0.58;

      if (strength >= threshold) {
        return { type: 'go' as const };
      }

      return { type: 'stay' as const };
    }

    const toCall = Math.max(0, hand.currentBet - handPlayer.betThisRound);
    const maxRaiseTo = handPlayer.betThisRound + roomPlayer.chips;
    const minRaiseTo =
      hand.currentBet === 0
        ? Math.min(maxRaiseTo, pokerGame.BIG_BLIND)
        : Math.min(maxRaiseTo, hand.currentBet + hand.minRaise);
    const strength = estimateStrength(handPlayer.cards);

    if (toCall === 0) {
      if (maxRaiseTo > hand.currentBet && strength > 0.9) {
        return {
          amount: Math.min(maxRaiseTo, minRaiseTo + pokerGame.BIG_BLIND),
          type: hand.currentBet === 0 ? ('bet' as const) : ('raise' as const),
        };
      }

      return { type: 'check' as const };
    }

    const pressure = toCall / Math.max(roomPlayer.chips + handPlayer.betThisRound, 1);
    if (strength < 0.45 && pressure > 0.2) {
      return { type: 'fold' as const };
    }

    if (maxRaiseTo > hand.currentBet && strength > 1.0) {
      return {
        amount: Math.min(maxRaiseTo, minRaiseTo + pokerGame.BIG_BLIND),
        type: 'raise' as const,
      };
    }

    return { type: 'call' as const };
  }

  function scheduleBotTurn() {
    clearBotTimer();

    if (!room?.hand || !previousRoomState || previousRoomState.phase === 'completed') {
      return;
    }

    if (
      !previousRoomState.currentTurnPlayerId ||
      previousRoomState.currentTurnPlayerId === previousRoomState.selfId
    ) {
      return;
    }

    botTimer = setTimeout(() => {
      const action = chooseBotAction();
      if (!action || !room?.hand?.currentPlayerId) {
        return;
      }

      try {
        pokerGame.performAction(room, room.hand.currentPlayerId, action.type, action.amount);
        pushError(null);
        pushTableSync([]);
        scheduleBotTurn();
      } catch (error) {
        pushError(toErrorMessage(error, 'Bot action failed.'));
      }
    }, 900);
  }

  function syncRoomState() {
    pushConnection({
      latencyMs: estimateLocalLatencyMs(),
      status: connectionState.status,
    });
    pushTableSync([]);
    scheduleBotTurn();
  }

  function moveSelfToPreferredSeat(seatIndex: number) {
    if (!room || !selfId) {
      return;
    }

    preferredSeatIndex = seatIndex;
  }

  async function connect() {
    pushConnection({
      lastDisconnectReason: null,
      lastError: null,
      latencyMs: estimateLocalLatencyMs(),
      reconnectAttempts: 0,
      socketId: 'local-socket',
      status: 'connected',
    });
  }

  async function disconnect() {
    clearBotTimer();
    pushConnection({
      lastDisconnectReason: 'local disconnect',
      latencyMs: null,
      socketId: null,
      status: 'disconnected',
    });
  }

  async function createTable(input: CreatePokerTableInput) {
    const playerName = input.name.trim();
    if (!playerName) {
      pushError('Player name is required.');
      return;
    }

    releaseCurrentSeat();

    try {
      const { player, room: nextRoom } = pokerGame.createRoom(rooms, 'local-human', playerName, {
        seedMockStatuses: true,
      });
      if (input.gameSettings) {
        pokerGame.updateGameSettings(nextRoom, player.id, input.gameSettings);
      }
      const botCount = Math.max(1, Math.min(BOT_NAMES.length, input.botCount ?? 3));

      BOT_NAMES.slice(0, botCount).forEach((botName, index) => {
        pokerGame.joinRoom(nextRoom, `bot-${index + 1}`, botName, { seedMockStatuses: true });
      });
      nextRoom.chatMessages = nextRoom.chatMessages ?? [];
      if (input.gameSettings?.game === '357') {
        pokerGame.startHand(nextRoom, player.id);
      }

      room = nextRoom;
      selfId = player.id;
      selfName = player.name;
      preferredSeatIndex = input.seatIndex ?? 0;
      moveSelfToPreferredSeat(preferredSeatIndex);
      pushError(null);
      syncRoomState();
    } catch (error) {
      room = null;
      selfId = null;
      selfName = null;
      preferredSeatIndex = null;
      previousRoomState = null;
      notify({
        events: [],
        roomState: null,
        type: 'table-sync',
      });
      pushError(toErrorMessage(error, 'Unable to create the table.'));
    }
  }

  async function joinTable(input: JoinPokerTableInput) {
    const playerName = input.name.trim();
    const roomId = input.tableId.trim().toUpperCase();

    if (!playerName || !roomId) {
      pushError('Player name and room code are required.');
      return;
    }

    const targetRoom = rooms.get(roomId);
    if (!targetRoom) {
      pushError('Table not found.');
      return;
    }

    releaseCurrentSeat();

    try {
      const player = pokerGame.joinRoom(targetRoom, 'local-human', playerName, {
        seedMockStatuses: true,
      });
      targetRoom.chatMessages = targetRoom.chatMessages ?? [];
      room = targetRoom;
      selfId = player.id;
      selfName = player.name;
      preferredSeatIndex = input.seatIndex ?? targetRoom.players.length - 1;
      moveSelfToPreferredSeat(preferredSeatIndex);
      pushError(null);
      syncRoomState();
    } catch (error) {
      room = null;
      selfId = null;
      selfName = null;
      preferredSeatIndex = null;
      previousRoomState = null;
      notify({
        events: [],
        roomState: null,
        type: 'table-sync',
      });
      pushError(toErrorMessage(error, 'Unable to join the table.'));
    }
  }

  async function leaveTable() {
    releaseCurrentSeat();
    const syncResult = buildRoomStateFromLegacy(null, previousRoomState);
    previousRoomState = null;
    notify({
      events: syncResult.events,
      roomState: null,
      type: 'table-sync',
    });
    pushError(null);
    pushSession();
  }

  async function sitAtSeat(input: SitAtSeatInput) {
    if (!room || !selfId) {
      return;
    }

    if (input.seatIndex < 0 || input.seatIndex >= DEFAULT_MAX_SEATS) {
      pushError(`Seat must be between 1 and ${DEFAULT_MAX_SEATS}.`);
      return;
    }

    preferredSeatIndex = input.seatIndex;
    pushSession();
    syncRoomState();
  }

  async function startGame() {
    if (!room || !selfId) {
      return;
    }

    try {
      pokerGame.startHand(room, selfId);
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Unable to start the hand.'));
    }
  }

  async function rebuy() {
    if (!room || !selfId) {
      return;
    }

    try {
      pokerGame.rebuy(room, selfId);
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Unable to rebuy.'));
    }
  }

  async function sendAction(type: PokerAction, amount?: number) {
    if (!room || !selfId) {
      return;
    }

    try {
      pokerGame.performAction(room, selfId, type, amount);
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Action failed.'));
    }
  }

  async function sendTableChatMessage(message: string) {
    if (!room || !selfId) {
      return;
    }

    const text = normalizeTableChatText(message);
    if (!text) {
      pushError('Chat message cannot be empty.');
      return;
    }

    const player = room.players.find((candidate) => candidate.id === selfId);
    if (!player) {
      pushError('Player not found.');
      return;
    }

    try {
      room.chatMessages = appendTableChatMessage(
        room.chatMessages ?? [],
        createLocalTableChatMessage({
          playerId: player.id,
          playerName: player.name,
          text,
        }),
      );
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Unable to send chat message.'));
    }
  }

  async function sendTableInvite(input: SendPokerTableInviteInput) {
    if (!room || !selfId) {
      return;
    }

    try {
      pokerGame.sendTableInvite(room, selfId, input);
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Unable to send invite.'));
    }
  }

  async function updateGameSettings(update: PokerGameSettingsUpdate) {
    if (!room || !selfId) {
      return;
    }

    try {
      pokerGame.updateGameSettings(room, selfId, update);
      pushError(null);
      syncRoomState();
    } catch (error) {
      pushError(toErrorMessage(error, 'Unable to update game settings.'));
    }
  }

  return {
    allIn() {
      return sendAction('all-in');
    },
    bet(amount) {
      return sendAction('bet', amount);
    },
    call() {
      return sendAction('call');
    },
    check() {
      return sendAction('check');
    },
    connect,
    createTable,
    destroy() {
      clearBotTimer();
      releaseCurrentSeat();
      listeners.clear();
      previousRoomState = null;
    },
    disconnect,
    fold() {
      return sendAction('fold');
    },
    getConnectionState() {
      return {
        ...connectionState,
      };
    },
    joinTable,
    leaveTable,
    raise(amount) {
      return sendAction('raise', amount);
    },
    rebuy,
    sendAction,
    sendTableInvite,
    sendTableChatMessage,
    sitAtSeat,
    startGame,
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    updateGameSettings,
  };
}
