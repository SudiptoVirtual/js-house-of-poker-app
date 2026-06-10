import { env } from '../../config/env';
import { createSocketManager } from '../socket/socketManager';

export const friendRealtimeEvents = {
  notification: 'friend:notification',
  requestAccepted: 'friends:request_accepted',
  requestDeclined: 'friends:request_declined',
  requestReceived: 'friends:request_received',
  statusUpdated: 'friends:status_updated',
} as const;

export type FriendRealtimeEventName = (typeof friendRealtimeEvents)[keyof typeof friendRealtimeEvents];

export type FriendRealtimeUser = {
  avatar?: string | null;
  email?: string | null;
  id?: string;
  name?: string | null;
  userId?: string;
};

export type FriendRealtimeRequest = {
  id?: string;
  receiverUserId?: string;
  senderUserId?: string;
  status?: string;
};

export type FriendRealtimePayload = {
  actorUserId?: string | null;
  notification?: { id?: string; [key: string]: unknown };
  otherUser?: FriendRealtimeUser | null;
  otherUserId?: string | null;
  request?: FriendRealtimeRequest | null;
  requestId?: string | null;
  status?: string;
  [key: string]: unknown;
};

type SubscribeFriendRealtimeOptions = {
  onEvent: (payload: FriendRealtimePayload, eventName: FriendRealtimeEventName) => void;
  onError?: (message: string) => void;
  socketUrl?: string;
  token: string;
};

export function subscribeFriendRealtime({ onError, onEvent, socketUrl, token }: SubscribeFriendRealtimeOptions) {
  const socketManager = createSocketManager({
    kind: 'socket',
    label: 'Friend Socket.IO backend',
    url: socketUrl || env.poker.socketUrl,
  });

  socketManager.setAuth({ token });
  const unsubscribers = Object.values(friendRealtimeEvents).map((eventName) =>
    socketManager.on<FriendRealtimePayload>(eventName, (payload) => onEvent(payload, eventName)),
  );

  // The token in the Socket.IO handshake authenticates and rejoins the user room on every reconnect.
  void socketManager.connect().catch((error) => {
    onError?.(error instanceof Error ? error.message : 'Friend notifications are unavailable.');
  });

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    socketManager.destroy();
  };
}
