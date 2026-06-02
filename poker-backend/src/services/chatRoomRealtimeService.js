const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const ChatRoomMessage = require("../models/ChatRoomMessage");
const { getChatRoomPresenceService } = require("./chatRoomPresenceService");

const CHAT_ROOM_PREFIX = "chat:room";
const SOCIAL_CHAT_HISTORY_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.SOCIAL_CHAT_HISTORY_LIMIT || "50", 10)
);
const SOCIAL_CHAT_MESSAGE_CHAR_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.SOCIAL_CHAT_MESSAGE_CHAR_LIMIT || "1000", 10)
);
const SOCIAL_CHAT_USER_RATE_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.SOCIAL_CHAT_USER_RATE_LIMIT || "5", 10)
);
const SOCIAL_CHAT_USER_RATE_WINDOW_MS = Math.max(
  1000,
  Number.parseInt(process.env.SOCIAL_CHAT_USER_RATE_WINDOW_MS || "10000", 10)
);
const SOCIAL_CHAT_ROOM_RATE_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.SOCIAL_CHAT_ROOM_RATE_LIMIT || "60", 10)
);
const SOCIAL_CHAT_ROOM_RATE_WINDOW_MS = Math.max(
  1000,
  Number.parseInt(process.env.SOCIAL_CHAT_ROOM_RATE_WINDOW_MS || "60000", 10)
);

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

function normalizeMessageText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, SOCIAL_CHAT_MESSAGE_CHAR_LIMIT);
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

const BLOCKED_CHAT_PATTERNS = [
  {
    flag: "identity_hate_or_harassment",
    reason: "Messages that attack protected classes are not allowed in chat rooms.",
    pattern: /\b(?:n[i1!]gg?(?:a|er)s?|f[a@]gg?(?:ot)?s?|k[i1!]kes?|sp[i1!]cs?|tr[a@]nn(?:y|ies)|r[e3]t[a@]rds?)\b/i,
  },
  {
    flag: "threat_or_violent_abuse",
    reason: "Threats or violent abuse are not allowed in chat rooms.",
    pattern: /\b(?:kill|murder|doxx?|swat|hunt down)\s+(?:you|ur|u|him|her|them)\b/i,
  },
  {
    flag: "sexual_abuse",
    reason: "Sexual harassment or abuse is not allowed in chat rooms.",
    pattern: /\b(?:rape|sexually assault)\s+(?:you|ur|u|him|her|them)\b/i,
  },
];

const FLAGGED_CHAT_PATTERNS = [
  {
    flag: "profanity_or_abusive_language",
    reason: "Message contains profanity or abusive language and requires moderation review.",
    pattern: /\b(?:fuck|shit|bitch|asshole|cunt|dickhead|motherfucker|bastard)\b/i,
  },
  {
    flag: "targeted_harassment",
    reason: "Message appears to target another player and requires moderation review.",
    pattern: /\b(?:idiot|moron|loser|trash|stupid)\b/i,
  },
];

function moderateChatRoomMessage({ text } = {}) {
  const message = normalizeMessageText(text);
  const blockedFlags = BLOCKED_CHAT_PATTERNS.filter(({ pattern }) => pattern.test(message));

  if (blockedFlags.length > 0) {
    return {
      flags: blockedFlags.map(({ flag }) => flag),
      reason: blockedFlags[0].reason,
      reviewedAt: null,
      status: "blocked",
    };
  }

  const reviewFlags = FLAGGED_CHAT_PATTERNS.filter(({ pattern }) => pattern.test(message));

  if (reviewFlags.length > 0) {
    return {
      flags: reviewFlags.map(({ flag }) => flag),
      reason: reviewFlags[0].reason,
      reviewedAt: null,
      status: "pending-review",
    };
  }

  return createAcceptedModeration();
}

