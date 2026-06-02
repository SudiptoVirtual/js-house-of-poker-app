const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const ChatRoomMessage = require("../models/ChatRoomMessage");
const User = require("../models/User");
const { getChatRoomPresenceService } = require("./chatRoomPresenceService");
const {
  createMessageNotifications,
  createTableInviteNotifications,
  createTableLaunchNotifications,
  markRoomNotificationsRead,
  serializeNotification,
} = require("./chatRoomNotificationService");

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

const CHAT_ROOM_TABLE_LAUNCH_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.CHAT_ROOM_TABLE_LAUNCH_LIMIT || "25", 10)
);
const CHAT_ROOM_TABLE_INVITE_HISTORY_LIMIT = Math.max(
  1,
  Number.parseInt(process.env.CHAT_ROOM_TABLE_INVITE_HISTORY_LIMIT || "100", 10)
);
const VALID_CHAT_ROOM_TABLE_GAMES = new Set([
  "7/27",
  "7-27",
  "55 Little Red",
  "357",
  "holdem",
  "shanghai",
  "in-between-the-sheets",
]);
const VALID_CHAT_ROOM_TABLE_MODES = new Set([
  "high-only",
  "high-low",
  "low-only",
  "HOSTEST",
  "BEST_FIVE",
]);
const VALID_CHAT_ROOM_LOW_RULES = new Set(["8-or-better", "wheel", "any-low"]);
const VALID_CHAT_ROOM_WILD_CARDS = new Set([
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
]);
const VALID_CHAT_ROOM_VISIBILITIES = new Set(["room", "private", "public", "invite-only"]);

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

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, SOCIAL_CHAT_MESSAGE_CHAR_LIMIT);
}

function normalizePlayerIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((playerId) => String(playerId || "").trim()).filter(Boolean))];
}

function normalizeLaunchVisibility(value) {
  const visibility = String(value || "room").trim().toLowerCase();
  return VALID_CHAT_ROOM_VISIBILITIES.has(visibility) ? visibility : "room";
}

function normalizeTableTier(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "object") {
    return value;
  }

  throw new Error("Table tier must be a string or object.");
}

function validateChatRoomGameSettings(gameSettings = {}) {
  if (gameSettings == null) {
    return {};
  }

  if (typeof gameSettings !== "object" || Array.isArray(gameSettings)) {
    throw new Error("Game settings must be an object.");
  }

  const settings = { ...gameSettings };

  if (settings.game !== undefined && !VALID_CHAT_ROOM_TABLE_GAMES.has(settings.game)) {
    throw new Error("Unsupported poker game for chat room table launch.");
  }

  if (settings.mode !== undefined && !VALID_CHAT_ROOM_TABLE_MODES.has(settings.mode)) {
    throw new Error("Unsupported poker game mode for chat room table launch.");
  }

  if (settings.lowRule !== undefined && !VALID_CHAT_ROOM_LOW_RULES.has(settings.lowRule)) {
    throw new Error("Unsupported low hand rule for chat room table launch.");
  }

  if (settings.stips !== undefined && (typeof settings.stips !== "object" || Array.isArray(settings.stips))) {
    throw new Error("Game stipulations must be an object.");
  }

  if (Array.isArray(settings.wildCards)) {
    const invalidWildCards = settings.wildCards.filter(
      (card) => !VALID_CHAT_ROOM_WILD_CARDS.has(String(card || "").toUpperCase())
    );

    if (invalidWildCards.length > 0) {
      throw new Error("Unsupported wild card in chat room table launch settings.");
    }

    settings.wildCards = settings.wildCards.map((card) => String(card).toUpperCase());
  } else if (settings.wildCards !== undefined) {
    throw new Error("Wild cards must be an array.");
  }

  return settings;
}

function assertUserCanLaunchFromRoom(room, userId) {
  if (room.isPublic) {
    return;
  }

  const userIdString = String(userId);
  const isCreator = room.createdByUserId && String(room.createdByUserId) === userIdString;
  const isParticipant = (room.participantStates || []).some(
    (state) => String(state.userId) === userIdString
  );

  if (!isCreator && !isParticipant) {
    throw new Error("You are not allowed to launch a table from this chat room.");
  }
}

