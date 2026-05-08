import type { PokerAction, PokerInviteSource, PokerRoomState } from '../../types/poker';

export type { PokerGameSettingsUpdate } from '../../types/poker';
import type { PokerGameSettingsUpdate } from '../../types/poker';

export type CreatePokerTableInput = {
  botCount?: number;
  gameSettings?: PokerGameSettingsUpdate;
  name: string;
  seatIndex?: number;
  tableName?: string;
};

export type JoinPokerTableInput = {
  name: string;
  seatIndex?: number;
  tableId: string;
};

export type SitAtSeatInput = {
  seatIndex: number;
};

export type SendPokerTableInviteInput = {
  giftClips?: number;
  message?: string;
  recipientAccountId: string;
  source: PokerInviteSource;
};

export type CreatePokerRoomInput = CreatePokerTableInput;

export type JoinPokerRoomInput = JoinPokerTableInput;

export type PokerTransportKind = 'local' | 'socket';

export type PokerConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type PokerConnectionState = {
  backendUrl: string | null;
  kind: PokerTransportKind;
  label: string;
  lastDisconnectReason: string | null;
  lastError: string | null;
  latencyMs: number | null;
  reconnectAttempts: number;
  socketId: string | null;
  status: PokerConnectionStatus;
};

export type PokerSessionState = {
  playerId: string | null;
  playerName: string | null;
  seatIndex: number | null;
  shouldResume: boolean;
  tableId: string | null;
};

export type PokerServerEventType =
  | 'cards-dealt'
  | 'community-cards-revealed'
  | 'game-started'
  | 'game-settings-updated'
  | 'player-action-made'
  | 'player-joined'
  | 'player-left'
  | 'player-turn-changed'
  | 'pot-updated'
  | 'round-ended'
  | 'table-chat-message'
  | 'table-joined'
  | 'table-left'
  | 'winner-declared';

export type PokerServerEvent = {
  id: string;
  occurredAt: number;
  payload: Record<string, unknown>;
  roomState: PokerRoomState | null;
  tableId: string | null;
  type: PokerServerEventType;
};

export type PokerTransportNotification =
  | {
      connection: Partial<PokerConnectionState> &
        Pick<PokerConnectionState, 'status'>;
      type: 'connection';
    }
  | {
      message: string | null;
      type: 'error';
    }
  | {
      events: PokerServerEvent[];
      roomState: PokerRoomState | null;
      type: 'table-sync';
    }
  | {
      session: Partial<PokerSessionState>;
      type: 'session';
    };

export type PokerTransportListener = (notification: PokerTransportNotification) => void;

export type PokerTransport = {
  allIn: () => Promise<void>;
  bet: (amount: number) => Promise<void>;
  call: () => Promise<void>;
  check: () => Promise<void>;
  connect: () => Promise<void>;
  createTable: (input: CreatePokerTableInput) => Promise<void>;
  destroy: () => void;
  disconnect: () => Promise<void>;
  fold: () => Promise<void>;
  getConnectionState: () => PokerConnectionState;
  joinTable: (input: JoinPokerTableInput) => Promise<void>;
  leaveTable: () => Promise<void>;
  raise: (amount: number) => Promise<void>;
  rebuy: () => Promise<void>;
  sendAction: (type: PokerAction, amount?: number) => Promise<void>;
  sendTableInvite: (input: SendPokerTableInviteInput) => Promise<void>;
  sendTableChatMessage: (message: string) => Promise<void>;
  sitAtSeat: (input: SitAtSeatInput) => Promise<void>;
  startGame: () => Promise<void>;
  subscribe: (listener: PokerTransportListener) => () => void;
  updateGameSettings: (update: PokerGameSettingsUpdate) => Promise<void>;
};
