import { env } from '../../config/env';
import { createSocketManager } from '../socket/socketManager';
import type { FeedPost, FeedPostType } from '../../types/feed';

export const feedRealtimeClientEvents = {
  join: 'feed:join',
  leave: 'feed:leave',
} as const;

export const feedRealtimeServerEvents = {
  commentCreated: 'feed:comment:created',
  error: 'feed:error',
  giftClipsSent: 'feed:giftClips:sent',
  joined: 'feed:joined',
  left: 'feed:left',
  notification: 'feed:notification',
  notificationNew: 'notification:new',
  playerInvited: 'table:playerInvited',
  postCreated: 'feed:post:created',
  postUpdated: 'feed:post:updated',
  promotionUpdated: 'feed:promotion:updated',
  shareCreated: 'feed:share:created',
  supportUpdated: 'feed:support:updated',
  tableInviteSent: 'feed:tableInvite:sent',
} as const;

type FeedRealtimePostPayload = {
  ok?: boolean;
  post?: FeedPost;
  postId?: string | null;
  postType?: FeedPostType;
  userId?: string | null;
};

export type FeedRealtimeNotificationPayload = {
  notification?: {
    id?: string;
    postId?: string | null;
    type?: string;
    [key: string]: unknown;
  };
  postId?: string | null;
  preview?: string;
  type?: string;
  unreadCount?: number;
};

export type FeedRealtimeTableInvitePayload = FeedRealtimePostPayload & {
  deliveredPlayerIds?: string[];
  invitedPlayerIds?: string[];
  invites?: unknown[];
  message?: string | null;
  table?: unknown;
};

export type FeedRealtimePlayerInvitedPayload = {
  invitedPlayerIds?: string[];
  playerIds?: string[];
  postId?: string | null;
  recipient?: boolean;
  senderPlayerId?: string;
  senderPlayerName?: string;
  source?: string;
  tableCode?: string | null;
  tableDbId?: string | null;
  tableId?: string | null;
  tableName?: string | null;
};

export type FeedRealtimeErrorPayload = {
  code?: string;
  message?: string;
};

export type FeedRealtimeRoomPayload = {
  ok?: boolean;
  playerId?: string;
  postId?: string | null;
  roomIds?: string[];
};

type FeedRealtimeClientOptions = {
  onError?: (payload: FeedRealtimeErrorPayload) => void;
  onJoined?: (payload: FeedRealtimeRoomPayload) => void;
  onLeft?: (payload: FeedRealtimeRoomPayload) => void;
  onNotification?: (payload: FeedRealtimeNotificationPayload, eventName: string) => void;
  onPlayerInvited?: (payload: FeedRealtimePlayerInvitedPayload) => void;
  onPostUpdate?: (payload: FeedRealtimePostPayload, eventName: string) => void;
  onTableInvite?: (payload: FeedRealtimeTableInvitePayload) => void;
  socketUrl?: string;
};

export function createFeedRealtimeClient(options: FeedRealtimeClientOptions = {}) {
  const socketManager = createSocketManager({
    kind: 'socket',
    label: 'Feed Socket.IO backend',
    url: options.socketUrl || env.poker.socketUrl,
  });
  let authToken: string | null = null;
  let isDestroyed = false;

  function emitJoin() {
    if (!authToken || isDestroyed || !socketManager.isConnected()) {
      return;
    }

    socketManager.emit(feedRealtimeClientEvents.join, { token: authToken });
  }

  const unsubscribeConnection = socketManager.onConnection((state) => {
    if (state.status === 'connected') {
      emitJoin();
    }
  });

  const unsubscribeEvents = [
    socketManager.on<FeedRealtimeRoomPayload>(feedRealtimeServerEvents.joined, (payload) => {
      options.onJoined?.(payload);
    }),
    socketManager.on<FeedRealtimeRoomPayload>(feedRealtimeServerEvents.left, (payload) => {
      options.onLeft?.(payload);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.postCreated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.postCreated);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.postUpdated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.postUpdated);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.commentCreated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.commentCreated);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.supportUpdated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.supportUpdated);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.shareCreated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.shareCreated);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.giftClipsSent, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.giftClipsSent);
    }),
    socketManager.on<FeedRealtimePostPayload>(feedRealtimeServerEvents.promotionUpdated, (payload) => {
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.promotionUpdated);
    }),
    socketManager.on<FeedRealtimeTableInvitePayload>(feedRealtimeServerEvents.tableInviteSent, (payload) => {
      options.onTableInvite?.(payload);
      options.onPostUpdate?.(payload, feedRealtimeServerEvents.tableInviteSent);
    }),
    socketManager.on<FeedRealtimeNotificationPayload>(feedRealtimeServerEvents.notification, (payload) => {
      options.onNotification?.(payload, feedRealtimeServerEvents.notification);
    }),
    socketManager.on<FeedRealtimeNotificationPayload>(feedRealtimeServerEvents.notificationNew, (payload) => {
      options.onNotification?.(payload, feedRealtimeServerEvents.notificationNew);
    }),
    socketManager.on<FeedRealtimePlayerInvitedPayload>(feedRealtimeServerEvents.playerInvited, (payload) => {
      options.onPlayerInvited?.(payload);
    }),
    socketManager.on<FeedRealtimeErrorPayload>(feedRealtimeServerEvents.error, (payload) => {
      options.onError?.(payload);
    }),
  ];

  return {
    async connect(token: string) {
      authToken = token;
      await socketManager.connect();
      emitJoin();
    },
    destroy() {
      isDestroyed = true;
      if (authToken && socketManager.isConnected()) {
        socketManager.emit(feedRealtimeClientEvents.leave, { token: authToken });
      }
      authToken = null;
      unsubscribeConnection();
      unsubscribeEvents.forEach((unsubscribe) => unsubscribe());
      socketManager.destroy();
    },
  };
}
