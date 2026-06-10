const { getIO } = require("./socketRegistry");
const {
  registerAuthenticatedSocket,
  unregisterAuthenticatedSocket,
} = require("../services/userPresenceService");

const FRIEND_SOCKET_EVENTS = {
  requestAccepted: "friends:request_accepted",
  requestDeclined: "friends:request_declined",
  requestReceived: "friends:request_received",
  requestSent: "friends:request_sent",
  statusUpdated: "friends:status_updated",
  presenceUpdated: "friends:presence_updated",
};

function initFriendSocket(io) {
  const { getPlayerRealtimeService } = require("./playerGameSocket");
  const playerRealtimeService = getPlayerRealtimeService(io);

  io.on("connection", (socket) => {
    Promise.resolve()
      .then(async () => {
        const authenticatedUser = await playerRealtimeService.authenticateSocketUser(socket);
        socket.data.userId = String(authenticatedUser._id);
        joinUserRoom(socket, authenticatedUser._id);
        socket.on("disconnect", () => {
          void unregisterAuthenticatedSocket(socket.id).catch((error) => {
            console.error("Unable to unregister authenticated socket presence", error);
          });
        });
        await registerAuthenticatedSocket(authenticatedUser._id, socket.id);
      })
      .catch((error) => {
        socket.emit("friends:error", {
          code: "FRIEND_SOCKET_AUTH_FAILED",
          message: error.message || "Unable to authenticate friend notifications.",
        });
      });
  });
}

function getUserRoom(userId) {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId ? `user:${normalizedUserId}` : null;
}

function joinUserRoom(socket, userId) {
  const room = getUserRoom(userId);

  if (!socket || !room) {
    return null;
  }

  socket.join(room);
  socket.data.userRoom = room;
  return room;
}

function emitToUser(userId, eventName, payload) {
  const io = getIO();
  const room = getUserRoom(userId);

  if (!io || !room) {
    return false;
  }

  io.to(room).emit(eventName, payload);
  return true;
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  const userId = user._id || user.id || user.userId;

  if (!userId) {
    return null;
  }

  return {
    avatar: user.avatar ?? null,
    email: user.email ?? null,
    id: String(userId),
    name: user.name ?? null,
    userId: String(userId),
  };
}

function serializeRequest(request) {
  if (!request) {
    return null;
  }

  return {
    id: String(request._id),
    receiverUserId: String(request.receiverUserId),
    senderUserId: String(request.senderUserId),
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function buildFriendEventPayload({ actorUserId, otherUser, request, status }) {
  const serializedRequest = serializeRequest(request);
  const serializedOtherUser = serializeUser(otherUser);

  return {
    actorUserId: actorUserId ? String(actorUserId) : null,
    otherUser: serializedOtherUser,
    otherUserId: serializedOtherUser?.id || null,
    request: serializedRequest,
    requestId: serializedRequest?.id || null,
    status,
  };
}

function emitStatusUpdate(userId, payload) {
  emitToUser(userId, FRIEND_SOCKET_EVENTS.statusUpdated, payload);
}

function emitFriendRequestCreated({ receiver, request, sender }) {
  const senderUserId = String(request.senderUserId);
  const receiverUserId = String(request.receiverUserId);
  const senderPayload = buildFriendEventPayload({
    actorUserId: senderUserId,
    otherUser: receiver,
    request,
    status: "pending_sent",
  });
  const receiverPayload = buildFriendEventPayload({
    actorUserId: senderUserId,
    otherUser: sender,
    request,
    status: "pending_received",
  });

  emitToUser(senderUserId, FRIEND_SOCKET_EVENTS.requestSent, senderPayload);
  emitToUser(receiverUserId, FRIEND_SOCKET_EVENTS.requestReceived, receiverPayload);
  emitStatusUpdate(senderUserId, senderPayload);
  emitStatusUpdate(receiverUserId, receiverPayload);
}

function emitFriendRequestAccepted({ receiver, request, sender }) {
  const senderUserId = String(request.senderUserId);
  const receiverUserId = String(request.receiverUserId);
  const senderPayload = buildFriendEventPayload({
    actorUserId: receiverUserId,
    otherUser: receiver,
    request,
    status: "friends",
  });
  const receiverPayload = buildFriendEventPayload({
    actorUserId: receiverUserId,
    otherUser: sender,
    request,
    status: "friends",
  });

  emitToUser(senderUserId, FRIEND_SOCKET_EVENTS.requestAccepted, senderPayload);
  emitToUser(receiverUserId, FRIEND_SOCKET_EVENTS.requestAccepted, receiverPayload);
  emitStatusUpdate(senderUserId, senderPayload);
  emitStatusUpdate(receiverUserId, receiverPayload);
}

function emitFriendRequestDeclined({ receiver, request, sender }) {
  const senderUserId = String(request.senderUserId);
  const receiverUserId = String(request.receiverUserId);
  const senderPayload = buildFriendEventPayload({
    actorUserId: receiverUserId,
    otherUser: receiver,
    request,
    status: "none",
  });
  const receiverPayload = buildFriendEventPayload({
    actorUserId: receiverUserId,
    otherUser: sender,
    request,
    status: "none",
  });

  emitToUser(senderUserId, FRIEND_SOCKET_EVENTS.requestDeclined, senderPayload);
  emitToUser(receiverUserId, FRIEND_SOCKET_EVENTS.requestDeclined, receiverPayload);
  emitStatusUpdate(senderUserId, senderPayload);
  emitStatusUpdate(receiverUserId, receiverPayload);
}

module.exports = {
  FRIEND_SOCKET_EVENTS,
  emitFriendRequestAccepted,
  emitFriendRequestCreated,
  emitFriendRequestDeclined,
  getUserRoom,
  initFriendSocket,
  joinUserRoom,
};
