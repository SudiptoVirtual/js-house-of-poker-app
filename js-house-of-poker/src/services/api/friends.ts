import type { FriendsPlayer, PlayerActivityStatus, RelationshipStatus } from '../../types/friends';
import { ApiError, apiRequest } from './client';

type BackendId =
  | number
  | string
  | { $oid?: number | string; id?: number | string; _id?: number | string; userId?: number | string }
  | null
  | undefined;

type BackendRelationshipStatus =
  | 'blocked'
  | 'friend'
  | 'friends'
  | 'none'
  | 'not_friends'
  | 'pending_received'
  | 'pending_sent'
  | 'request_received'
  | 'request_sent'
  | string
  | null
  | undefined;

type BackendFriendRequest = {
  id?: BackendId;
  _id?: BackendId;
  receiverUserId?: BackendId;
  senderUserId?: BackendId;
  status?: string;
};

type BackendFriendPlayer = {
  _id?: BackendId;
  avatar?: string | null;
  displayName?: string;
  email?: string;
  handle?: string;
  id?: BackendId;
  isOnline?: boolean;
  name?: string;
  playerStatus?: string | { tier?: string; status?: string } | null;
  relationshipStatus?: BackendRelationshipStatus;
  request?: BackendFriendRequest | null;
  requestId?: BackendId;
  status?: string;
  statusIcon?: string;
  userId?: BackendId;
  username?: string;
};

type FriendListResponse = {
  count?: number;
  friends?: BackendFriendPlayer[];
  players?: BackendFriendPlayer[];
  results?: BackendFriendPlayer[];
  users?: BackendFriendPlayer[];
};

type FriendSearchResponse = FriendListResponse;

type FriendActionResponse = {
  message?: string;
  request?: BackendFriendRequest | null;
  requestId?: BackendId;
  status?: BackendRelationshipStatus;
};

type ChatInviteInput = {
  message?: string;
  roomId?: string;
  userId: string;
};

type ChatInviteResponse = {
  invitedPlayerIds?: string[];
  message?: string;
  status?: string;
};

function normalizeIdentifier(value: BackendId): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'object') {
    return normalizeIdentifier(value.$oid ?? value.userId ?? value.id ?? value._id);
  }

  const identifier = String(value).trim();

  return identifier === 'undefined' || identifier === 'null' || identifier === '[object Object]' ? '' : identifier;
}

function normalizeUsername(player: BackendFriendPlayer, displayName: string, id: string) {
  const username = player.username ?? player.handle ?? player.email?.split('@')[0] ?? displayName;
  const normalized = username.replace(/^@/, '').trim();

  return normalized || `player-${id.slice(-6)}`;
}

function normalizeActivityStatus(player: BackendFriendPlayer): PlayerActivityStatus {
  const rawStatus =
    typeof player.playerStatus === 'object' && player.playerStatus !== null
      ? (player.playerStatus.tier ?? player.playerStatus.status)
      : player.playerStatus;
  const status = String(rawStatus ?? player.status ?? '').toLowerCase();

  if (status.includes('357')) {
    return 'playing_357';
  }

  if (status.includes('table')) {
    return 'at_table';
  }

  if (status.includes('chat')) {
    return 'in_chat_room';
  }

  if (status.includes('lobby')) {
    return 'in_lobby';
  }

  return player.isOnline ? 'online' : 'offline';
}

function normalizeRelationshipStatus(status: BackendRelationshipStatus): RelationshipStatus {
  switch (status) {
    case 'friend':
    case 'friends':
      return 'friend';
    case 'pending_sent':
    case 'request_sent':
      return 'request_sent';
    case 'pending_received':
    case 'request_received':
      return 'request_received';
    case 'none':
    case 'not_friends':
    default:
      return 'not_friends';
  }
}

function getPlayersFromResponse(response: FriendListResponse) {
  return response.friends ?? response.players ?? response.users ?? response.results ?? [];
}

function toFriendsPlayer(player: BackendFriendPlayer, defaultRelationshipStatus: RelationshipStatus): FriendsPlayer | null {
  const id = normalizeIdentifier(player.userId ?? player.id ?? player._id);

  if (!id) {
    return null;
  }

  const displayName = player.displayName ?? player.name ?? player.username ?? player.email?.split('@')[0] ?? 'Player';

  return {
    activityStatus: normalizeActivityStatus(player),
    avatar: player.avatar ?? undefined,
    displayName,
    id,
    isOnline: Boolean(player.isOnline),
    relationshipStatus: player.relationshipStatus
      ? normalizeRelationshipStatus(player.relationshipStatus)
      : defaultRelationshipStatus,
    requestId: normalizeIdentifier(player.requestId ?? player.request?.id ?? player.request?._id) || undefined,
    username: normalizeUsername(player, displayName, id),
  };
}

function normalizePlayers(response: FriendListResponse, defaultRelationshipStatus: RelationshipStatus) {
  return getPlayersFromResponse(response)
    .map((player) => toFriendsPlayer(player, defaultRelationshipStatus))
    .filter((player): player is FriendsPlayer => Boolean(player));
}

async function requestFirstAvailable<T>(paths: string[], token: string) {
  let notFoundError: unknown = null;

  for (const path of paths) {
    try {
      return await apiRequest<T>(path, { token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notFoundError = error;
        continue;
      }

      throw error;
    }
  }

  throw notFoundError ?? new Error('Friends API route was not found.');
}

export async function fetchFriends(token: string) {
  const response = await requestFirstAvailable<FriendListResponse>(['/api/friends', '/api/friends/list'], token);

  return normalizePlayers(response, 'friend');
}

export async function fetchOnlineFriends(token: string) {
  try {
    const response = await requestFirstAvailable<FriendListResponse>(['/api/friends/online'], token);

    return normalizePlayers(response, 'friend').filter((player) => player.isOnline);
  } catch {
    const friends = await fetchFriends(token);

    return friends.filter((player) => player.isOnline);
  }
}

export async function searchPlayers(query: string, token: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const encodedQuery = encodeURIComponent(trimmedQuery);
  const response = await requestFirstAvailable<FriendSearchResponse>(
    [`/api/friends/search?q=${encodedQuery}`, `/api/friends/search?query=${encodedQuery}`],
    token,
  );

  return normalizePlayers(response, 'not_friends');
}

export async function sendFriendRequest(userId: string, token: string) {
  return apiRequest<FriendActionResponse>('/api/friends/request', {
    body: { receiverUserId: userId },
    method: 'POST',
    token,
  });
}

export async function acceptFriendRequest(input: { requestId?: string; userId: string }, token: string) {
  return apiRequest<FriendActionResponse>('/api/friends/accept', {
    body: input.requestId ? { requestId: input.requestId } : { senderUserId: input.userId },
    method: 'POST',
    token,
  });
}

export async function rejectFriendRequest(input: { requestId?: string; userId: string }, token: string) {
  return apiRequest<FriendActionResponse>('/api/friends/decline', {
    body: input.requestId ? { requestId: input.requestId } : { senderUserId: input.userId },
    method: 'POST',
    token,
  });
}

export async function sendChatInvite({ message, roomId, userId }: ChatInviteInput, token: string) {
  return apiRequest<ChatInviteResponse>('/api/friends/invites/chat', {
    body: { message, receiverUserId: userId, roomId },
    method: 'POST',
    token,
  });
}
