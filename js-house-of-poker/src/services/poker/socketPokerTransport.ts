import { pokerClientEvents, pokerLegacyClientEvents, pokerLegacyServerEvents, pokerServerEvents } from './events';
import { buildRoomStateFromLegacy } from './roomStateAdapter';
import { createSocketManager } from '../socket/socketManager';
import { normalizeTableChatText } from '../../utils/tableChat';
import { playerStatusTierToPokerPlayerStatus } from '../../utils/playerStatus';
import { getAuthSession } from '../storage/sessionStorage';
import type {
  CreatePokerTableInput,
  JoinPokerTableInput,
  PokerConnectionState,
  PokerGameSettingsUpdate,
  PokerSessionState,
  PokerTransport,
  PokerTransportListener,
  SendPokerTableInviteInput,
  SitAtSeatInput,
} from './types';
import type { PlayerStatusTier, PokerAction, PokerRoomState } from '../../types/poker';

type PlayerStatusUpdatedPayload = {
  netChipBalance?: number;
  playerId?: string | null;
  statusMomentum?: number;
  statusScore?: number;
  statusTier?: PlayerStatusTier;
  statusUpdatedAt?: number | string | null;
};

type CreateSocketPokerTransportOptions = {
  protocol: 'legacy' | 'table-v1';
  socketUrl: string;
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function trimName(value: string) {
  return value.trim();
}

function trimTableId(value: string) {
  return value.trim().toUpperCase();
}

async function getAuthToken() {
  try {
    return (await getAuthSession())?.token ?? null;
  } catch {
    return null;
  }
}

async function withAuthToken<TPayload extends Record<string, unknown>>(payload: TPayload) {
  const token = await getAuthToken();

  return token ? { ...payload, token } : payload;
}

function emitProtocolEvent<TPayload>(
  protocol: CreateSocketPokerTransportOptions['protocol'],
  emit: (eventName: string, payload?: TPayload) => void,
  eventName: string,
  legacyEventName: string | null,
  payload?: TPayload,
) {
  if (protocol === 'table-v1') {
    emit(eventName, payload);
    return;
  }

  if (legacyEventName) {
    emit(legacyEventName, payload);
    return;
  }

  emit(eventName, payload);
}

export function createSocketPokerTransport(
  options: CreateSocketPokerTransportOptions,
): PokerTransport {
  const listeners = new Set<PokerTransportListener>();
  const socketManager = createSocketManager({
    kind: 'socket',
    label: 'Socket.IO backend',
    url: options.socketUrl,
  });
  let previousRoomState: PokerRoomState | null = null;
  let connectionState = socketManager.getConnectionState();
  let sessionState: PokerSessionState = {
    playerId: null,
    playerName: null,
    seatIndex: null,
    shouldResume: false,
    tableId: null,
  };
  let isDestroyed = false;
  let hasAttemptedResume = false;

  function notify(listenerPayload: Parameters<PokerTransportListener>[0]) {
    listeners.forEach((listener) => listener(listenerPayload));
  }

  function pushConnection(
    patch: Partial<PokerConnectionState> & Pick<PokerConnectionState, 'status'>,
  ) {
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
    notify({
      message,
      type: 'error',
    });
  }

  function pushSession(partial?: Partial<typeof sessionState>) {
    sessionState = {
      ...sessionState,
      ...partial,
    };
    notify({
      session: sessionState,
      type: 'session',
    });
  }

  function syncRoomState(nextState: Parameters<typeof buildRoomStateFromLegacy>[0] | null) {
    const syncResult = buildRoomStateFromLegacy(nextState, previousRoomState);
    previousRoomState = syncResult.roomState;

    if (syncResult.roomState) {
      pushSession({
        playerId: syncResult.roomState.selfId,
        shouldResume: true,
        tableId: syncResult.roomState.tableId,
      });
    }

    notify({
      events: syncResult.events,
      roomState: syncResult.roomState,
      type: 'table-sync',
    });
  }


  function mergePlayerStatusUpdate(payload: PlayerStatusUpdatedPayload | null | undefined) {
    if (!previousRoomState || !payload?.playerId) {
      return;
    }

    let didUpdate = false;
    const players = previousRoomState.players.map((player) => {
      if (player.id !== payload.playerId) {
        return player;
      }

      didUpdate = true;
      return {
        ...player,
        ...(typeof payload.netChipBalance === 'number'
          ? { netChipBalance: payload.netChipBalance }
          : {}),
        ...(typeof payload.statusMomentum === 'number'
          ? { statusMomentum: payload.statusMomentum }
          : {}),
        ...(typeof payload.statusScore === 'number'
          ? { statusScore: payload.statusScore }
          : {}),
        ...(payload.statusTier
          ? {
              playerStatus: playerStatusTierToPokerPlayerStatus(payload.statusTier),
              statusTier: payload.statusTier,
            }
          : {}),
        ...(payload.statusUpdatedAt !== undefined
          ? { statusUpdatedAt: payload.statusUpdatedAt }
          : {}),
      };
    });

    if (!didUpdate) {
      return;
    }

    previousRoomState = {
      ...previousRoomState,
      players,
      updatedAt: Date.now(),
    };

    notify({
      events: [],
      roomState: previousRoomState,
      type: 'table-sync',
    });
  }

  const unsubscribeConnection = socketManager.onConnection((nextState) => {
    if (isDestroyed) {
      return;
    }

    const previousStatus = connectionState.status;
    connectionState = nextState;
    pushConnection(nextState);

    if (
      nextState.status === 'connected' &&
      previousStatus === 'reconnecting' &&
      sessionState.shouldResume &&
      sessionState.tableId &&
      sessionState.playerName &&
      !hasAttemptedResume
    ) {
      hasAttemptedResume = true;
      void withAuthToken({
        name: sessionState.playerName,
        seatIndex: sessionState.seatIndex,
        tableId: sessionState.tableId,
      }).then((payload) => {
        socketManager.emit(pokerClientEvents.resumeSession, payload);
      });
    }
  });

  const rawUnsubscribers = [
    socketManager.on<PlayerStatusUpdatedPayload>(pokerServerEvents.playerStatusUpdated, (payload) => {
      mergePlayerStatusUpdate(payload);
    }),
    socketManager.on<Record<string, unknown>>(pokerServerEvents.stateSync, (payload) => {
      hasAttemptedResume = false;
      pushError(null);
      syncRoomState(payload as Parameters<typeof buildRoomStateFromLegacy>[0]);
    }),
    socketManager.on<Record<string, unknown>>(pokerLegacyServerEvents.roomState, (payload) => {
      hasAttemptedResume = false;
      pushError(null);
      syncRoomState(payload as Parameters<typeof buildRoomStateFromLegacy>[0]);
    }),
    socketManager.on<{ message?: string }>(pokerServerEvents.roomError, (payload) => {
      pushError(payload?.message?.trim() || 'Unexpected realtime error.');
    }),
    socketManager.on<{ message?: string }>(pokerLegacyServerEvents.roomError, (payload) => {
      pushError(payload?.message?.trim() || 'Unexpected realtime error.');
    }),
    socketManager.on<{ message?: string }>(pokerServerEvents.reconnectRejected, (payload) => {
      pushError(payload?.message?.trim() || 'Unable to restore your table session.');
      hasAttemptedResume = false;
    }),
    socketManager.on<{ roomState?: Record<string, unknown> }>(
      pokerServerEvents.gameSettingsUpdated,
      (payload) => {
        if (payload?.roomState) {
          pushError(null);
          syncRoomState(payload.roomState as Parameters<typeof buildRoomStateFromLegacy>[0]);
        }
      },
    ),
    socketManager.on(pokerServerEvents.tableLeft, () => {
      hasAttemptedResume = false;
      syncRoomState(null);
      pushError(null);
      pushSession({
        playerId: null,
        seatIndex: null,
        shouldResume: false,
        tableId: null,
      });
    }),
    socketManager.on(pokerLegacyServerEvents.roomLeft, () => {
      hasAttemptedResume = false;
      syncRoomState(null);
      pushError(null);
      pushSession({
        playerId: null,
        seatIndex: null,
        shouldResume: false,
        tableId: null,
      });
    }),
  ];

  async function ensureConnected() {
    await socketManager.connect();
    pushError(null);
  }

  async function createTable(input: CreatePokerTableInput) {
    const playerName = trimName(input.name);
    if (!playerName) {
      pushError('Player name is required.');
      return;
    }

    await ensureConnected();
    pushSession({
      playerName,
      seatIndex: input.seatIndex ?? 0,
      shouldResume: true,
      tableId: null,
    });

    const payload = await withAuthToken({
      gameSettings: input.gameSettings,
      name: playerName,
      seatIndex: input.seatIndex,
      tableName: input.tableName,
    });

    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.createTable,
      pokerLegacyClientEvents.createRoom,
      payload,
    );
  }

  async function joinTable(input: JoinPokerTableInput) {
    const playerName = trimName(input.name);
    const tableId = trimTableId(input.tableId);

    if (!playerName || !tableId) {
      pushError('Player name and table code are required.');
      return;
    }

    await ensureConnected();
    pushSession({
      playerName,
      seatIndex: input.seatIndex ?? null,
      shouldResume: true,
      tableId,
    });

    const payload = await withAuthToken(
      options.protocol === 'table-v1'
        ? {
            name: playerName,
            seatIndex: input.seatIndex,
            tableId,
          }
        : ({
            name: playerName,
            roomId: tableId,
          } as { name: string; roomId: string }),
    );

    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.joinTable,
      pokerLegacyClientEvents.joinRoom,
      payload,
    );
  }

  async function leaveTable() {
    if (!socketManager.isConnected()) {
      syncRoomState(null);
      pushSession({
        playerId: null,
        seatIndex: null,
        shouldResume: false,
        tableId: null,
      });
      return;
    }

    hasAttemptedResume = false;
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.leaveTable,
      pokerLegacyClientEvents.leaveRoom,
    );
  }

  async function sitAtSeat(input: SitAtSeatInput) {
    await ensureConnected();
    pushSession({
      seatIndex: input.seatIndex,
    });
    socketManager.emit(pokerClientEvents.sitAtSeat, {
      seatIndex: input.seatIndex,
      tableId: sessionState.tableId,
    });
  }

  async function startGame() {
    await ensureConnected();
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.startGame,
      pokerLegacyClientEvents.startHand,
      options.protocol === 'table-v1'
        ? {
            tableId: sessionState.tableId,
          }
        : undefined,
    );
  }

  async function rebuy() {
    await ensureConnected();
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.rebuy,
      pokerLegacyClientEvents.rebuy,
      options.protocol === 'table-v1'
        ? {
            tableId: sessionState.tableId,
          }
        : undefined,
    );
  }

  async function sendAction(type: PokerAction, amount?: number) {
    await ensureConnected();
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.gameAction,
      pokerLegacyClientEvents.gameAction,
      options.protocol === 'table-v1'
        ? {
            amount,
            tableId: sessionState.tableId,
            type,
          }
        : {
            amount,
            type,
          },
    );
  }

  async function updateGameSettings(update: PokerGameSettingsUpdate) {
    await ensureConnected();
    socketManager.emit(pokerClientEvents.gameSettingsUpdate, {
      gameSettings: update,
      tableId: sessionState.tableId,
    });
  }

  async function sendTableChatMessage(message: string) {
    const normalizedMessage = normalizeTableChatText(message);
    if (!normalizedMessage) {
      pushError('Chat message cannot be empty.');
      return;
    }

    await ensureConnected();
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.sendTableChatMessage,
      pokerLegacyClientEvents.sendTableChatMessage,
      options.protocol === 'table-v1'
        ? {
            message: normalizedMessage,
            tableId: sessionState.tableId,
          }
        : {
            message: normalizedMessage,
      },
    );
  }

  async function sendTableInvite(input: SendPokerTableInviteInput) {
    await ensureConnected();
    emitProtocolEvent(
      options.protocol,
      socketManager.emit,
      pokerClientEvents.sendTableInvite,
      pokerLegacyClientEvents.sendTableInvite,
      options.protocol === 'table-v1'
        ? {
            giftClips: input.giftClips,
            message: input.message,
            recipientAccountId: input.recipientAccountId,
            source: input.source,
            tableId: sessionState.tableId,
          }
        : input,
    );
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
    connect() {
      return ensureConnected();
    },
    createTable,
    destroy() {
      isDestroyed = true;
      listeners.clear();
      previousRoomState = null;
      rawUnsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribeConnection();
      socketManager.destroy();
    },
    disconnect() {
      socketManager.disconnect();
      return Promise.resolve();
    },
    fold() {
      return sendAction('fold');
    },
    getConnectionState() {
      return socketManager.getConnectionState();
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
