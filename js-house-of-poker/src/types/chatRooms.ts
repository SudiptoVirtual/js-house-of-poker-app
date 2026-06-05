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

export interface ChatRoomFriend {
  avatarInitials: string;
  displayName: string;
  handle: string;
  id: string;
  isOnline: boolean;
  name: string;
  status: ChatRoomPlayerStatus;
  userId?: string;
}

export type ChatRoomMessageKind = 'message' | 'system' | 'gift_clip';

export interface ChatRoomGiftClipMetadata {
  amount: number;
  message: string;
  recipientTransactionId: string | null;
  recipientUserId: string | null;
  senderTransactionId: string | null;
  transactionId: string | null;
  transactionIds: {
    recipient: string | null;
    sender: string | null;
  };
}

export interface ChatRoomMessage {
  id: string;
  roomId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  giftClip?: ChatRoomGiftClipMetadata | null;
  kind?: ChatRoomMessageKind;
  messageType?: ChatRoomMessageKind;
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
