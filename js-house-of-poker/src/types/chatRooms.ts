export type ChatRoomPlayerStatus = 'available' | 'inTable' | 'away';

export interface ChatRoomPlayer {
  id: string;
  userId?: string;
  displayName: string;
  handle: string;
  avatarInitials: string;
  status: ChatRoomPlayerStatus;
  chipStackLabel: string;
  isHost?: boolean;
}

export interface ChatRoomMessage {
  id: string;
  roomId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  playerId?: string | null;
  playerName?: string;
  text?: string;
  createdAt: string;
  tone?: 'system' | 'player';
}

export interface ChatRoomTableConfig {
  gameLabel: string;
  stakesLabel: string;
  maxSeats: number;
  seatsOpen: number;
  tableCode: string;
  isPrivate: boolean;
}

export interface ChatRoomInviteState {
  roomId: string;
  pendingInvites: string[];
  shareLink: string;
  suggestedHandles: string[];
}

export interface ChatRoom {
  id: string;
  title: string;
  description: string;
  topic: string;
  unreadCount: number;
  activePlayerCount: number;
  lastMessagePreview: string;
  players: ChatRoomPlayer[];
  messages: ChatRoomMessage[];
  tableConfig: ChatRoomTableConfig;
  inviteState: ChatRoomInviteState;
}
