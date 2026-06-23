import { routes } from '../../constants/routes';
import type { RootStackParamList } from '../../types/navigation';
import {
  createFeedRealtimeClient,
  type FeedRealtimeNotificationPayload,
} from '../feed/feedRealtimeClient';

export type FeedNotificationType =
  | 'feed_comment'
  | 'feed_support'
  | 'feed_share'
  | 'feed_gift_clip'
  | 'feed_promotion'
  | 'feed_table_invite'
  | 'table_player_joined';

export type FeedNotificationNavigationTarget =
  | {
      params?: RootStackParamList['Feed'];
      route: typeof routes.Feed;
    }
  | {
      params?: RootStackParamList['Game'];
      route: typeof routes.Game;
    };

export type FeedNotification = {
  actorDisplayName: string;
  body: string;
  ctaLabel: string;
  eventName: string;
  id: string;
  label: string;
  navigationTarget: FeedNotificationNavigationTarget;
  postId: string | null;
  preview: string;
  tableCode: string | null;
  tableName: string | null;
  title: string;
  type: FeedNotificationType;
  unreadCount: number;
};

type RawNotificationRecord = NonNullable<FeedRealtimeNotificationPayload['notification']> & {
  body?: string;
  data?: {
    actorDisplayName?: string;
    actor?: {
      displayName?: string;
      name?: string;
    };
    postId?: string | null;
    route?: {
      params?: {
        postId?: string | null;
      };
    };
    table?: {
      tableCode?: string | null;
      tableId?: string | null;
      tableName?: string | null;
    };
    tableCode?: string | null;
    tableName?: string | null;
  };
  tableId?: string | null;
  title?: string;
};

type SubscribeFeedNotificationsOptions = {
  onNotification: (notification: FeedNotification) => void;
  onError?: (message: string) => void;
  socketUrl?: string;
  token: string;
};

type FeedNotificationTypeConfig = {
  ctaLabel: string;
  label: string;
  title: string;
};

const TYPE_CONFIG: Record<FeedNotificationType, FeedNotificationTypeConfig> = {
  feed_comment: {
    ctaLabel: 'View comment',
    label: 'Comment',
    title: 'New feed comment',
  },
  feed_gift_clip: {
    ctaLabel: 'View Gift Clips',
    label: 'Gift Clips',
    title: 'Gift Clips received',
  },
  feed_promotion: {
    ctaLabel: 'View promotion',
    label: 'Promotion',
    title: 'Feed post promoted',
  },
  feed_share: {
    ctaLabel: 'View share',
    label: 'Share',
    title: 'Feed post shared',
  },
  feed_support: {
    ctaLabel: 'View support',
    label: 'Support',
    title: 'New feed support',
  },
  feed_table_invite: {
    ctaLabel: 'Join table',
    label: 'Table invite',
    title: 'Feed table invite',
  },
  table_player_joined: {
    ctaLabel: 'Open table',
    label: 'Table joined',
    title: 'Player joined your table',
  },
};

function isFeedNotificationType(value: unknown): value is FeedNotificationType {
  return typeof value === 'string' && value in TYPE_CONFIG;
}

function asStringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPostId(payload: FeedRealtimeNotificationPayload, notification: RawNotificationRecord) {
  return (
    asStringOrNull(payload.postId) ??
    asStringOrNull(notification.postId) ??
    asStringOrNull(notification.data?.postId) ??
    asStringOrNull(notification.data?.route?.params?.postId)
  );
}

function getTableCode(notification: RawNotificationRecord) {
  return (
    asStringOrNull(notification.data?.tableCode) ??
    asStringOrNull(notification.data?.table?.tableCode) ??
    asStringOrNull(notification.data?.table?.tableId) ??
    asStringOrNull(notification.tableId)
  );
}

function getTableName(notification: RawNotificationRecord) {
  return asStringOrNull(notification.data?.tableName) ?? asStringOrNull(notification.data?.table?.tableName);
}

function buildNavigationTarget(
  type: FeedNotificationType,
  postId: string | null,
  notificationId: string,
  tableCode: string | null,
): FeedNotificationNavigationTarget {
  if ((type === 'feed_table_invite' || type === 'table_player_joined') && tableCode) {
    return {
      params: {
        gameId: tableCode,
        tableCode,
        invitePreset: {
          contextLabel: type === 'feed_table_invite' ? 'Feed table invite' : 'Table activity',
          requestId: notificationId,
          source: 'feed',
        },
      },
      route: routes.Game,
    };
  }

  return {
    params: postId ? { notificationId, postId } : { notificationId },
    route: routes.Feed,
  };
}

export function mapFeedNotificationPayload(
  payload: FeedRealtimeNotificationPayload,
  eventName: string,
): FeedNotification | null {
  const notification = payload.notification as RawNotificationRecord | undefined;
  const rawType = payload.type ?? notification?.type;

  if (!notification || !isFeedNotificationType(rawType)) {
    return null;
  }

  const config = TYPE_CONFIG[rawType];
  const postId = getPostId(payload, notification);
  const tableCode = getTableCode(notification);
  const tableName = getTableName(notification);
  const actorDisplayName =
    asStringOrNull(notification.data?.actorDisplayName) ??
    asStringOrNull(notification.data?.actor?.displayName) ??
    asStringOrNull(notification.data?.actor?.name) ??
    'A player';
  const id = asStringOrNull(notification.id) ?? `${rawType}:${postId ?? 'feed'}:${Date.now()}`;
  const body =
    asStringOrNull(notification.body) ??
    asStringOrNull(payload.preview) ??
    `${actorDisplayName} has new feed activity for you.`;

  return {
    actorDisplayName,
    body,
    ctaLabel: config.ctaLabel,
    eventName,
    id,
    label: config.label,
    navigationTarget: buildNavigationTarget(rawType, postId, id, tableCode),
    postId,
    preview: asStringOrNull(payload.preview) ?? body,
    tableCode,
    tableName,
    title: asStringOrNull(notification.title) ?? config.title,
    type: rawType,
    unreadCount: Math.max(1, payload.unreadCount ?? 1),
  };
}

export function subscribeFeedNotifications({
  onError,
  onNotification,
  socketUrl,
  token,
}: SubscribeFeedNotificationsOptions) {
  const client = createFeedRealtimeClient({
    onError: (payload) => onError?.(payload.message ?? 'Feed notifications are unavailable.'),
    onNotification: (payload, eventName) => {
      const notification = mapFeedNotificationPayload(payload, eventName);

      if (notification) {
        onNotification(notification);
      }
    },
    socketUrl,
  });

  void client.connect(token).catch((error) => {
    onError?.(error instanceof Error ? error.message : 'Feed notifications are unavailable.');
  });

  return () => {
    client.destroy();
  };
}
