const mongoose = require("mongoose");

const Notification = require("../models/Notification");

const NOTIFICATION_TYPES = new Set(Notification.NOTIFICATION_TYPES || []);

const TYPE_CONFIG = {
  feed_comment: {
    defaultTitle: "New feed comment",
    verb: "commented on your feed post",
  },
  feed_support: {
    defaultTitle: "New feed support",
    verb: "supported your feed post",
  },
  feed_share: {
    defaultTitle: "Feed post shared",
    verb: "shared your feed post",
  },
  feed_gift_clip: {
    defaultTitle: "Gift Clips received",
    verb: "sent Gift Clips to your feed post",
  },
  feed_promotion: {
    defaultTitle: "Feed post promoted",
    verb: "promoted your feed post",
  },
  feed_table_invite: {
    defaultTitle: "Feed table invite",
    verb: "invited you to a table from feed",
  },
};

function normalizeObjectIdString(value) {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
}

function uniqueObjectIdStrings(values = []) {
  return [
    ...new Set(
      values
        .map(normalizeObjectIdString)
        .filter(Boolean)
    ),
  ];
}

function trimBody(value, limit = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getDisplayName(user) {
  return user?.name || user?.email || "Player";
}

function getHandle(user) {
  const handle = user?.handle || user?.username || user?.email?.split("@")[0] || "player";
  return String(handle).startsWith("@") ? String(handle) : `@${handle}`;
}

function buildActorDetails(actor = {}) {
  const actorId = normalizeObjectIdString(actor._id || actor.id || actor.userId);

  return {
    avatarUrl: actor.avatar || actor.avatarUrl || "",
    displayName: getDisplayName(actor),
    handle: getHandle(actor),
    id: actorId,
    name: getDisplayName(actor),
    userId: actorId,
  };
}

function getPostId(postOrPostId) {
  return normalizeObjectIdString(postOrPostId?._id || postOrPostId?.id || postOrPostId);
}

function getPostOwnerId(postOrOwnerId) {
  return normalizeObjectIdString(postOrOwnerId?.authorUserId || postOrOwnerId?.creatorUserId || postOrOwnerId);
}

function buildTableContext({ table = null, post = null, tableContext = null } = {}) {
  const source = table || tableContext || post?.tableContext || null;
  const tableId = normalizeObjectIdString(table?._id || table?.tableDbId || post?.tableId || source?.tableId);
  const tableCode = String(table?.tableCode || post?.tableCode || source?.tableCode || "").trim().toUpperCase();
  const tableName = String(table?.tableName || source?.tableName || "").trim();

  if (!tableId && !tableCode && !tableName && !source) {
    return null;
  }

  return {
    ...(source && typeof source === "object" ? source : {}),
    id: tableCode || tableId,
    tableCode: tableCode || null,
    tableDbId: tableId,
    tableId: tableCode || tableId,
    tableName,
  };
}

function buildRouteData(postId, route = {}) {
  return {
    deepLink: route.deepLink || `houseofpoker://feed/posts/${postId}`,
    name: route.name || "FeedPost",
    params: { postId, ...(route.params || {}) },
    path: route.path || `/feed/${postId}`,
  };
}

function buildNotificationData({ actor, extraData = {}, post, postId, route, table, tableContext }) {
  const resolvedPostId = getPostId(post || postId);

  return {
    ...extraData,
    actor: buildActorDetails(actor),
    actorDisplayName: getDisplayName(actor),
    postId: resolvedPostId,
    route: buildRouteData(resolvedPostId, route),
    table: buildTableContext({ post, table, tableContext }),
  };
}

function buildBody({ actor, body, type }) {
  if (body) {
    return body;
  }

  const config = TYPE_CONFIG[type] || {};
  return `${getDisplayName(actor)} ${config.verb || "updated your feed post"}.`;
}

async function createFeedNotifications({
  actor,
  actorUserId = null,
  body = "",
  data = {},
  post,
  postId = null,
  recipientUserIds = [],
  route = {},
  table = null,
  tableContext = null,
  tableId = null,
  title = "",
  type,
} = {}) {
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`Unsupported notification type: ${type}`);
  }

  const resolvedActorUserId = normalizeObjectIdString(actorUserId || actor?._id || actor?.id || actor?.userId);
  const resolvedPostId = getPostId(post || postId);
  const recipients = uniqueObjectIdStrings(recipientUserIds).filter(
    (userId) => !resolvedActorUserId || userId !== resolvedActorUserId
  );

  if (!resolvedPostId || recipients.length === 0) {
    return [];
  }

  return Notification.insertMany(
    recipients.map((userId) => ({
      actorUserId: resolvedActorUserId,
      body: trimBody(buildBody({ actor, body, type })),
      data: buildNotificationData({
        actor,
        extraData: data,
        post,
        postId: resolvedPostId,
        route,
        table,
        tableContext,
      }),
      postId: resolvedPostId,
      tableId: normalizeObjectIdString(tableId || table?._id || table?.tableDbId || post?.tableId),
      title: trimBody(title || TYPE_CONFIG[type]?.defaultTitle || "Feed notification", 160),
      type,
      userId,
    })),
    { ordered: false }
  );
}

