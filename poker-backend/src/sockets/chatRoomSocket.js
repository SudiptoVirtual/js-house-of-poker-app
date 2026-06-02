const mongoose = require("mongoose");

const GameTable = require("../models/GameTable");
const User = require("../models/User");
const { mapRealtimeError } = require("./socketErrorUtils");
const { createChatRoomRealtimeService } = require("../services/chatRoomRealtimeService");
const { getChatRoomPresenceService } = require("../services/chatRoomPresenceService");
const { getPlayerRealtimeService } = require("./playerGameSocket");

const CHAT_ROOM_PREFIX = "chat:room";
const CHAT_MESSAGE_CHAR_LIMIT = 1000;
const INVITE_LIMIT = 50;

function getChatRoomChannel(roomId) {
  return `${CHAT_ROOM_PREFIX}:${roomId}`;
}

function normalizeRoomId(value) {
  return String(value || "").trim();
}

function normalizeChatRoomId(payload = {}) {
  return normalizeRoomId(
    payload.chatRoomId || payload.sourceRoomId || payload.chatRoomRoomId || payload.roomId
  );
}

function normalizeTableId(payload = {}) {
  return normalizeRoomId(payload.tableId || payload.tableCode || payload.createdTableId);
}

function normalizeMessageText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, CHAT_MESSAGE_CHAR_LIMIT);
}

function normalizePlayerIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((playerId) => String(playerId || "").trim()).filter(Boolean))];
}

function buildOpenRoomQuery(roomId) {
  const identifiers = [{ tableCode: roomId.toUpperCase() }];

  if (mongoose.Types.ObjectId.isValid(roomId)) {
    identifiers.push({ _id: roomId });
  }

  return {
    $and: [
      {
        status: { $ne: "closed" },
        tableCode: { $exists: true, $ne: null },
      },
      { $or: identifiers },
    ],
  };
}

async function findOpenChatRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);

  if (!normalizedRoomId) {
    throw new Error("Chat room id is required.");
  }

  const room = await GameTable.findOne(buildOpenRoomQuery(normalizedRoomId));

  if (!room) {
    throw new Error("Chat room not found.");
  }

  return room;
}

function getPublicRoomId(room) {
  return room.tableCode || room._id.toString();
}

function getDisplayName(user) {
  return user.name || user.email || "Player";
}

function createAcceptedModeration() {
  return {
    flags: [],
    reason: null,
    reviewedAt: null,
    status: "accepted",
  };
}

function serializeChatMessage(message, roomId) {
  const createdAt = message.createdAt || Date.now();

  return {
    authorId: message.playerId || null,
    authorName: message.playerName,
    body: message.text,
    createdAt,
    createdAtIso: new Date(createdAt).toISOString(),
    id: message.id,
    moderation: message.moderation || createAcceptedModeration(),
    playerId: message.playerId || null,
    playerName: message.playerName,
    roomId,
    text: message.text,
    tone: message.tone || "player",
  };
}

