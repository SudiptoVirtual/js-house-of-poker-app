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
