import type { PokerGameSettingsUpdate } from '../../types/poker';
import type { ChatRoomMessage, ChatRoomPlayer, ChatRoomTableConfig } from '../../types/chatRooms';

// TODO(chatRooms:socket): These request/response shapes are typed integration
// placeholders for the future chat-room backend. Do not treat them as production
// backend behavior until the socket contract is agreed and wired end-to-end.
export type ChatRoomSocketAck = {
  error?: string;
  requestId?: string;
  success: boolean;
};

export type JoinChatRoomRequest = {
  roomId: string;
  userId: string;
};

export type JoinChatRoomResponse = ChatRoomSocketAck & {
  messages?: ChatRoomMessage[];
  players?: ChatRoomPlayer[];
  roomId: string;
};

export type LeaveChatRoomRequest = {
  roomId: string;
  userId: string;
};

export type LeaveChatRoomResponse = ChatRoomSocketAck & {
  roomId: string;
};

export type SendChatRoomMessageRequest = {
  body: string;
  clientMessageId?: string;
  roomId: string;
  userId: string;
};

export type SendChatRoomMessageResponse = ChatRoomSocketAck & {
  message?: ChatRoomMessage;
  roomId: string;
};

export type NewChatRoomMessagePayload = {
  message: ChatRoomMessage;
  roomId: string;
};

export type ChatRoomTypingPayload = {
  isTyping: boolean;
  roomId: string;
  userId: string;
};

export type ChatRoomMessageNotificationPayload = {
  message: ChatRoomMessage;
  roomId: string;
  unreadCount: number;
};

export type CreateTableFromChatRoomRequest = {
  gameSettings?: PokerGameSettingsUpdate;
  invitedPlayerIds: string[];
  roomId: string;
  tableConfig?: Partial<ChatRoomTableConfig>;
  tableName?: string;
  userId: string;
};

export type CreateTableFromChatRoomResponse = ChatRoomSocketAck & {
  chatRoomId?: string;
  createdAt?: string;
  deliveredPlayerIds?: string[];
  gameSettings?: PokerGameSettingsUpdate;
  invitedPlayerIds?: string[];
  launchedByUserId?: string;
  roomId: string;
  tableCode?: string;
  tableDbId?: string;
  tableId?: string;
  tableName?: string;
};

export type InviteRoomPlayersRequest = {
  invitedPlayerIds: string[];
  roomId: string;
  tableId: string;
  userId: string;
};

export type InviteRoomPlayersResponse = ChatRoomSocketAck & {
  invitedPlayerIds: string[];
  roomId: string;
  tableId: string;
};

export type ChatRoomPlayerInvitedPayload = {
  invitedByUserId?: string;
  invitedPlayerId?: string;
  invitedPlayerIds?: string[];
  roomId: string;
  tableCode?: string;
  tableId: string;
};

export type LaunchFromChatRoomRequest = {
  roomId: string;
  tableId: string;
  userId: string;
};

export type LaunchFromChatRoomResponse = ChatRoomSocketAck & {
  chatRoomId?: string;
  createdAt?: string;
  deliveredPlayerIds?: string[];
  gameSettings?: PokerGameSettingsUpdate;
  invitedPlayerIds?: string[];
  launchedByUserId?: string;
  launchUrl?: string;
  roomId: string;
  tableCode?: string;
  tableDbId?: string;
  tableId: string;
  tableName?: string;
};
