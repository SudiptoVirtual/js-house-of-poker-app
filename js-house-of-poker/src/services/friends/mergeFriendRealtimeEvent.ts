import type { FriendsPlayer } from '../../types/friends';
import type { FriendRealtimePayload } from './friendRealtimeService';

function requestIdOf(payload: FriendRealtimePayload) {
  return payload.requestId ?? payload.request?.id ?? null;
}

export function mergeIncomingFriendRequest(
  players: FriendsPlayer[],
  payload: FriendRealtimePayload,
): FriendsPlayer[] {
  const requestId = requestIdOf(payload);
  const otherUser = payload.otherUser;
  const playerId = otherUser?.id ?? otherUser?.userId ?? payload.otherUserId;

  if (!requestId || !playerId) {
    return players;
  }

  const incomingPlayer: FriendsPlayer = {
    activityStatus: 'offline',
    avatar: otherUser?.avatar ?? undefined,
    displayName: otherUser?.name?.trim() || 'A player',
    id: playerId,
    isOnline: false,
    relationshipStatus: 'request_received',
    requestId,
    username: otherUser?.email?.split('@')[0] || otherUser?.name?.trim() || 'player',
  };
  const existingIndex = players.findIndex(
    (player) => player.requestId === requestId || player.id === playerId,
  );

  if (existingIndex < 0) {
    return [incomingPlayer, ...players];
  }

  return players.map((player, index) =>
    index === existingIndex ? { ...player, ...incomingPlayer } : player,
  );
}

export function mergeIncomingFriendRequests(
  currentRequests: FriendsPlayer[],
  fetchedRequests: FriendsPlayer[],
): FriendsPlayer[] {
  const currentByRequest = new Map(
    currentRequests.map((player) => [player.requestId ?? player.id, player]),
  );

  return [
    ...fetchedRequests.map((player) => ({
      ...currentByRequest.get(player.requestId ?? player.id),
      ...player,
    })),
    ...currentRequests.filter((player) =>
      !fetchedRequests.some((fetched) =>
        (fetched.requestId && fetched.requestId === player.requestId) || fetched.id === player.id,
      ),
    ),
  ];
}

export function pendingIncomingFriendRequestIds(players: FriendsPlayer[]): Set<string> {
  return new Set(players.flatMap((player) => player.requestId ? [player.requestId] : []));
}

export function removeIncomingFriendRequest(
  players: FriendsPlayer[],
  requestId: string | undefined,
  playerId: string,
): FriendsPlayer[] {
  return players.filter((player) =>
    requestId ? player.requestId !== requestId : player.id !== playerId,
  );
}

export function buildFriendRequestBanner(payload: FriendRealtimePayload) {
  const id = requestIdOf(payload);

  if (!id) {
    return null;
  }

  return {
    id,
    senderName: payload.otherUser?.name?.trim() || 'A player',
  };
}

export function mergeFriendPresenceUpdate(
  players: FriendsPlayer[],
  payload: FriendRealtimePayload,
): FriendsPlayer[] {
  if (!payload.userId || typeof payload.isOnline !== 'boolean') {
    return players;
  }

  const isOnline = payload.isOnline;

  return players.map((player) => {
    if (player.id !== payload.userId) {
      return player;
    }

    return {
      ...player,
      activityStatus: isOnline
        ? player.activityStatus === 'offline' ? 'online' : player.activityStatus
        : 'offline',
      isOnline,
    };
  });
}
