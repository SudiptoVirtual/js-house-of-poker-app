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
  lastActiveAt?: string | null;
  lastInteractionAt?: string | null;
  lastMessageAt?: string | null;
  name?: string;
  playerStatus?: string | { tier?: string; status?: string } | null;
  relationshipStatus?: BackendRelationshipStatus;
  request?: BackendFriendRequest | null;
  requestId?: BackendId;
  status?: string;
  statusIcon?: string;
  updatedAt?: string | null;
  userId?: BackendId;
  username?: string;
};

type FriendListResponse = {
  count?: number;
  friends?: BackendFriendPlayer[];
  players?: BackendFriendPlayer[];
  requests?: BackendFriendPlayer[];
  results?: BackendFriendPlayer[];
  users?: BackendFriendPlayer[];
};

type FriendSearchResponse = FriendListResponse;

export type PublicUserProfile = FriendsPlayer & {
  gamesPlayed?: number;
  handsPlayed?: number;
  winRate?: number;
  totalWinnings?: number;
};

type FriendActionResponse = {
  message?: string;
  request?: BackendFriendRequest | null;
  requestId?: BackendId;
  status?: BackendRelationshipStatus;
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
  return response.friends ?? response.players ?? response.requests ?? response.users ?? response.results ?? [];
}

function getRecentActivityAt(player: BackendFriendPlayer): string | undefined {
  return player.lastActiveAt ?? player.lastInteractionAt ?? player.lastMessageAt ?? player.updatedAt ?? undefined;
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
    recentActivityAt: getRecentActivityAt(player),
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
  const response = await apiRequest<FriendListResponse>('/api/friends', { token });

  return normalizePlayers(response, 'friend');
}

export async function fetchIncomingFriendRequests(token: string) {
  const response = await apiRequest<FriendListResponse>('/api/friends/requests/incoming', { token });

  return normalizePlayers(response, 'request_received').map((player) => ({
    ...player,
    relationshipStatus: 'request_received' as const,
  }));
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


export async function fetchPublicUserProfile(userId: string, token: string) {
  const encodedUserId = encodeURIComponent(userId);
  const response = await requestFirstAvailable<{ player?: BackendFriendPlayer; user?: BackendFriendPlayer } & BackendFriendPlayer>(
    [
      `/api/friends/${encodedUserId}/details`,
      `/api/users/${encodedUserId}/public-profile`,
      `/api/friends/users/${encodedUserId}`,
      `/api/players/${encodedUserId}`,
    ],
    token,
  );
  const backendPlayer = response.player ?? response.user ?? response;
  const normalizedPlayer = toFriendsPlayer(backendPlayer, 'friend');

  if (!normalizedPlayer) {
    throw new Error('Unable to load this player profile.');
  }

  const statsSource = backendPlayer as BackendFriendPlayer & {
    gameplayStats?: { gamesPlayed?: number; handsPlayed?: number; totalWinnings?: number; winRate?: number };
    gamesPlayed?: number;
    handsPlayed?: number;
    totalWinnings?: number;
    winRate?: number;
  };

  return {
    ...normalizedPlayer,
    gamesPlayed: statsSource.gameplayStats?.gamesPlayed ?? statsSource.gamesPlayed,
    handsPlayed: statsSource.gameplayStats?.handsPlayed ?? statsSource.handsPlayed,
    totalWinnings: statsSource.gameplayStats?.totalWinnings ?? statsSource.totalWinnings,
    winRate: statsSource.gameplayStats?.winRate ?? statsSource.winRate,
  } satisfies PublicUserProfile;
}

export async function removeFriend(userId: string, token: string) {
  const encodedUserId = encodeURIComponent(userId);
  let notFoundError: unknown = null;

  for (const path of [`/api/friends/${encodedUserId}`, `/api/friends/remove/${encodedUserId}`]) {
    try {
      return await apiRequest<FriendActionResponse>(path, { method: 'DELETE', token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notFoundError = error;
        continue;
      }

      throw error;
    }
  }

  throw notFoundError ?? new Error('Remove friend API route was not found.');
}
