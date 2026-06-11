import { env } from '../../config/env';
import type { ChatRoom, ChatRoomFriend, ChatRoomMessage, ChatRoomPlayer } from '../../types/chatRooms';
import { ApiError, apiRequest } from './client';

type BackendId =
  | number
  | string
  | { $oid?: number | string; id?: number | string; _id?: number | string; toString?: () => string }
  | null
  | undefined;

type BackendChatRoomMetadata = {
  gameSettings?: {
    game?: string;
  };
  gameType?: string;
  maxPlayers?: number;
  name?: string;
  roomId?: BackendId;
  tableCode?: string | null;
  tableName?: string;
};

type BackendChatRoomListItem = {
  activePlayerCount?: number;
  description?: string;
  gameType?: string;
  id?: BackendId;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  maxPlayers?: number;
  metadata?: BackendChatRoomMetadata;
  name?: string;
  recentMessagePreview?: {
    text?: string;
  } | null;
  roomId?: BackendId;
  slug?: string;
  tableCode?: string | null;
  tableName?: string;
  topic?: string;
  unreadCount?: number;
};

type BackendChatRoomPlayer = Omit<Partial<ChatRoomPlayer>, 'id' | 'status' | 'userId'> & {
  _id?: BackendId;
  chipsOnTable?: number;
  id?: BackendId;
  name?: string;
  playerName?: string;
  playerStatus?: string;
  status?: ChatRoomPlayer['status'] | string;
  userId?: BackendId;
  username?: string;
};

type BackendChatRoomMessage = Omit<Partial<ChatRoomMessage>, 'authorId' | 'createdAt' | 'id' | 'roomId'> & {
  _id?: BackendId;
  authorId?: BackendId;
  createdAt?: Date | number | string | null;
  id?: BackendId;
  messageId?: BackendId;
  roomId?: BackendId;
  senderDisplayName?: string;
  senderUserId?: BackendId;
};

type BackendChatRoomDetail = BackendChatRoomListItem & {
  activePlayers?: BackendChatRoomPlayer[];
  messages?: BackendChatRoomMessage[];
  players?: BackendChatRoomPlayer[];
  recentMessages?: BackendChatRoomMessage[];
};

type ChatRoomsResponse = {
  rooms?: BackendChatRoomListItem[];
};

type ChatRoomResponse = {
  room?: BackendChatRoomDetail;
};

type ActiveChatRoomFriendsResponse = {
  friends?: BackendChatRoomPlayer[];
};

type CreateChatRoomInput = {
  invitedPlayerIds?: string[];
  name: string;
};

type CreateChatRoomResponse = {
  invitedPlayerIds?: string[];
  room?: BackendChatRoomDetail;
};

type InviteChatRoomFriendsResponse = {
  alreadyInRoomPlayerIds?: string[];
  invitedPlayerIds?: string[];
  room?: BackendChatRoomDetail;
};

function normalizeIdentifier(value: BackendId): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'object') {
    const nestedId = value.$oid ?? value.id ?? value._id;

    if (nestedId != null) {
      return normalizeIdentifier(nestedId);
    }
  }

  const identifier = String(value).trim();

  return identifier === 'undefined' || identifier === 'null' || identifier === '[object Object]' ? '' : identifier;
}

function createHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function getUniqueIdentifier(candidateId: string, fallbackId: string, seenIds: Set<string>) {
  const baseId = candidateId || fallbackId;
  let nextId = baseId;
  let suffix = 2;

  while (seenIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  seenIds.add(nextId);
  return nextId;
}

function normalizeCreatedAt(value: BackendChatRoomMessage['createdAt']) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getBackendRoomName(room: BackendChatRoomListItem) {
  return room.name ?? room.tableName ?? room.metadata?.name ?? room.metadata?.tableName ?? 'Chat room';
}

function getBackendGameLabel(room: BackendChatRoomListItem) {
  const gameText = [
    room.gameType,
    room.metadata?.gameType,
    room.metadata?.gameSettings?.game,
    room.name,
    room.topic,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return gameText.includes('3-5-7') || gameText.includes('357') ? '3-5-7 Showdown' : "Texas Hold'em";
}

function getDefaultTableConfig(room: BackendChatRoomListItem) {
  const gameLabel = getBackendGameLabel(room);
  const isThreeFiveSeven = gameLabel.includes('3-5-7');
  const maxSeats = room.maxPlayers ?? room.metadata?.maxPlayers ?? (isThreeFiveSeven ? 3 : 6);

  return {
    gameLabel,
    isPrivate: false,
    maxSeats,
    seatsOpen: Math.max(0, maxSeats - (room.activePlayerCount ?? 0)),
    stakesLabel: 'Room-configured play chips',
    tableCode: normalizeIdentifier(room.tableCode ?? room.metadata?.tableCode ?? room.slug ?? room.roomId ?? room.id).toUpperCase(),
  };
}

function toChatRoomMessage(
  message: BackendChatRoomMessage,
  fallbackRoomId: string,
  index: number,
  seenMessageIds: Set<string>,
): ChatRoomMessage {
  const authorId = normalizeIdentifier(message.authorId ?? message.senderUserId ?? message.playerId) || null;
  const authorName = message.authorName ?? message.senderDisplayName ?? message.playerName ?? 'Player';
  const body = message.body ?? message.text ?? '';
  const createdAt = normalizeCreatedAt(message.createdAt);
  const roomId = normalizeIdentifier(message.roomId) || fallbackRoomId;
  const fallbackId = `message-${roomId || 'room'}-${index}-${createdAt}-${createHash(`${authorId ?? 'system'}:${authorName}:${body}`)}`;
  const id = getUniqueIdentifier(
    normalizeIdentifier(message.id ?? message._id ?? message.messageId),
    fallbackId,
    seenMessageIds,
  );

  const kind = message.kind ?? message.messageType ?? (message.tone === 'system' ? 'system' : 'message');

  return {
    authorId,
    authorName,
    body,
    createdAt,
    giftClip: message.giftClip ?? null,
    id,
    kind,
    messageType: message.messageType ?? kind,
    roomId,
    tone: message.tone ?? (kind === 'system' ? 'system' : 'player'),
  };
}

function toChatRoomPlayer(
  player: BackendChatRoomPlayer,
  fallbackRoomId: string,
  index: number,
  seenPlayerIds: Set<string>,
): ChatRoomPlayer {
  const displayName = player.displayName ?? player.playerName ?? player.name ?? player.username ?? 'Player';
  const handle = player.handle ?? player.username ?? displayName;
  const fallbackId = `player-${fallbackRoomId || 'room'}-${index}-${createHash(`${displayName}:${handle}`)}`;
  const id = getUniqueIdentifier(
    normalizeIdentifier(player.id ?? player.userId ?? player._id),
    fallbackId,
    seenPlayerIds,
  );
  const status: ChatRoomPlayer['status'] =
    player.status === 'away' || player.status === 'inTable' || player.status === 'available'
      ? player.status
      : player.playerStatus === 'SITTING_OUT'
        ? 'away'
        : 'available';

  return {
    avatarInitials: player.avatarInitials ?? 'P',
    chipStackLabel: player.chipStackLabel || (player.chipsOnTable ? `${player.chipsOnTable} chips` : 'Online now'),
    displayName,
    handle,
    id,
    isHost: player.isHost,
    status,
    userId: normalizeIdentifier(player.userId) || id,
  };
}

function toChatRoomFriend(friend: BackendChatRoomPlayer, index: number, seenFriendIds: Set<string>): ChatRoomFriend {
  const player = toChatRoomPlayer(friend, 'active-friends', index, seenFriendIds);

  return {
    avatarInitials: player.avatarInitials,
    displayName: player.displayName,
    handle: player.handle,
    id: player.id,
    isOnline: player.status === 'available',
    name: player.displayName,
    status: player.status,
    userId: player.userId,
  };
}

function toChatRoom(room: BackendChatRoomDetail, index = 0, seenRoomIds = new Set<string>()): ChatRoom {
  const title = getBackendRoomName(room);
  const id = getUniqueIdentifier(
    normalizeIdentifier(room.id ?? room.roomId ?? room.metadata?.roomId ?? room.slug),
    `room-${index}-${createHash(title)}`,
    seenRoomIds,
  );
  const seenPlayerIds = new Set<string>();
  const players = (room.players ?? room.activePlayers ?? []).map((player, playerIndex) =>
    toChatRoomPlayer(player, id, playerIndex, seenPlayerIds),
  );
  const seenMessageIds = new Set<string>();
  const messages = (room.messages ?? room.recentMessages ?? []).map((message, messageIndex) =>
    toChatRoomMessage(message, id, messageIndex, seenMessageIds),
  );
  const lastMessagePreview =
    room.lastMessagePreview ||
    room.recentMessagePreview?.text ||
    messages.at(-1)?.body ||
    'No messages yet. Start the room conversation.';

  return {
    activePlayerCount: room.activePlayerCount ?? players.length,
    description: room.description ?? 'Live social chat room.',
    id,
    inviteState: {
      pendingInvites: [],
      roomId: id,
      shareLink: `houseofpoker://chat-rooms/${room.slug ?? id}`,
      suggestedHandles: [],
    },
    lastMessagePreview,
    messages,
    players,
    tableConfig: getDefaultTableConfig(room),
    title,
    topic: room.topic ?? 'Live room chat',
    unreadCount: room.unreadCount ?? 0,
  };
}

function normalizeChatRoomApiError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    const configuredHost = env.apiBaseUrl || 'the configured API host';

    return new Error(
      `Chat room API route was not found on ${configuredHost}. Set EXPO_PUBLIC_BASE_URL to the poker-backend server.`,
    );
  }

  return error;
}

