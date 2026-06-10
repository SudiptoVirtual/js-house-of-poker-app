const User = require("../models/User");
const { getIO } = require("../sockets/socketRegistry");

const USER_PRESENCE_EVENT = "friends:presence_updated";
const socketIdsByUserId = new Map();
const userIdBySocketId = new Map();
const reconciliationByUserId = new Map();

function normalizeId(value) {
  return String(value || "").trim();
}

function getAuthenticatedSocketCount(userId) {
  return socketIdsByUserId.get(normalizeId(userId))?.size || 0;
}

function hasAuthenticatedSockets(userId) {
  return getAuthenticatedSocketCount(userId) > 0;
}

function emitPresenceToFriends(user, isOnline) {
  const io = getIO();

  if (!io || !user?.friends) {
    return;
  }

  const payload = { isOnline, userId: String(user._id) };
  user.friends.forEach((friendId) => {
    io.to(`user:${String(friendId)}`).emit(USER_PRESENCE_EVENT, payload);
  });
}

async function reconcilePersistedPresence(userId) {
  const isOnline = hasAuthenticatedSockets(userId);
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, isOnline: { $ne: isOnline } },
    { $set: { isOnline } },
    { new: true }
  ).select("friends");

  if (updatedUser) {
    emitPresenceToFriends(updatedUser, isOnline);
  }

  return Boolean(updatedUser);
}

function queuePresenceReconciliation(userId) {
  const normalizedUserId = normalizeId(userId);
  const previous = reconciliationByUserId.get(normalizedUserId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => reconcilePersistedPresence(normalizedUserId));

  reconciliationByUserId.set(normalizedUserId, next);
  const cleanup = () => {
    if (reconciliationByUserId.get(normalizedUserId) === next) {
      reconciliationByUserId.delete(normalizedUserId);
    }
  };
  next.then(cleanup, cleanup);

  return next;
}

function registerAuthenticatedSocket(userId, socketId) {
  const normalizedUserId = normalizeId(userId);
  const normalizedSocketId = normalizeId(socketId);

  if (!normalizedUserId || !normalizedSocketId) {
    return Promise.resolve(false);
  }

  const existingUserId = userIdBySocketId.get(normalizedSocketId);
  if (existingUserId === normalizedUserId) {
    return Promise.resolve(false);
  }
  if (existingUserId) {
    const existingSockets = socketIdsByUserId.get(existingUserId);
    existingSockets?.delete(normalizedSocketId);
    if (existingSockets?.size === 0) {
      socketIdsByUserId.delete(existingUserId);
      void queuePresenceReconciliation(existingUserId);
    }
  }

  const socketIds = socketIdsByUserId.get(normalizedUserId) || new Set();
  const isFirstSocket = socketIds.size === 0;
  socketIds.add(normalizedSocketId);
  socketIdsByUserId.set(normalizedUserId, socketIds);
  userIdBySocketId.set(normalizedSocketId, normalizedUserId);

  return isFirstSocket ? queuePresenceReconciliation(normalizedUserId) : Promise.resolve(false);
}

function unregisterAuthenticatedSocket(socketId) {
  const normalizedSocketId = normalizeId(socketId);
  const userId = userIdBySocketId.get(normalizedSocketId);

  if (!userId) {
    return Promise.resolve(false);
  }

  userIdBySocketId.delete(normalizedSocketId);
  const socketIds = socketIdsByUserId.get(userId);
  socketIds?.delete(normalizedSocketId);

  if (socketIds?.size) {
    return Promise.resolve(false);
  }

  socketIdsByUserId.delete(userId);
  return queuePresenceReconciliation(userId);
}

function setOfflineIfNoAuthenticatedSockets(userId) {
  const normalizedUserId = normalizeId(userId);

  if (!normalizedUserId || hasAuthenticatedSockets(normalizedUserId)) {
    return Promise.resolve(false);
  }

  return queuePresenceReconciliation(normalizedUserId);
}

module.exports = {
  USER_PRESENCE_EVENT,
  getAuthenticatedSocketCount,
  hasAuthenticatedSockets,
  registerAuthenticatedSocket,
  setOfflineIfNoAuthenticatedSockets,
  unregisterAuthenticatedSocket,
};
