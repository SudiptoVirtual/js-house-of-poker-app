import { routes } from '../../constants/routes';
import { env } from '../../config/env';
import type { RootStackParamList } from '../../types/navigation';
import { apiRequest } from '../api/client';
import { createSocketManager } from '../socket/socketManager';

export type NotificationCenterType =
  | 'feed_comment' | 'feed_share' | 'feed_gift_clip' | 'feed_support' | 'feed_promotion'
  | 'friend_request' | 'friend_request_accepted' | 'friend_request_declined'
  | 'table_invite' | 'table_player_joined' | 'feed_table_invite' | 'chat_message' | 'chat_room_invite'
  | 'chat_room_gift_clip' | 'table_launched_from_chat' | 'mention' | 'gifted_buy_in' | 'admin_message';

export type NotificationRecord = {
  id: string;
  actorUserId: string | null;
  body: string;
  chatRoomId: string | null;
  createdAt: string;
  data: Record<string, any>;
  messageId: string | null;
  postId: string | null;
  readAt: string | null;
  tableId: string | null;
  title: string;
  type: NotificationCenterType;
  userId: string;
};

export type NotificationListResponse = {
  notifications: NotificationRecord[];
  unreadCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
  total: number;
};

export type NotificationNavigationTarget =
  | { route: typeof routes.Feed; params?: RootStackParamList['Feed'] }
  | { route: typeof routes.UserProfile; params: RootStackParamList['UserProfile'] }
  | { route: typeof routes.ChatRoomDetail; params: RootStackParamList['ChatRoomDetail'] }
  | { route: typeof routes.Game; params?: RootStackParamList['Game'] }
  | { route: typeof routes.Friends; params?: RootStackParamList['Friends'] }
  | { route: typeof routes.Home; params?: RootStackParamList['Home'] };

const TYPE_LABELS: Record<NotificationCenterType, { icon: string; label: string }> = {
  admin_message: { icon: 'bullhorn', label: 'Admin message' },
  chat_message: { icon: 'chat-processing', label: 'Chat message' },
  chat_room_gift_clip: { icon: 'gift', label: 'Chat gift' },
  chat_room_invite: { icon: 'chat-plus', label: 'Chat invite' },
  feed_comment: { icon: 'comment-text', label: 'Feed comment' },
  feed_gift_clip: { icon: 'gift', label: 'Feed gift' },
  feed_promotion: { icon: 'trending-up', label: 'Feed promotion' },
  feed_share: { icon: 'share-variant', label: 'Feed share' },
  feed_support: { icon: 'heart', label: 'Feed support' },
  feed_table_invite: { icon: 'poker-chip', label: 'Feed table invite' },
  friend_request: { icon: 'account-plus', label: 'Friend request' },
  friend_request_accepted: { icon: 'account-check', label: 'Friend accepted' },
  friend_request_declined: { icon: 'account-cancel', label: 'Friend declined' },
  gifted_buy_in: { icon: 'cash-plus', label: 'Gifted buy-in' },
  mention: { icon: 'at', label: 'Mention' },
  table_invite: { icon: 'cards-playing', label: 'Table invite' },
  table_player_joined: { icon: 'account-arrow-right', label: 'Table joined' },
  table_launched_from_chat: { icon: 'rocket-launch', label: 'Table launched' },
};

export function getNotificationPresentation(type: NotificationCenterType) {
  return TYPE_LABELS[type] ?? { icon: 'bell', label: 'Notification' };
}

export function mergeNotifications(existing: NotificationRecord[], incoming: NotificationRecord[]) {
  const byId = new Map<string, NotificationRecord>();
  [...incoming, ...existing].forEach((notification) => byId.set(notification.id, notification));
  return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getNotificationNavigationTarget(notification: NotificationRecord): NotificationNavigationTarget {
  const data = notification.data || {};
  const postId = notification.postId || data.postId || data.route?.params?.postId;
  const chatRoomId = notification.chatRoomId || data.chatRoomId;
  const tableCode = data.tableCode || data.table?.tableCode || data.table?.tableId;

  if (postId) return { route: routes.Feed, params: { notificationId: notification.id, postId } };
  if (chatRoomId) return { route: routes.ChatRoomDetail, params: { roomId: chatRoomId } };
  if (tableCode || notification.tableId) return { route: routes.Game, params: { gameId: tableCode || notification.tableId, tableCode } };
  if (notification.actorUserId) return { route: routes.UserProfile, params: { userId: notification.actorUserId } };
  if (notification.type.startsWith('friend_')) return { route: routes.Friends };
  return { route: routes.Home };
}

export function fetchNotifications(token: string, page = 1, limit = 25) {
  return apiRequest<NotificationListResponse>(`/api/notifications?page=${page}&limit=${limit}`, { token });
}

export function fetchUnreadNotificationCount(token: string) {
  return apiRequest<{ unreadCount: number }>('/api/notifications/unread-count', { token });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<{ unreadCount: number; readAt: string }>('/api/notifications/read-all', { method: 'POST', token });
}

type SubscribeOptions = { token: string; onNotification: (n: NotificationRecord, unreadCount?: number) => void; onError?: (message: string) => void };

export function subscribeNotificationCenter({ token, onNotification, onError }: SubscribeOptions) {
  const client = createSocketManager({ kind: 'socket', label: 'Notifications', url: env.poker.socketUrl });
  client.setAuth({ token });
  const off = client.on<{ notification?: NotificationRecord; unreadCount?: number }>('notification:new', (payload) => {
    if (payload?.notification?.id) onNotification(payload.notification, payload.unreadCount);
  });
  void client.connect().catch((error) => onError?.(error instanceof Error ? error.message : 'Notifications unavailable.'));
  return () => { off(); client.destroy(); };
}