export async function fetchChatRooms(token?: string | null) {
  try {
    const response = await apiRequest<ChatRoomsResponse>('/api/chat-rooms', { token });
    const seenRoomIds = new Set<string>();

    return (response.rooms ?? []).map((room, index) => toChatRoom(room, index, seenRoomIds));
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}

export async function markChatRoomNotificationsRead(roomId: string, token: string) {
  try {
    return await apiRequest<{ ok?: boolean; roomId?: string; unreadCount?: number }>(
      `/api/chat-rooms/${encodeURIComponent(roomId)}/notifications/read`,
      { method: 'POST', token },
    );
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}

export async function fetchChatRoom(roomId: string, token?: string | null) {
  try {
    const response = await apiRequest<ChatRoomResponse>(`/api/chat-rooms/${encodeURIComponent(roomId)}`, { token });

    if (!response.room) {
      throw new Error('Chat room not found.');
    }

    return toChatRoom(response.room);
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}

export async function fetchActiveChatRoomFriends(token: string) {
  try {
    const response = await apiRequest<ActiveChatRoomFriendsResponse>('/api/chat-rooms/active-friends', { token });
    const seenFriendIds = new Set<string>();

    return (response.friends ?? []).map((friend, index) => toChatRoomFriend(friend, index, seenFriendIds));
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}

export async function createChatRoom(input: CreateChatRoomInput, token: string) {
  try {
    const response = await apiRequest<CreateChatRoomResponse>('/api/chat-rooms', {
      body: input,
      method: 'POST',
      token,
    });

    if (!response.room) {
      throw new Error('Created chat room was not returned by the server.');
    }

    return {
      invitedPlayerIds: response.invitedPlayerIds ?? [],
      room: toChatRoom(response.room),
    };
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}

export async function inviteChatRoomFriends(roomId: string, playerIds: string[], token: string) {
  try {
    const response = await apiRequest<InviteChatRoomFriendsResponse>(
      `/api/chat-rooms/${encodeURIComponent(roomId)}/invites`,
      {
        body: { playerIds },
        method: 'POST',
        token,
      },
    );

    return {
      alreadyInRoomPlayerIds: response.alreadyInRoomPlayerIds ?? [],
      invitedPlayerIds: response.invitedPlayerIds ?? [],
      room: response.room ? toChatRoom(response.room) : null,
    };
  } catch (error) {
    throw normalizeChatRoomApiError(error);
  }
}
