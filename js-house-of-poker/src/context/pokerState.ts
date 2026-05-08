import type {
  PokerConnectionState,
  PokerServerEvent,
  PokerSessionState,
  PokerTransportNotification,
} from '../services/poker';
import type { PokerRoomState } from '../types/poker';

const EVENT_FEED_LIMIT = 40;

export type PokerClientState = {
  connection: PokerConnectionState;
  errorMessage: string | null;
  eventFeed: PokerServerEvent[];
  lastEvent: PokerServerEvent | null;
  roomState: PokerRoomState | null;
  session: PokerSessionState;
};

export type PokerClientAction =
  | {
      notification: PokerTransportNotification;
      type: 'transport-notification';
    }
  | {
      errorMessage: string | null;
      type: 'set-error';
    };

export function createInitialPokerClientState(
  connection: PokerConnectionState,
): PokerClientState {
  return {
    connection,
    errorMessage: connection.lastError,
    eventFeed: [],
    lastEvent: null,
    roomState: null,
    session: {
      playerId: null,
      playerName: null,
      seatIndex: null,
      shouldResume: false,
      tableId: null,
    },
  };
}

function appendEvents(eventFeed: PokerServerEvent[], events: PokerServerEvent[]) {
  if (events.length === 0) {
    return eventFeed;
  }

  return [...events, ...eventFeed].slice(0, EVENT_FEED_LIMIT);
}

export function pokerClientReducer(
  state: PokerClientState,
  action: PokerClientAction,
): PokerClientState {
  if (action.type === 'set-error') {
    return {
      ...state,
      errorMessage: action.errorMessage,
    };
  }

  const notification = action.notification;

  if (notification.type === 'connection') {
    return {
      ...state,
      connection: {
        ...state.connection,
        ...notification.connection,
      },
      errorMessage:
        notification.connection.status === 'connected'
          ? state.errorMessage
          : notification.connection.lastError ?? state.errorMessage,
    };
  }

  if (notification.type === 'error') {
    return {
      ...state,
      connection: {
        ...state.connection,
        lastError: notification.message,
      },
      errorMessage: notification.message,
    };
  }

  if (notification.type === 'session') {
    return {
      ...state,
      session: {
        ...state.session,
        ...notification.session,
      },
    };
  }

  return {
    ...state,
    errorMessage: state.connection.lastError && !notification.roomState ? state.connection.lastError : state.errorMessage,
    eventFeed: appendEvents(state.eventFeed, notification.events),
    lastEvent: notification.events[0] ?? state.lastEvent,
    roomState: notification.roomState,
    session: {
      ...state.session,
      playerId: notification.roomState?.selfId ?? state.session.playerId,
      shouldResume: Boolean(notification.roomState?.tableId && state.session.playerName),
      tableId: notification.roomState?.tableId ?? state.session.tableId,
    },
  };
}
