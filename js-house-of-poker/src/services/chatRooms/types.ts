import type { PokerGameSettingsUpdate } from '../../types/poker';
import type { ChatRoomMediaAttachment, ChatRoomMessage, ChatRoomPlayer } from '../../types/chatRooms';

export type ChatRoomSocketError = string | {
  code?: string;
  message?: string;
};

export type ChatRoomSocketAck = {
  error?: ChatRoomSocketError;
  ok?: boolean;
  requestId?: string;
  success?: boolean;
};

export type ChatRoomAuthenticatedRequest = {
  token?: string | null;
};

export type ChatRoomIdRequest = ChatRoomAuthenticatedRequest & {
  chatRoomId?: string;
  chatRoomRoomId?: string;
  roomId: string;
  sourceRoomId?: string;
};

export type ChatRoomInviteEligibility = {
  eligiblePlayerIds: string[];
  ineligiblePlayerIds?: string[];
  invitedPlayerIds: string[];
  reasonByPlayerId?: Record<string, string | null>;
  reasonByUserId?: Record<string, string | null>;
};

export type ChatRoomPresencePlayer = ChatRoomPlayer & {
  avatar?: string | null;
  displayName: string;
  handle: string;
  id?: string;
  inviteEligible?: boolean;
  inviteEligibilityReason?: string | null;
  isConnected?: boolean;
  isOnline?: boolean;
  joinedAt?: string | null;
  lastSeenAt?: string | null;
  playerId?: string;
  socketCount?: number;
  socketId?: string | null;
  socketIds?: string[];
  userId: string;
};

export type ChatRoomPresencePayload = {
  activePlayerCount: number;
  inviteEligibility: ChatRoomInviteEligibility;
  players: ChatRoomPresencePlayer[];
  roomId: string;
  totalPlayerCount: number;
  updatedAt: string;
};

export type JoinChatRoomRequest = ChatRoomIdRequest;

export type JoinChatRoomResponse = ChatRoomSocketAck & {
  activePlayers?: ChatRoomPresencePlayer[];
  messages?: ChatRoomMessage[];
  playerId?: string;
  players?: ChatRoomPresencePlayer[];
  presenceSnapshot?: ChatRoomPresencePayload;
  readAt?: string | Date;
  roomId?: string;
  unreadCount?: number;
};

export type LeaveChatRoomRequest = ChatRoomIdRequest;

export type LeaveChatRoomResponse = ChatRoomSocketAck & {
  activePlayers?: ChatRoomPresencePlayer[];
  players?: ChatRoomPresencePlayer[];
  presenceSnapshot?: ChatRoomPresencePayload;
  roomId?: string;
};

export type SendChatRoomMessageRequest = ChatRoomIdRequest & {
  attachments?: ChatRoomMediaAttachment[];
  body?: string;
  clientMessageId?: string;
  media?: ChatRoomMediaAttachment[];
  message?: string;
  text?: string;
};

export type NewChatRoomMessagePayload = {
  message: ChatRoomMessage;
  roomId: string;
};

export type SendChatRoomMessageResponse = ChatRoomSocketAck & NewChatRoomMessagePayload;

export type ChatRoomSystemMessageRequest = ChatRoomIdRequest & {
  aiPrimeContext?: Record<string, unknown> | null;
  body?: string;
  message?: string;
  senderDisplayName?: string;
  text?: string;
};

export type ChatRoomSystemMessageResponse = ChatRoomSocketAck & NewChatRoomMessagePayload;

export type AIPrimeActionRequest = ChatRoomIdRequest & {
  actionId?: string;
  body?: string;
  gameSettings?: PokerGameSettingsUpdate;
  maxBetClips?: number;
  invitedPlayerIds?: string[];
  tableTierId?: string | Record<string, unknown> | null;
  visibility?: string;
};

export type AIPrimeActionResponse = ChatRoomSocketAck & Partial<NewChatRoomMessagePayload> & {
  actionId?: string;
};

export type SendChatRoomGiftClipRequest = ChatRoomIdRequest & {
  amount?: number;
  clips?: number;
  message?: string;
  recipientUserId: string;
};

export type SendChatRoomGiftClipResponse = ChatRoomSocketAck & NewChatRoomMessagePayload & {
  recipient?: unknown;
  sender?: unknown;
  transactionIds?: string[] | Record<string, string | null>;
};

