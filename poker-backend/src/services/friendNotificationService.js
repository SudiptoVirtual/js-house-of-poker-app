const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const { getIO } = require("../sockets/socketRegistry");

const NOTIFICATION_TYPES = new Set(Notification.NOTIFICATION_TYPES || []);
const FRIEND_REQUEST_ACTIONS = ["accept", "decline", "view_profile"];
const FRIEND_STATUS_ACTIONS = ["view_profile"];

function normalizeObjectIdString(value) {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
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

function getAvatar(user) {
  return user?.avatar || null;
}

function getRequestId(request) {
  return String(request?._id || request?.id || "");
}

function buildFriendNotificationData({ actionType, request, sender, responder = null, actions = [] } = {}) {
  const senderUserId = normalizeObjectIdString(sender?._id || request?.senderUserId);
  const responderUserId = normalizeObjectIdString(responder?._id || request?.receiverUserId);

  return {
    actionType,
    requestId: getRequestId(request),
    senderUserId,
    senderName: getDisplayName(sender),
    senderAvatar: getAvatar(sender),
    responderUserId,
    responderName: responder ? getDisplayName(responder) : null,
    responderAvatar: responder ? getAvatar(responder) : null,
    status: request?.status || null,
    actions,
  };
}

async function createFriendNotification({ actorUserId = null, body, data, recipientUserId, title, type } = {}) {
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`Unsupported notification type: ${type}`);
  }

  const userId = normalizeObjectIdString(recipientUserId);
  if (!userId) {
    return null;
  }

  return Notification.create({
    actorUserId: normalizeObjectIdString(actorUserId),
    body: trimBody(body),
    data: data || {},
    title: trimBody(title, 160),
    type,
    userId,
  });
}

async function createFriendRequestNotification({ request, sender, receiver }) {
  const senderName = getDisplayName(sender);

  return createFriendNotification({
    actorUserId: request.senderUserId,
    body: `${senderName} sent you a friend request.`,
    data: buildFriendNotificationData({
      actionType: "friend_request",
      actions: FRIEND_REQUEST_ACTIONS,
      request,
      sender,
      responder: receiver,
    }),
    recipientUserId: request.receiverUserId,
    title: "New friend request",
    type: "friend_request",
  });
}

async function createFriendRequestAcceptedNotification({ request, sender, receiver }) {
  const receiverName = getDisplayName(receiver);

  return createFriendNotification({
    actorUserId: request.receiverUserId,
    body: `${receiverName} accepted your friend request.`,
    data: buildFriendNotificationData({
      actionType: "friend_request_accepted",
      actions: FRIEND_STATUS_ACTIONS,
      request,
      sender,
      responder: receiver,
    }),
    recipientUserId: request.senderUserId,
    title: "Friend request accepted",
    type: "friend_request_accepted",
  });
}

async function createFriendRequestDeclinedNotification({ request, sender, receiver }) {
  const receiverName = getDisplayName(receiver);

  return createFriendNotification({
    actorUserId: request.receiverUserId,
    body: `${receiverName} declined your friend request.`,
    data: buildFriendNotificationData({
      actionType: "friend_request_declined",
      actions: FRIEND_STATUS_ACTIONS,
      request,
      sender,
      responder: receiver,
    }),
    recipientUserId: request.senderUserId,
    title: "Friend request declined",
    type: "friend_request_declined",
  });
}

function serializeNotification(notification) {
  return typeof notification?.toClient === "function"
    ? notification.toClient()
    : {
        ...notification,
        id: String(notification?._id || notification?.id),
        actorUserId: notification?.actorUserId ? String(notification.actorUserId) : null,
        userId: notification?.userId ? String(notification.userId) : null,
      };
}

function emitFriendNotificationRecords(io = getIO(), notificationRecords = []) {
  const notifications = notificationRecords.filter(Boolean).map(serializeNotification);

  notifications.forEach((notification) => {
    const payload = {
      notification,
      preview: notification.body,
      type: notification.type,
      unreadCount: 1,
    };

    io?.sockets?.sockets?.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;

      if (userId && String(userId) === String(notification.userId)) {
        candidateSocket.emit("friend:notification", payload);
        candidateSocket.emit("notification:new", payload);
      }
    });
  });

  return notifications;
}

module.exports = {
  buildFriendNotificationData,
  createFriendNotification,
  createFriendRequestAcceptedNotification,
  createFriendRequestDeclinedNotification,
  createFriendRequestNotification,
  emitFriendNotificationRecords,
  serializeNotification,
};