function createPostOwnerNotification(type, { actor, actorUserId, body, data, post, route, table, tableContext, title } = {}) {
  return createFeedNotifications({
    actor,
    actorUserId,
    body,
    data,
    post,
    recipientUserIds: [getPostOwnerId(post)],
    route,
    table,
    tableContext,
    title,
    type,
  });
}

function createFeedCommentNotification(options) {
  return createPostOwnerNotification("feed_comment", options);
}

function createFeedSupportNotification(options) {
  return createPostOwnerNotification("feed_support", options);
}

function createFeedShareNotification(options) {
  return createPostOwnerNotification("feed_share", options);
}

function createFeedGiftClipNotification(options) {
  return createPostOwnerNotification("feed_gift_clip", options);
}

function createFeedPromotionNotification(options) {
  return createPostOwnerNotification("feed_promotion", options);
}

function createFeedTableInviteNotifications({ actor, actorUserId, data, inviteRecords = [], post, recipientUserIds = [], route, table, title } = {}) {
  return createFeedNotifications({
    actor,
    actorUserId,
    data: {
      invites: inviteRecords.map((invite) => ({
        id: invite.id,
        message: invite.message || null,
        recipientAccountId: invite.recipientAccountId,
        status: invite.status,
      })),
      ...data,
    },
    post,
    recipientUserIds: [...recipientUserIds, getPostOwnerId(post)],
    route,
    table,
    title,
    type: "feed_table_invite",
  });
}

function serializeNotification(notification) {
  return typeof notification.toClient === "function"
    ? notification.toClient()
    : {
        ...notification,
        id: String(notification._id || notification.id),
        actorUserId: notification.actorUserId ? String(notification.actorUserId) : null,
        postId: notification.postId ? String(notification.postId) : null,
        tableId: notification.tableId ? String(notification.tableId) : null,
        userId: notification.userId ? String(notification.userId) : null,
      };
}

function emitFeedNotificationRecords(io, notificationRecords = []) {
  const notifications = notificationRecords.map(serializeNotification);

  notifications.forEach((notification) => {
    const payload = {
      notification,
      postId: notification.postId || notification.data?.postId || null,
      preview: notification.body,
      type: notification.type,
      unreadCount: 1,
    };

    io?.sockets?.sockets?.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;

      if (userId && String(userId) === String(notification.userId)) {
        candidateSocket.emit("feed:notification", payload);
        candidateSocket.emit("notification:new", payload);
      }
    });
  });

  return notifications;
}

module.exports = {
  buildActorDetails,
  buildNotificationData,
  createFeedCommentNotification,
  createFeedGiftClipNotification,
  createFeedNotifications,
  createFeedPromotionNotification,
  createFeedShareNotification,
  createFeedSupportNotification,
  createFeedTableInviteNotifications,
  emitFeedNotificationRecords,
  serializeNotification,
};