function userCanAccessChatRoom(room, userId) {
  if (room.isPublic) {
    return true;
  }

  const userIdString = String(userId);
  const isCreator = room.createdByUserId && String(room.createdByUserId) === userIdString;
  const isParticipant = (room.participantStates || []).some(
    (state) => String(state.userId) === userIdString
  );

  return Boolean(isCreator || isParticipant);
}

function assertUserCanAccessChatRoom(room, userId) {
  if (!userCanAccessChatRoom(room, userId)) {
    throw new Error("You are not allowed to invite players from this chat room.");
  }
}

function buildRoomMemberIdSet(room, presenceSnapshot) {
  const memberIds = new Set(
    (room.participantStates || [])
      .map((state) => String(state.userId || "").trim())
      .filter(Boolean)
  );

  (presenceSnapshot.players || []).forEach((player) => {
    const userId = String(player.userId || player.id || "").trim();
    if (userId) {
      memberIds.add(userId);
    }
  });

  return memberIds;
}

function serializeInviteForRecipient(invite) {
  return {
    createdAt: invite.createdAt,
    giftBuyInChips: invite.giftBuyInChips || 0,
    giftBuyInClips: invite.giftBuyInClips || 0,
    id: invite.id,
    message: invite.message || null,
    recipientAccountId: invite.recipientAccountId,
    recipientHandle: invite.recipientHandle,
    recipientLabel: invite.recipientLabel,
    senderPlayerId: invite.senderPlayerId,
    senderPlayerName: invite.senderPlayerName,
    source: invite.source,
    status: invite.status,
  };
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
    tone: message.tone || "player",
    ...(message.launchContext ? { launchContext: message.launchContext } : {}),
  };
}


function getLaunchGameLabel(gameSettings = {}) {
  const game = String(gameSettings.game || "").trim();
  if (game === "357") {
    return "3-5-7";
  }

  return game || "poker";
}