function getChatRateRetrySeconds(retryAfterMs) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function registerChatRateLimitHit(bucketMap, key, now, limit, windowMs) {
  const previousHits = bucketMap.get(key) || [];
  const hits = previousHits.filter((timestamp) => now - timestamp < windowMs);

  if (hits.length >= limit) {
    bucketMap.set(key, hits);
    return {
      allowed: false,
      retryAfterMs: windowMs - (now - hits[0]),
    };
  }

  hits.push(now);
  bucketMap.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

function serializeChatRoomMessage(message) {
  const roomId = String(message.roomId);
  const authorId = message.senderUserId ? String(message.senderUserId) : null;
  const createdAt = message.createdAt || new Date();

  return {
    authorId,
    authorName: message.senderDisplayName,
    body: message.text,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
    id: String(message._id),
    moderation: message.moderation || createAcceptedModeration(),
    playerId: authorId,
    playerName: message.senderDisplayName,
    roomId,
    text: message.text,
    tone: "player",
  };
}

function buildChatRoomPlayer(user, joinedAt = new Date(), socketCount = 1) {
  const userId = String(user._id || user.userId || user.id);
  const displayName = getDisplayName(user);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";

  return {
    avatarInitials: initials,
    chipStackLabel: "",
    displayName,
    handle: user.handle || user.username || displayName,
    id: userId,
    isConnected: true,
    joinedAt: joinedAt.toISOString(),
    socketCount,
    status: "available",
    userId,
  };
}

class ChatRoomRealtimeService {
  constructor(io, options = {}) {
    const { authenticateSocketUser } = options;
    if (typeof authenticateSocketUser !== "function") {
      throw new Error("ChatRoomRealtimeService requires authenticateSocketUser.");
    }

    this.io = io;
    this.authenticateSocketUser = authenticateSocketUser;
    this.presenceService = options.presenceService || getChatRoomPresenceService();
    this.chatUserRateBuckets = new Map();
    this.chatRoomRateBuckets = new Map();
  }

  async findRoom(roomId) {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedRoomId) {
      throw new Error("Chat room id is required.");
    }

    const identifiers = [{ slug: normalizedRoomId.toLowerCase() }];

    if (mongoose.Types.ObjectId.isValid(normalizedRoomId)) {
      identifiers.push({ _id: normalizedRoomId });
    }

    const room = await ChatRoom.findOne({ $or: identifiers });

    if (!room) {
      throw new Error("Chat room not found.");
    }

    return room;
  }

  getPresenceSnapshot(roomId) {
    return this.presenceService.getPresenceSnapshot(roomId);
  }

  async syncActivePlayerCount(roomId) {
    const snapshot = this.getPresenceSnapshot(roomId);
    await ChatRoom.updateOne(
      { _id: roomId },
      { $set: { activePlayerCount: snapshot.activePlayerCount } }
    );
    return snapshot;
  }

  emitActivePlayers(roomId) {
    const snapshot = this.getPresenceSnapshot(roomId);
    this.io.to(getChatRoomChannel(roomId)).emit("chat:activePlayers", snapshot);
    this.io.to(getChatRoomChannel(roomId)).emit("chat:presence", snapshot);
    return snapshot;
  }

  async touchParticipant(roomId, userId, update = {}) {
    const participantState = {
      lastSeenAt: new Date(),
      unreadCount: 0,
      userId,
      ...update,
    };

    await ChatRoom.updateOne(
      { _id: roomId, "participantStates.userId": userId },
      { $set: { "participantStates.$.lastSeenAt": participantState.lastSeenAt, "participantStates.$.unreadCount": participantState.unreadCount } }
    );
    await ChatRoom.updateOne(
      { _id: roomId, participantStates: { $not: { $elemMatch: { userId } } } },
      { $push: { participantStates: participantState } }
    );
  }

  async getRecentMessages(roomId) {
    const messages = await ChatRoomMessage.find({
      roomId,
      "moderation.status": { $ne: "blocked" },
    })
      .sort({ createdAt: -1 })
      .limit(SOCIAL_CHAT_HISTORY_LIMIT);

    return messages.reverse().map(serializeChatRoomMessage);
  }

  trackSocketRoom(socket, roomId) {
    socket.data.chatRoomIds = Array.from(
      new Set([...(socket.data.chatRoomIds || []), String(roomId)])
    );
  }

  untrackSocketRoom(socket, roomId) {
    socket.data.chatRoomIds = (socket.data.chatRoomIds || []).filter(
      (candidate) => String(candidate) !== String(roomId)
    );
  }

  addPresence(roomId, user, socket) {
    return this.presenceService.addPresence(roomId, user, socket);
  }

  removePresence(roomId, socket) {
    return this.presenceService.removePresence(roomId, socket);
  }


  enforceRateLimit(roomId, userId) {
    const now = Date.now();
    const userKey = `${roomId}:${userId}`;
    const userLimit = registerChatRateLimitHit(
      this.chatUserRateBuckets,
      userKey,
      now,
      SOCIAL_CHAT_USER_RATE_LIMIT,
      SOCIAL_CHAT_USER_RATE_WINDOW_MS
    );

    if (!userLimit.allowed) {
      throw new Error(
        `You are sending chat room messages too quickly. Please wait ${getChatRateRetrySeconds(
          userLimit.retryAfterMs
        )} second(s) before sending another message.`
      );
    }

    const roomLimit = registerChatRateLimitHit(
      this.chatRoomRateBuckets,
      String(roomId),
      now,
      SOCIAL_CHAT_ROOM_RATE_LIMIT,
      SOCIAL_CHAT_ROOM_RATE_WINDOW_MS
    );

    if (!roomLimit.allowed) {
      throw new Error(
        `This chat room is receiving too many messages. Please wait ${getChatRateRetrySeconds(
          roomLimit.retryAfterMs
        )} second(s) and try again.`
      );
    }
  }

  async joinRoom(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);
    const room = await this.findRoom(normalizeChatRoomId(payload));
    const roomId = String(room._id);
    const roomChannel = getChatRoomChannel(roomId);

    socket.join(roomChannel);
    this.trackSocketRoom(socket, roomId);
    this.addPresence(roomId, user, socket);
    await this.touchParticipant(roomId, user._id);

    await this.syncActivePlayerCount(roomId);
    const activePlayers = this.emitActivePlayers(roomId);
    const messages = await this.getRecentMessages(roomId);
    const response = {
      activePlayers: activePlayers.players,
      messages,
      ok: true,
      playerId: String(user._id),
      players: activePlayers.players,
      presenceSnapshot: activePlayers,
      roomId,
      success: true,
    };

    socket.emit("chat:joinedRoom", response);
    return response;
  }

  async leaveRoom(socket, payload = {}) {
    const requestedRoomId = normalizeChatRoomId(payload);

    if (!requestedRoomId) {
      throw new Error("Chat room id is required.");
    }

    const room = await this.findRoom(requestedRoomId);
    const roomId = String(room._id);

    socket.leave(getChatRoomChannel(roomId));
    this.untrackSocketRoom(socket, roomId);
    this.removePresence(roomId, socket);

    await this.syncActivePlayerCount(roomId);
    const activePlayers = this.emitActivePlayers(roomId);
    const response = {
      activePlayers: activePlayers.players,
      ok: true,
      players: activePlayers.players,
      presenceSnapshot: activePlayers,
      roomId,
      success: true,
    };

    socket.emit("chat:leftRoom", response);
    return response;
  }

  async sendMessage(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);
    const room = await this.findRoom(normalizeChatRoomId(payload));
    const roomId = String(room._id);
    const text = normalizeMessageText(payload.message || payload.text || payload.body);

    if (!text) {
      throw new Error("Chat message cannot be empty.");
    }

    this.enforceRateLimit(roomId, String(user._id));

    const moderation = moderateChatRoomMessage({ text });
    const message = new ChatRoomMessage({
      moderation,
      roomId,
      senderDisplayName: getDisplayName(user),
      senderUserId: user._id,
      text,
    });

    if (moderation.status === "blocked") {
      await message.save();
      console.warn("Chat room message blocked", {
        flags: moderation.flags || [],
        messageId: String(message._id),
        reason: moderation.reason,
        roomId,
        senderUserId: String(user._id),
      });
      throw new Error(
        moderation.reason ||
          "Your chat room message was blocked because it violates chat safety rules."
      );
    }

    await message.save();

    if (moderation.status === "pending-review") {
      console.warn("Chat room message flagged", {
        flags: moderation.flags || [],
        messageId: String(message._id),
        reason: moderation.reason,
        roomId,
        senderUserId: String(user._id),
      });
    }

    const serializedMessage = serializeChatRoomMessage(message);
    const eventPayload = {
      message: serializedMessage,
      roomId,
    };

    this.io.to(getChatRoomChannel(roomId)).emit("chat:newMessage", eventPayload);
    this.emitMessageNotification(roomId, serializedMessage);

    return {
      ok: true,
      success: true,
      ...eventPayload,
    };
  }

  async sendTyping(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);
    const room = await this.findRoom(normalizeChatRoomId(payload));
    const roomId = String(room._id);
    const eventPayload = {
      isTyping: payload.isTyping !== false,
      playerId: String(user._id),
      playerName: getDisplayName(user),
      roomId,
      userId: String(user._id),
    };

    socket.to(getChatRoomChannel(roomId)).emit("chat:typing", eventPayload);
    return {
      ok: true,
      success: true,
      ...eventPayload,
    };
  }

  emitMessageNotification(roomId, message) {
    const roomKey = String(roomId);
    const notification = {
      message,
      preview: `${message.authorName || message.playerName}: ${message.body || message.text}`.slice(0, 240),
      roomId: roomKey,
      unreadCount: 1,
    };

    const roomChannel = getChatRoomChannel(roomKey);

    this.io.sockets.sockets.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;

      if (
        userId &&
        String(userId) !== String(message.authorId) &&
        candidateSocket.rooms.has(roomChannel)
      ) {
        candidateSocket.emit("chat:messageNotification", notification);
      }
    });

    return notification;
  }

  leaveAllRooms(socket) {
    const roomIds = [...(socket.data.chatRoomIds || [])];

    roomIds.forEach((roomId) => {
      socket.leave(getChatRoomChannel(roomId));
      this.removePresence(roomId, socket);
      this.syncActivePlayerCount(roomId).catch((error) => {
        console.warn("Failed to sync chat room active player count", {
          error: error.message,
          roomId,
        });
      });
      this.emitActivePlayers(roomId);
    });

    socket.data.chatRoomIds = [];
  }
}

function createChatRoomRealtimeService(io, options) {
  return new ChatRoomRealtimeService(io, options);
}

module.exports = {
  ChatRoomRealtimeService,
  createChatRoomRealtimeService,
  getChatRoomChannel,
  moderateChatRoomMessage,
  normalizeChatRoomId,
  normalizeMessageText,
  serializeChatRoomMessage,
};