function createChatMessage(user, roomId, text) {
  const createdAt = Date.now();

  return {
    createdAt,
    id: `chat_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    moderation: createAcceptedModeration(),
    playerId: user._id.toString(),
    playerName: getDisplayName(user),
    text,
    tone: "player",
    roomId,
  };
}

function emitAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

function withChatRoomErrorBoundary(socket, ack, handler) {
  Promise.resolve()
    .then(handler)
    .catch((error) => {
      const payload = mapRealtimeError(error);
      socket.emit("table:error", payload);
      socket.emit("room:error", payload);
      socket.emit("chat:error", payload);
      emitAck(ack, { ok: false, error: payload });
    });
}

async function appendTableInvites({ playerIds, sender, tableId }) {
  if (!tableId || playerIds.length === 0) {
    return [];
  }

  const identifiers = [{ tableCode: tableId.toUpperCase() }];
  if (mongoose.Types.ObjectId.isValid(tableId)) {
    identifiers.push({ _id: tableId });
  }

  const table = await GameTable.findOne({ $or: identifiers });
  if (!table) {
    return [];
  }

  const createdInvites = playerIds.map((playerId) => ({
    createdAt: Date.now(),
    giftBuyInChips: 0,
    giftBuyInClips: 0,
    id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message: "Invited from chat room.",
    recipientAccountId: playerId,
    recipientHandle: playerId,
    recipientLabel: playerId,
    senderPlayerId: sender._id.toString(),
    senderPlayerName: getDisplayName(sender),
    source: "friend-list",
    status: "pending",
  }));

  table.tableInvites = [...createdInvites, ...(table.tableInvites || [])].slice(
    0,
    INVITE_LIMIT
  );
  await table.save();

  return createdInvites;
}

function emitToInvitedPlayers(io, roomChannel, playerIds, eventPayload) {
  const deliveredPlayerIds = new Set();

  io.sockets.sockets.forEach((candidateSocket) => {
    const userId = candidateSocket.data?.userId;

    if (userId && playerIds.includes(userId)) {
      if (!candidateSocket.rooms.has(roomChannel)) {
        candidateSocket.emit("table:playerInvited", eventPayload);
      }
      deliveredPlayerIds.add(userId);
    }
  });

  io.to(roomChannel).emit("table:playerInvited", {
    ...eventPayload,
    deliveredPlayerIds: [...deliveredPlayerIds],
  });
}

async function joinChatRoom({ realtimeService, socket, payload, ack }) {
  const user = await realtimeService.authenticateSocketUser(socket, payload);
  const room = await findOpenChatRoom(normalizeChatRoomId(payload));
  const roomId = getPublicRoomId(room);
  const roomChannel = getChatRoomChannel(roomId);

  socket.join(roomChannel);
  socket.data.chatRoomIds = Array.from(
    new Set([...(socket.data.chatRoomIds || []), roomId])
  );

  const response = {
    ok: true,
    playerId: user._id.toString(),
    roomId,
  };

  socket.emit("chat:joinedRoom", response);
  emitAck(ack, response);
}

async function leaveChatRoom({ socket, payload, ack }) {
  const roomId = normalizeChatRoomId(payload);

  if (!roomId) {
    throw new Error("Chat room id is required.");
  }

  const normalizedRoomId = roomId.toUpperCase();
  const joinedRoomId = (socket.data.chatRoomIds || []).find(
    (candidate) => candidate === roomId || candidate.toUpperCase() === normalizedRoomId
  );
  const publicRoomId = joinedRoomId || roomId;

  socket.leave(getChatRoomChannel(publicRoomId));
  socket.data.chatRoomIds = (socket.data.chatRoomIds || []).filter(
    (candidate) => candidate !== publicRoomId
  );

  const response = { ok: true, roomId: publicRoomId };
  socket.emit("chat:leftRoom", response);
  emitAck(ack, response);
}

async function sendChatRoomMessage({ io, realtimeService, socket, payload, ack }) {
  const user = await realtimeService.authenticateSocketUser(socket, payload);
  const room = await findOpenChatRoom(normalizeChatRoomId(payload));
  const roomId = getPublicRoomId(room);
  const text = normalizeMessageText(payload.message || payload.text || payload.body);

  if (!text) {
    throw new Error("Chat message cannot be empty.");
  }

  const message = createChatMessage(user, roomId, text);
  room.chatMessages = [...(room.chatMessages || []), message].slice(-100);
  await room.save();

  const serializedMessage = serializeChatMessage(message, roomId);
  const eventPayload = {
    message: serializedMessage,
    roomId,
  };

  io.to(getChatRoomChannel(roomId)).emit("chat:newMessage", eventPayload);
  socket.to(getChatRoomChannel(roomId)).emit("chat:messageNotification", {
    message: serializedMessage,
    preview: `${serializedMessage.playerName}: ${serializedMessage.text}`.slice(0, 240),
    roomId,
  });
  emitAck(ack, { ok: true, ...eventPayload });
}

async function sendTypingEvent({ realtimeService, socket, payload, ack }) {
  const user = await realtimeService.authenticateSocketUser(socket, payload);
  const room = await findOpenChatRoom(normalizeChatRoomId(payload));
  const roomId = getPublicRoomId(room);
  const eventPayload = {
    isTyping: payload.isTyping !== false,
    playerId: user._id.toString(),
    playerName: getDisplayName(user),
    roomId,
  };

  socket.to(getChatRoomChannel(roomId)).emit("chat:typing", eventPayload);
  emitAck(ack, { ok: true, ...eventPayload });
}

async function createTableFromChatRoom({ io, realtimeService, socket, payload, ack }) {
  const chatRoom = await findOpenChatRoom(normalizeChatRoomId(payload));
  const chatRoomId = getPublicRoomId(chatRoom);
  const createdRoom = await realtimeService.createRoom(socket, {
    ...payload,
    roomId: undefined,
    tableId: undefined,
    tableName: payload.tableName || `${chatRoom.tableName} Table`,
  });
  const invitedPlayerIds = normalizePlayerIds(payload.invitedPlayerIds || payload.playerIds);
  const launchPayload = {
    chatRoomId,
    createdByPlayerId: socket.data.userId || null,
    invitedPlayerIds,
    roomId: createdRoom.id,
    tableCode: createdRoom.id,
    tableDbId: createdRoom.tableDbId,
    tableId: createdRoom.id,
    tableName: createdRoom.tableName,
  };

  const chatRoomChannel = getChatRoomChannel(chatRoomId);

  io.to(chatRoomChannel).emit("table:launchFromChatRoom", launchPayload);
  if (!socket.rooms.has(chatRoomChannel)) {
    socket.emit("table:launchFromChatRoom", launchPayload);
  }
  emitAck(ack, { ok: true, ...launchPayload });
}

async function inviteRoomPlayers({ io, realtimeService, socket, payload, ack }) {
  const sender = await realtimeService.authenticateSocketUser(socket, payload);
  const chatRoom = await findOpenChatRoom(normalizeChatRoomId(payload));
  const chatRoomId = getPublicRoomId(chatRoom);
  const playerIds = normalizePlayerIds(payload.playerIds || payload.invitedPlayerIds);

  if (playerIds.length === 0) {
    throw new Error("At least one player id is required.");
  }

  const presenceSnapshot = getChatRoomPresenceService().getPresenceSnapshot(chatRoomId, {
    excludedUserIds: [sender._id.toString()],
    invitedPlayerIds: normalizePlayerIds(payload.alreadyInvitedPlayerIds),
  });
  const eligiblePlayerIds = new Set(presenceSnapshot.inviteEligibility.eligiblePlayerIds);
  const ineligiblePlayerIds = playerIds.filter((playerId) => !eligiblePlayerIds.has(playerId));

  if (ineligiblePlayerIds.length > 0) {
    throw new Error("Selected players must be online in the chat room and eligible for invites.");
  }

  const tableId = normalizeTableId(payload);
  const invites = await appendTableInvites({ playerIds, sender, tableId });
  await User.findByIdAndUpdate(sender._id, {
    $inc: { "referralStats.invitesSent": playerIds.length },
    $set: { "referralStats.lastInviteSentAt": new Date() },
  });

  const eventPayload = {
    chatRoomId,
    invitedPlayerIds: playerIds,
    inviteEligibility: presenceSnapshot.inviteEligibility,
    invites,
    playerIds,
    senderPlayerId: sender._id.toString(),
    senderPlayerName: getDisplayName(sender),
    tableId: tableId || null,
  };

  emitToInvitedPlayers(io, getChatRoomChannel(chatRoomId), playerIds, eventPayload);
  emitAck(ack, { ok: true, ...eventPayload });
}

function initChatRoomSocket(io) {
  const realtimeService = getPlayerRealtimeService(io);
  const chatRoomRealtimeService = createChatRoomRealtimeService(io, {
    authenticateSocketUser: realtimeService.authenticateSocketUser.bind(realtimeService),
  });

  io.on("connection", (socket) => {
    socket.on("chat:joinRoom", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, async () => {
        const response = await chatRoomRealtimeService.joinRoom(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("chat:leaveRoom", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, async () => {
        const response = await chatRoomRealtimeService.leaveRoom(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("chat:sendMessage", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, async () => {
        const response = await chatRoomRealtimeService.sendMessage(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("chat:typing", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, async () => {
        const response = await chatRoomRealtimeService.sendTyping(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("table:createFromChatRoom", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, async () => {
        const response = await chatRoomRealtimeService.createTableFromChatRoom(
          socket,
          payload,
          realtimeService
        );
        emitAck(ack, response);
      });
    });

    socket.on("table:inviteRoomPlayers", (payload = {}, ack) => {
      withChatRoomErrorBoundary(socket, ack, () =>
        inviteRoomPlayers({ io, realtimeService, socket, payload, ack })
      );
    });

    socket.on("disconnect", () => {
      chatRoomRealtimeService.leaveAllRooms(socket);
    });
  });
}

module.exports = {
  initChatRoomSocket,
};
