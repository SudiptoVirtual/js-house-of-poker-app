import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';

import {
  createPokerTransport,
  type CreatePokerRoomInput,
  type JoinPokerRoomInput,
  type PokerConnectionState,
  type PokerGameSettingsUpdate,
  type SendPokerTableInviteInput,
  type PokerServerEvent,
  type PokerServerEventType,
  type PokerSessionState,
  type PokerTransport,
  type PokerTransportKind,
} from '../services/poker';
import { createInitialPokerClientState, pokerClientReducer, type PokerClientState } from './pokerState';
import type { PokerAction, PokerRoomState } from '../types/poker';

type PokerActions = {
  allIn: () => void;
  bet: (amount: number) => void;
  call: () => void;
  check: () => void;
  connect: () => void;
  createRoom: (input: CreatePokerRoomInput) => void;
  createTable: (input: CreatePokerRoomInput) => void;
  disconnect: () => void;
  fold: () => void;
  joinRoom: (input: JoinPokerRoomInput) => void;
  joinTable: (input: JoinPokerRoomInput) => void;
  leaveRoom: () => void;
  leaveTable: () => void;
  raise: (amount: number) => void;
  rebuy: () => void;
  sendAction: (type: PokerAction, amount?: number) => void;
  sendTableInvite: (input: SendPokerTableInviteInput) => void;
  sendTableChatMessage: (message: string) => void;
  sitAtSeat: (seatIndex: number) => void;
  startGame: () => void;
  startHand: () => void;
  updateGameSettings: (update: PokerGameSettingsUpdate) => void;
};

type PokerContextValue = PokerClientState &
  PokerActions & {
    transportKind: PokerTransportKind;
    transportLabel: string;
    transportStatus: PokerConnectionState['status'];
  };

type PokerEventBus = {
  subscribe: (listener: (event: PokerServerEvent) => void) => () => void;
};

const PokerStateContext = createContext<PokerClientState | null>(null);
const PokerActionsContext = createContext<PokerActions | null>(null);
const PokerEventBusContext = createContext<PokerEventBus | null>(null);

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function PokerProvider({ children }: PropsWithChildren) {
  const transportRef = useRef<PokerTransport | null>(null);
  if (!transportRef.current) {
    transportRef.current = createPokerTransport();
  }

  const eventListenersRef = useRef(new Set<(event: PokerServerEvent) => void>());
  const [state, dispatch] = useReducer(
    pokerClientReducer,
    transportRef.current.getConnectionState(),
    createInitialPokerClientState,
  );

  useEffect(() => {
    const transport = transportRef.current!;
    const unsubscribe = transport.subscribe((notification) => {
      if (notification.type === 'table-sync' && notification.events.length > 0) {
        notification.events.forEach((event) => {
          eventListenersRef.current.forEach((listener) => listener(event));
        });
      }

      dispatch({
        notification,
        type: 'transport-notification',
      });
    });

    void transport.connect().catch((error) => {
      dispatch({
        errorMessage: toErrorMessage(error, 'Unable to initialize poker transport.'),
        type: 'set-error',
      });
    });

    return () => {
      unsubscribe();
      eventListenersRef.current.clear();
      transport.destroy();
    };
  }, []);

  function run(command: Promise<void>) {
    void command.catch((error) => {
      dispatch({
        errorMessage: toErrorMessage(error, 'Poker command failed.'),
        type: 'set-error',
      });
    });
  }

  const actions = useMemo<PokerActions>(
    () => ({
      allIn() {
        run(transportRef.current!.allIn());
      },
      bet(amount) {
        run(transportRef.current!.bet(amount));
      },
      call() {
        run(transportRef.current!.call());
      },
      check() {
        run(transportRef.current!.check());
      },
      connect() {
        run(transportRef.current!.connect());
      },
      createRoom(input) {
        run(transportRef.current!.createTable(input));
      },
      createTable(input) {
        run(transportRef.current!.createTable(input));
      },
      disconnect() {
        run(transportRef.current!.disconnect());
      },
      fold() {
        run(transportRef.current!.fold());
      },
      joinRoom(input) {
        run(
          transportRef.current!.joinTable({
            name: input.name,
            seatIndex: input.seatIndex,
            tableId: input.tableId,
          }),
        );
      },
      joinTable(input) {
        run(transportRef.current!.joinTable(input));
      },
      leaveRoom() {
        run(transportRef.current!.leaveTable());
      },
      leaveTable() {
        run(transportRef.current!.leaveTable());
      },
      raise(amount) {
        run(transportRef.current!.raise(amount));
      },
      rebuy() {
        run(transportRef.current!.rebuy());
      },
      sendAction(type, amount) {
        run(transportRef.current!.sendAction(type, amount));
      },
      sendTableInvite(input) {
        run(transportRef.current!.sendTableInvite(input));
      },
      sendTableChatMessage(message) {
        run(transportRef.current!.sendTableChatMessage(message));
      },
      sitAtSeat(seatIndex) {
        run(transportRef.current!.sitAtSeat({ seatIndex }));
      },
      startGame() {
        run(transportRef.current!.startGame());
      },
      startHand() {
        run(transportRef.current!.startGame());
      },
      updateGameSettings(update) {
        run(transportRef.current!.updateGameSettings(update));
      },
    }),
    [],
  );

  const eventBus = useMemo<PokerEventBus>(
    () => ({
      subscribe(listener) {
        eventListenersRef.current.add(listener);

        return () => {
          eventListenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  return (
    <PokerEventBusContext.Provider value={eventBus}>
      <PokerActionsContext.Provider value={actions}>
        <PokerStateContext.Provider value={state}>{children}</PokerStateContext.Provider>
      </PokerActionsContext.Provider>
    </PokerEventBusContext.Provider>
  );
}

function usePokerState() {
  const context = useContext(PokerStateContext);

  if (!context) {
    throw new Error('usePokerState must be used inside PokerProvider.');
  }

  return context;
}

function usePokerActionsContext() {
  const context = useContext(PokerActionsContext);

  if (!context) {
    throw new Error('usePokerActions must be used inside PokerProvider.');
  }

  return context;
}

export function usePoker() {
  const state = usePokerState();
  const actions = usePokerActionsContext();

  return {
    ...state,
    ...actions,
    transportKind: state.connection.kind,
    transportLabel: state.connection.label,
    transportStatus: state.connection.status,
  } satisfies PokerContextValue;
}

export function usePokerTable() {
  return usePokerState().roomState;
}

export function usePokerConnection() {
  return usePokerState().connection;
}

export function usePokerSession() {
  return usePokerState().session;
}

export function usePokerActions() {
  return usePokerActionsContext();
}

export function usePokerEventSubscription(
  eventTypes: PokerServerEventType | PokerServerEventType[] | null,
  listener: (event: PokerServerEvent) => void,
) {
  const eventBus = useContext(PokerEventBusContext);
  const listenerRef = useRef(listener);
  const normalizedTypes = Array.isArray(eventTypes)
    ? [...eventTypes].sort().join('|')
    : eventTypes ?? '*';

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    if (!eventBus) {
      throw new Error('usePokerEventSubscription must be used inside PokerProvider.');
    }

    const allowedTypes =
      eventTypes == null
        ? null
        : new Set(Array.isArray(eventTypes) ? eventTypes : [eventTypes]);

    return eventBus.subscribe((event) => {
      if (!allowedTypes || allowedTypes.has(event.type)) {
        listenerRef.current(event);
      }
    });
  }, [eventBus, normalizedTypes, eventTypes]);
}

export type { PokerConnectionState, PokerRoomState, PokerSessionState };