export type SendChatRoomGiftClipsRequest = SendChatRoomGiftClipRequest;
export type SendChatRoomGiftClipsResponse = SendChatRoomGiftClipResponse;

export type ChatRoomTypingRequest = ChatRoomIdRequest & {
  isTyping?: boolean;
};

export type ChatRoomTypingPayload = {
  isTyping: boolean;
  playerId: string;
  playerName: string;
  roomId: string;
  userId?: string;
};

export type ChatRoomTypingResponse = ChatRoomSocketAck & ChatRoomTypingPayload;

export type ChatRoomMessageNotificationPayload = {
  message?: ChatRoomMessage | null;
  notification?: unknown;
  preview?: string;
  roomId?: string | null;
  type?: string;
  unreadCount?: number;
};

export type ChatRoomNotificationsReadPayload = {
  modifiedCount?: number;
  readAt?: string | Date;
  roomId: string;
  unreadCount: number;
};

export type CreateTableFromChatRoomRequest = ChatRoomIdRequest & {
  gameSettings?: PokerGameSettingsUpdate;
  maxBetClips?: number;
  invitedPlayerIds?: string[];
  name?: string;
  playerCount?: number;
  rules?: unknown;
  tableName?: string;
  tableTier?: string | Record<string, unknown> | null;
  tableTierId?: string | Record<string, unknown> | null;
  visibility?: 'room' | 'private' | 'public' | 'invite-only' | string;
};

export type LaunchFromChatRoomPayload = {
  chatRoomId: string;
  createdAt?: string;
  createdByPlayerId?: string | null;
  deliveredPlayerIds?: string[];
  gameSettings?: PokerGameSettingsUpdate;
  invitedPlayerIds?: string[];
  launchedAt?: string;
  launchedByUserId?: string;
  roomId?: string;
  sender?: boolean;
  success?: boolean;
  tableCode?: string;
  tableDbId?: string;
  tableId?: string;
  tableName?: string;
  tableTier?: string | Record<string, unknown> | null;
  visibility?: string;
};

export type CreateTableFromChatRoomResponse = ChatRoomSocketAck & LaunchFromChatRoomPayload;
export type CreateTableFromAiPrimeRequest = CreateTableFromChatRoomRequest & { aiPrime?: boolean; source?: string };
export type CreateTableFromAiPrimeResponse = CreateTableFromChatRoomResponse;

export type InviteRoomPlayersRequest = ChatRoomIdRequest & {
  alreadyInvitedPlayerIds?: string[];
  invitedPlayerIds?: string[];
  message?: string;
  playerIds?: string[];
  tableCode?: string;
  tableId: string;
};

export type ChatRoomTableInvite = {
  createdAt?: string | Date;
  giftBuyInChips?: number;
  giftBuyInClips?: number;
  id: string;
  message?: string | null;
  recipientAccountId?: string;
  recipientHandle?: string;
  recipientLabel?: string;
  senderPlayerId?: string;
  senderPlayerName?: string;
  source?: string;
  status?: string;
};

export type InviteRoomPlayerResult = {
  inviteId?: string;
  ok: boolean;
  playerId: string;
  reason?: string;
  status: 'failed' | 'invited' | 'pending' | string;
  success: boolean;
};

export type ChatRoomPlayerInvitedPayload = {
  chatRoomId: string;
  deliveredPlayerIds?: string[];
  invite?: ChatRoomTableInvite;
  inviteEligibility?: ChatRoomInviteEligibility;
  inviteId?: string;
  invitedPlayerId?: string;
  invitedPlayerIds?: string[];
  invites?: ChatRoomTableInvite[];
  message?: string | null;
  playerId?: string;
  playerIds?: string[];
  recipient?: boolean;
  results?: InviteRoomPlayerResult[];
  sender?: boolean;
  senderPlayerId?: string;
  senderPlayerName?: string;
  tableCode?: string | null;
  tableDbId?: string | null;
  tableId?: string | null;
  tableName?: string | null;
};

export type InviteRoomPlayersResponse = ChatRoomSocketAck & ChatRoomPlayerInvitedPayload;

export type LaunchFromChatRoomRequest = ChatRoomIdRequest & {
  tableCode?: string;
  tableId: string;
};

export type LaunchFromChatRoomResponse = ChatRoomSocketAck & LaunchFromChatRoomPayload;