function emitLaunchToOnlineInvitedPlayers(io, socket, invitedPlayerIds, launchPayload) {
  const deliveredPlayerIds = new Set();
  const invitedIdSet = new Set(invitedPlayerIds.map((playerId) => String(playerId)));
  const launchingSocketUserId = socket.data?.userId ? String(socket.data.userId) : null;

  io.sockets.sockets.forEach((candidateSocket) => {
    const userId = candidateSocket.data?.userId ? String(candidateSocket.data.userId) : null;

    if (!userId || !invitedIdSet.has(userId)) {
      return;
    }

    if (candidateSocket.id && candidateSocket.id === socket.id) {
      return;
    }

    if (launchingSocketUserId && userId === launchingSocketUserId) {
      return;
    }

    candidateSocket.emit("table:launchFromChatRoom", {
      ...launchPayload,
      recipient: true,
    });
    deliveredPlayerIds.add(userId);
  });

  return [...deliveredPlayerIds];
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
    const readState = await markRoomNotificationsRead({
      chatRoomId: roomId,
      userId: user._id,
    });

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
      readAt: readState.readAt,
      roomId,
      unreadCount: 0,
      success: true,
    };

    socket.emit("chat:notificationsRead", {
      modifiedCount: readState.modifiedCount,
      readAt: readState.readAt,
      roomId,
      unreadCount: 0,
    });
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

    const notificationRecords = await createMessageNotifications({
      message,
      presenceSnapshot: this.getPresenceSnapshot(roomId),
      room,
      sender: user,
    });
    this.emitNotificationRecords(notificationRecords, {
      fallbackMessage: serializedMessage,
      roomId,
    });

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

  async createTableFromChatRoom(socket, payload = {}, pokerRealtimeService) {
    if (!pokerRealtimeService || typeof pokerRealtimeService.createRoomFromChatRoom !== "function") {
      throw new Error("Poker realtime service is required to launch a table from a chat room.");
    }

    const user = await this.authenticateSocketUser(socket, payload);
    const chatRoom = await this.findRoom(normalizeChatRoomId(payload));
    const chatRoomId = String(chatRoom._id);

    assertUserCanLaunchFromRoom(chatRoom, user._id);

    const gameSettings = validateChatRoomGameSettings(payload.gameSettings || {});
    const invitedPlayerIds = normalizePlayerIds(payload.invitedPlayerIds);
    const invalidInvitedPlayerIds = invitedPlayerIds.filter(
      (playerId) => !mongoose.Types.ObjectId.isValid(playerId)
    );

    if (invalidInvitedPlayerIds.length > 0) {
      throw new Error("Invited player ids must be valid user ids.");
    }

    const visibility = normalizeLaunchVisibility(payload.visibility);
    const tableTier = normalizeTableTier(payload.tableTier ?? payload.tableTierId);
    const launchedAt = new Date();
    const tableName =
      typeof payload.tableName === "string" && payload.tableName.trim()
        ? payload.tableName
        : `${chatRoom.name} Table`;

    const createdRoom = await pokerRealtimeService.createRoomFromChatRoom(
      socket,
      {
        ...payload,
        gameSettings,
        roomId: undefined,
        tableCode: undefined,
        tableId: undefined,
        tableName,
      },
      {
        chatRoomId: chatRoom._id,
        invitedPlayerIds,
        launchedAt,
        launchedByUserId: user._id,
        rules: payload.rules || null,
        tableTier,
        visibility,
      }
    );

    const createdAt = launchedAt.toISOString();
    const launchRecord = {
      createdAt: launchedAt,
      gameSettings,
      invitedPlayerIds,
      launchedAt,
      launchedByUserId: user._id,
      rules: payload.rules || null,
      tableCode: createdRoom.id,
      tableId: createdRoom.tableDbId,
      tableName: createdRoom.tableName,
      tableTier,
      visibility,
    };

    const launchPayload = {
      chatRoomId,
      createdAt,
      createdByPlayerId: String(user._id),
      gameSettings,
      invitedPlayerIds,
      launchedAt: createdAt,
      launchedByUserId: String(user._id),
      roomId: createdRoom.id,
      success: true,
      tableCode: createdRoom.id,
      tableDbId: createdRoom.tableDbId,
      tableId: createdRoom.id,
      tableName: createdRoom.tableName,
      tableTier,
      visibility,
    };
    const launchText = `${getDisplayName(user)} launched a ${getLaunchGameLabel(gameSettings)} table from this room.`;
    const systemMessage = new ChatRoomMessage({
      launchContext: launchPayload,
      moderation: createAcceptedModeration(),
      roomId: chatRoom._id,
      senderDisplayName: "System",
      senderUserId: user._id,
      text: launchText,
      tone: "system",
    });
    await systemMessage.save();
    const serializedSystemMessage = serializeChatRoomMessage(systemMessage);

    await ChatRoom.updateOne(
      { _id: chatRoom._id },
      {
        $push: {
          tableLaunches: {
            $each: [launchRecord],
            $slice: -CHAT_ROOM_TABLE_LAUNCH_LIMIT,
          },
        },
      }
    );

    const deliveredPlayerIds = emitLaunchToOnlineInvitedPlayers(
      this.io,
      socket,
      invitedPlayerIds,
      launchPayload
    );
    const acknowledgedLaunchPayload = {
      ...launchPayload,
      deliveredPlayerIds,
    };

    const launchNotifications = await createTableLaunchNotifications({
      chatRoom,
      invitedPlayerIds,
      launchPayload: acknowledgedLaunchPayload,
      presenceSnapshot: this.getPresenceSnapshot(chatRoomId),
      user,
    });
    this.emitNotificationRecords(launchNotifications, { roomId: chatRoomId });

    socket.emit("table:launchFromChatRoom", {
      ...acknowledgedLaunchPayload,
      sender: true,
    });
    socket.to(getChatRoomChannel(chatRoomId)).emit("table:launchFromChatRoom", acknowledgedLaunchPayload);
    this.io.to(getChatRoomChannel(chatRoomId)).emit("chat:newMessage", {
      message: serializedSystemMessage,
      roomId: chatRoomId,
    });

    return {
      ok: true,
      ...acknowledgedLaunchPayload,
    };
  }

  emitInviteNotifications({ chatRoomId, invites, sender, table }) {
    const deliveredPlayerIds = new Set();
    const inviteByRecipientId = new Map(
      invites.map((invite) => [String(invite.recipientAccountId), invite])
    );

    this.io.sockets.sockets.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;
      const invite = userId ? inviteByRecipientId.get(String(userId)) : null;

      if (!invite) {
        return;
      }

      const notification = {
        chatRoomId,
        invite: serializeInviteForRecipient(invite),
        inviteId: invite.id,
        invitedPlayerId: String(userId),
        message: invite.message || null,
        playerId: String(userId),
        senderPlayerId: String(sender._id),
        senderPlayerName: getDisplayName(sender),
        tableCode: table.tableCode,
        tableDbId: table.tableDbId,
        tableId: table.tableId,
        tableName: table.tableName,
      };

      candidateSocket.emit("table:playerInvited", notification);
      deliveredPlayerIds.add(String(userId));
    });

    return [...deliveredPlayerIds];
  }

  async inviteRoomPlayers(socket, payload = {}, pokerRealtimeService) {
    if (
      !pokerRealtimeService ||
      typeof pokerRealtimeService.appendTableInviteRecords !== "function"
    ) {
      throw new Error("Poker realtime service is required to invite chat room players.");
    }

    const sender = await this.authenticateSocketUser(socket, payload);
    const chatRoom = await this.findRoom(normalizeChatRoomId(payload));
    const chatRoomId = String(chatRoom._id);
    const tableId = normalizeTableId(payload);
    const playerIds = normalizePlayerIds(payload.playerIds || payload.invitedPlayerIds);
    const message = normalizeMessageText(payload.message).slice(0, 120) || null;

    if (!tableId) {
      throw new Error("Table id is required.");
    }

    if (playerIds.length === 0) {
      throw new Error("At least one player id is required.");
    }

    assertUserCanAccessChatRoom(chatRoom, sender._id);

    const senderUserId = String(sender._id);
    const presenceSnapshot = this.presenceService.getPresenceSnapshot(chatRoomId, {
      excludedUserIds: [senderUserId],
      invitedPlayerIds: normalizePlayerIds(payload.alreadyInvitedPlayerIds),
    });
    const roomMemberIds = buildRoomMemberIdSet(chatRoom, presenceSnapshot);
    const inviteEligibility = presenceSnapshot.inviteEligibility || {
      eligiblePlayerIds: [],
      ineligiblePlayerIds: [],
      invitedPlayerIds: [],
      reasonByPlayerId: {},
    };
    const eligiblePresenceIds = new Set(inviteEligibility.eligiblePlayerIds || []);

    const initialResults = playerIds.map((playerId) => {
      if (!mongoose.Types.ObjectId.isValid(playerId)) {
        return {
          ok: false,
          playerId,
          reason: "invalid-player-id",
          status: "failed",
          success: false,
        };
      }

      if (playerId === senderUserId) {
        return {
          ok: false,
          playerId,
          reason: "cannot-invite-self",
          status: "failed",
          success: false,
        };
      }

      if (!roomMemberIds.has(playerId)) {
        return {
          ok: false,
          playerId,
          reason: "not-chat-room-member",
          status: "failed",
          success: false,
        };
      }

      if (!eligiblePresenceIds.has(playerId)) {
        return {
          ok: false,
          playerId,
          reason: inviteEligibility.reasonByPlayerId?.[playerId] || "not-eligible",
          status: "failed",
          success: false,
        };
      }

      return {
        ok: true,
        playerId,
        status: "pending",
        success: true,
      };
    });

    const eligiblePlayerIds = initialResults
      .filter((result) => result.ok)
      .map((result) => result.playerId);
    let invitePersistence = {
      invites: [],
      table: {
        tableCode: null,
        tableDbId: null,
        tableId,
        tableName: null,
      },
    };

    if (eligiblePlayerIds.length > 0) {
      const recipients = await User.find({ _id: { $in: eligiblePlayerIds } });
      const recipientById = new Map(recipients.map((recipient) => [String(recipient._id), recipient]));
      const foundRecipientIds = new Set(recipientById.keys());
      const missingPlayerIds = eligiblePlayerIds.filter((playerId) => !foundRecipientIds.has(playerId));

      if (missingPlayerIds.length > 0) {
        initialResults.forEach((result) => {
          if (missingPlayerIds.includes(result.playerId)) {
            result.ok = false;
            result.reason = "player-not-found";
            result.status = "failed";
            result.success = false;
          }
        });
      }

      const recipientsToInvite = eligiblePlayerIds
        .map((playerId) => recipientById.get(playerId))
        .filter(Boolean);

      if (recipientsToInvite.length > 0) {
        invitePersistence = await pokerRealtimeService.appendTableInviteRecords({
          message,
          recipients: recipientsToInvite,
          sender,
          source: "chat-room",
          tableId,
        });
      }
    }

    const inviteByRecipientId = new Map(
      invitePersistence.invites.map((invite) => [String(invite.recipientAccountId), invite])
    );
    const results = initialResults.map((result) => {
      const invite = inviteByRecipientId.get(result.playerId);

      if (!invite) {
        return result.ok
          ? {
              ...result,
              ok: false,
              reason: "invite-not-created",
              status: "failed",
              success: false,
            }
          : result;
      }

      return {
        inviteId: invite.id,
        ok: true,
        playerId: result.playerId,
        status: "invited",
        success: true,
      };
    });
    const successfulPlayerIds = results
      .filter((result) => result.ok)
      .map((result) => result.playerId);

    if (successfulPlayerIds.length > 0) {
      await User.findByIdAndUpdate(sender._id, {
        $inc: { "referralStats.invitesSent": successfulPlayerIds.length },
        $set: { "referralStats.lastInviteSentAt": new Date() },
      });

      await ChatRoom.updateOne(
        { _id: chatRoom._id },
        {
          $push: {
            tableInviteHistory: {
              $each: [
                {
                  chatRoomId: chatRoom._id,
                  createdAt: new Date(),
                  invitedPlayerIds: successfulPlayerIds,
                  invites: invitePersistence.invites.map(serializeInviteForRecipient),
                  message,
                  results,
                  senderUserId: sender._id,
                  tableCode: invitePersistence.table.tableCode,
                  tableId: invitePersistence.table.tableDbId,
                },
              ],
              $slice: -CHAT_ROOM_TABLE_INVITE_HISTORY_LIMIT,
            },
          },
        }
      );
    }

    const inviteNotifications = await createTableInviteNotifications({
      chatRoom,
      inviteRecords: invitePersistence.invites,
      sender,
      table: invitePersistence.table,
    });
    this.emitNotificationRecords(inviteNotifications, { roomId: chatRoomId });

    const deliveredPlayerIds = this.emitInviteNotifications({
      chatRoomId,
      invites: invitePersistence.invites,
      sender,
      table: invitePersistence.table,
    });
    const eventPayload = {
      chatRoomId,
      deliveredPlayerIds,
      inviteEligibility,
      invitedPlayerIds: successfulPlayerIds,
      invites: invitePersistence.invites.map(serializeInviteForRecipient),
      playerIds,
      results,
      senderPlayerId: senderUserId,
      senderPlayerName: getDisplayName(sender),
      tableCode: invitePersistence.table.tableCode,
      tableDbId: invitePersistence.table.tableDbId,
      tableId: invitePersistence.table.tableId,
      tableName: invitePersistence.table.tableName,
    };

    socket.emit("table:playerInvited", {
      ...eventPayload,
      recipient: false,
      sender: true,
    });

    return {
      ok: successfulPlayerIds.length > 0,
      success: successfulPlayerIds.length > 0,
      ...eventPayload,
    };
  }

  emitNotificationRecords(notificationRecords = [], { fallbackMessage = null, roomId = null } = {}) {
    const notifications = notificationRecords.map(serializeNotification);

    notifications.forEach((notification) => {
      const payload = {
        message: fallbackMessage,
        notification,
        preview: notification.body,
        roomId: notification.chatRoomId || roomId,
        type: notification.type,
        unreadCount: 1,
      };

      this.io.sockets.sockets.forEach((candidateSocket) => {
        const userId = candidateSocket.data?.userId;

        if (userId && String(userId) === String(notification.userId)) {
          candidateSocket.emit("chat:messageNotification", payload);
        }
      });
    });

    return notifications;
  }

  emitMessageNotification(roomId, message) {
    const notification = {
      message,
      preview: `${message.authorName || message.playerName}: ${message.body || message.text}`.slice(0, 240),
      roomId: String(roomId),
      type: "chat_message",
      unreadCount: 1,
    };

    this.io.to(getChatRoomChannel(roomId)).emit("chat:messageNotification", notification);
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
