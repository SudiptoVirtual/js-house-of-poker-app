const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const ChatRoomMessage = require("../models/ChatRoomMessage");
const GameTable = require("../models/GameTable");
const User = require("../models/User");
const { DEFAULT_CHAT_ROOMS, seedChatRooms } = require("../scripts/seedChatRooms");
const { getChatRoomPresenceService } = require("../services/chatRoomPresenceService");
const {
  createChatRoomInviteNotifications,
  serializeNotification,
} = require("../services/chatRoomNotificationService");
const { getIO } = require("../sockets/socketRegistry");

const DEFAULT_RECENT_MESSAGE_LIMIT = 25;
const MAX_RECENT_MESSAGE_LIMIT = 100;
const DEFAULT_ROOM_LIST_LIMIT = 50;
const MAX_ROOM_LIST_LIMIT = 100;
const DEFAULT_CHAT_ROOM_SLUGS = DEFAULT_CHAT_ROOMS.map((room) => room.slug);
const RESTRICTED_CHAT_ROOM_SEED_ENVIRONMENTS = new Set(["production", "preview"]);

function isTruthyFlag(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function getChatRoomSeedEnvironments() {
  return [
    process.env.NODE_ENV,
    process.env.APP_ENV,
    process.env.APP_ENVIRONMENT,
    process.env.VERCEL_ENV,
    process.env.RENDER_ENV,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function isRestrictedChatRoomSeedEnvironment() {
  return getChatRoomSeedEnvironments().some((environment) =>
    RESTRICTED_CHAT_ROOM_SEED_ENVIRONMENTS.has(environment)
  );
}

function shouldIncludeDefaultChatRooms(req) {
  if (isTruthyFlag(process.env.CHAT_ROOMS_INCLUDE_DEFAULTS)) {
    return true;
  }

  if (isRestrictedChatRoomSeedEnvironment()) {
    return false;
  }

  return (
    isTruthyFlag(req.query?.includeDefaultRooms) ||
    isTruthyFlag(req.query?.includeSeedRooms) ||
    isTruthyFlag(req.query?.devIncludeDefaultRooms)
  );
}

function buildChatRoomIdentifiers(roomId) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return [];
  }

  const identifiers = [{ slug: normalizedRoomId.toLowerCase() }];

  if (mongoose.Types.ObjectId.isValid(normalizedRoomId)) {
    identifiers.push({ _id: normalizedRoomId });
  }

  return identifiers;
}

function serializeChatRoomPlayer(player) {
  const userId = String(player.userId || player.id || "");
  const displayName = player.displayName || player.playerName || "Player";
  const avatarInitials =
    player.avatarInitials ||
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ||
    "P";

  return {
    avatarInitials,
    chipStackLabel: player.chipStackLabel || "Online now",
    displayName,
    handle: player.handle || displayName,
    id: userId,
    isConnected: player.isConnected !== false,
    socketCount: player.socketCount || 1,
    status: player.status || "available",
    userId,
  };
}

function serializeChatRoomMessage(message) {
  const createdAt = message.createdAt || new Date();
  const roomId = String(message.roomId);
  const authorId = message.senderUserId ? String(message.senderUserId) : null;

  return {
    authorId,
    authorName: message.senderDisplayName,
    body: message.text,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
    id: String(message._id),
    playerId: authorId,
    playerName: message.senderDisplayName,
    roomId,
    text: message.text,
    tone: message.tone || "player",
  };
}

function normalizeObjectIdString(value) {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
}

function normalizePlayerIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(normalizeObjectIdString)
        .filter(Boolean)
    ),
  ];
}

function getDisplayName(user) {
  return user?.name || user?.email || "Player";
}

function getAvatarInitials(displayName) {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P"
  );
}

function serializeActiveFriend(user) {
  const displayName = getDisplayName(user);
  const handle = user.handle || user.username || user.email?.split("@")[0] || displayName;

  return {
    avatarInitials: getAvatarInitials(displayName),
    displayName,
    handle: handle.startsWith("@") ? handle : `@${handle}`,
    id: String(user._id),
    isOnline: Boolean(user.isOnline),
    name: displayName,
    status: user.isOnline ? "available" : "away",
    userId: String(user._id),
  };
}

function slugifyRoomName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "room";
}

async function generateUniqueRoomSlug(name) {
  const baseSlug = slugifyRoomName(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await ChatRoom.exists({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function userCanAccessChatRoom(room, userId) {
  if (room.isPublic !== false) {
    return true;
  }

  const normalizedUserId = normalizeObjectIdString(userId);

  if (!normalizedUserId) {
    return false;
  }

  if (room.createdByUserId && String(room.createdByUserId) === normalizedUserId) {
    return true;
  }

  return (room.participantStates || []).some(
    (state) => String(state.userId) === normalizedUserId
  );
}

function buildParticipantState(userId) {
  const now = new Date();

  return {
    lastReadAt: now,
    lastSeenAt: now,
    unreadCount: 0,
    userId,
  };
}

async function getActiveFriendUsers(user) {
  const freshUser = await User.findById(user._id).select("friends referredByUserId");
  const friendIds = new Set(
    (freshUser?.friends || [])
      .map(normalizeObjectIdString)
      .filter(Boolean)
  );

  if (freshUser?.referredByUserId) {
    const referrerId = normalizeObjectIdString(freshUser.referredByUserId);
    if (referrerId) {
      friendIds.add(referrerId);
    }
  }

  const referredUsers = await User.find({
    referredByUserId: user._id,
    status: { $ne: "blocked" },
    isBlocked: { $ne: true },
  }).select("_id");

  referredUsers.forEach((friend) => friendIds.add(String(friend._id)));
  friendIds.delete(String(user._id));

  if (friendIds.size === 0) {
    return [];
  }

  return User.find({
    _id: { $in: [...friendIds] },
    isBlocked: { $ne: true },
    isOnline: true,
    status: { $ne: "blocked" },
  })
    .select("avatar email isOnline name playerStatus")
    .sort({ name: 1, email: 1 });
}

async function getEligibleActiveFriendUsers(user, requestedPlayerIds) {
  const requestedIds = normalizePlayerIds(requestedPlayerIds);
  const activeFriends = await getActiveFriendUsers(user);
  const activeFriendById = new Map(activeFriends.map((friend) => [String(friend._id), friend]));

  return requestedIds.map((playerId) => activeFriendById.get(playerId)).filter(Boolean);
}

function emitChatRoomInviteNotifications(notificationRecords, room, sender) {
  const io = getIO();
  const serializedNotifications = notificationRecords.map(serializeNotification);

  if (!io) {
    return serializedNotifications;
  }

  serializedNotifications.forEach((notification) => {
    const payload = {
      notification,
      room: room.toRoomListItem(notification.userId),
      roomId: String(room._id),
      senderPlayerId: String(sender._id),
      senderPlayerName: getDisplayName(sender),
      type: "chat_room_invite",
      unreadCount: 1,
    };

    io.sockets.sockets.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;

      if (userId && String(userId) === String(notification.userId)) {
        candidateSocket.emit("chat:roomInvited", payload);
        candidateSocket.emit("chat:messageNotification", {
          notification,
          preview: notification.body,
          roomId: String(room._id),
          type: "chat_room_invite",
          unreadCount: 1,
        });
      }
    });
  });

  return serializedNotifications;
}

async function findSocialChatRoom(roomId) {
  const identifiers = buildChatRoomIdentifiers(roomId);

  if (identifiers.length === 0) {
    return null;
  }

  return ChatRoom.findOne({
    isDisabled: { $ne: true },
    $or: identifiers,
  });
}

async function serializeSocialChatRoomDetail(room, recentMessageLimit, userId = null) {
  const roomId = String(room._id);
  const presenceSnapshot = getChatRoomPresenceService().getPresenceSnapshot(roomId);
  const messages = await ChatRoomMessage.find({
    deletedAt: null,
    "moderation.status": { $ne: "blocked" },
    roomId,
  })
    .sort({ createdAt: -1 })
    .limit(recentMessageLimit);

  const serializedMessages = messages.reverse().map(serializeChatRoomMessage);

  return {
    ...room.toRoomListItem(userId),
    activePlayerCount: presenceSnapshot.activePlayerCount || room.activePlayerCount || 0,
    activePlayers: (presenceSnapshot.players || []).map(serializeChatRoomPlayer),
    messages: serializedMessages,
    players: (presenceSnapshot.players || []).map(serializeChatRoomPlayer),
    presenceSnapshot,
    recentMessages: serializedMessages,
    roomId,
  };
}

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function buildOpenRoomFilter() {
  return {
    status: { $ne: "closed" },
    tableCode: { $exists: true, $ne: null },
  };
}

function getRoomId(table) {
  return table.tableCode || table._id.toString();
}

function isVisibleChatMessage(message) {
  return message?.moderation?.status !== "blocked";
}

function sortMessagesAscending(messages) {
  return [...messages].sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0));
}

function getRecentMessages(table, limit = DEFAULT_RECENT_MESSAGE_LIMIT) {
  const messages = Array.isArray(table.chatMessages) ? table.chatMessages : [];

  return sortMessagesAscending(messages)
    .filter(isVisibleChatMessage)
    .slice(-limit)
    .map((message) => ({
      createdAt: message.createdAt,
      id: message.id,
      playerId: message.playerId || null,
      playerName: message.playerName,
      text: message.text,
      tone: message.tone || "player",
    }));
}

function getRecentMessagePreview(table) {
  const [message] = getRecentMessages(table, 1);

  if (!message) {
    return null;
  }

  return {
    createdAt: message.createdAt,
    playerName: message.playerName,
    text: message.text,
    tone: message.tone,
  };
}

function getActivePlayers(table) {
  const players = Array.isArray(table.players) ? table.players : [];

  return players
    .filter((player) => player.isConnected && !player.pendingRemoval)
    .sort((left, right) => left.seatNumber - right.seatNumber)
    .map((player) => ({
      avatar: player.avatar || "",
      chipsOnTable: player.chipsOnTable || 0,
      displayName: player.displayName,
      isConnected: Boolean(player.isConnected),
      playerStatus: player.playerStatus || "NO_STATUS",
      seatNumber: player.seatNumber,
      statusIcon: player.statusIcon || "badge-no-status",
      userId: player.userId ? player.userId.toString() : null,
    }));
}

function getRuntimePresenceSnapshot(table) {
  const presenceService = getChatRoomPresenceService();
  const roomIds = [getRoomId(table), table._id ? String(table._id) : null].filter(Boolean);

  for (const roomId of roomIds) {
    const snapshot = presenceService.getPresenceSnapshot(roomId);

    if (snapshot.players.length > 0) {
      return {
        ...snapshot,
        maxPlayers: table.maxPlayers,
        roomId: getRoomId(table),
      };
    }
  }

  return null;
}

function getPresenceSnapshot(table) {
  const runtimePresence = getRuntimePresenceSnapshot(table);

  if (runtimePresence) {
    return runtimePresence;
  }

  const players = Array.isArray(table.players) ? table.players : [];
  const connectedPlayers = players.filter(
    (player) => player.isConnected && !player.pendingRemoval
  );

  return {
    activePlayerCount: connectedPlayers.length,
    maxPlayers: table.maxPlayers,
    players: getActivePlayers(table),
    totalPlayerCount: players.filter((player) => !player.pendingRemoval).length,
    updatedAt: table.updatedAt,
  };
}

function serializeRoomListItem(table) {
  const runtimePresence = getRuntimePresenceSnapshot(table);
  const activePlayerCount = runtimePresence?.activePlayerCount ?? getActivePlayers(table).length;
  const recentMessagePreview = getRecentMessagePreview(table);

  return {
    activePlayerCount,
    gameType: table.gameType,
    id: getRoomId(table),
    maxPlayers: table.maxPlayers,
    name: table.tableName,
    phase: table.phase,
    recentMessagePreview,
    roomId: getRoomId(table),
    status: table.status,
    tableCode: table.tableCode || null,
    tableName: table.tableName,
    unreadCount: 0,
  };
}

function serializeRoomDetail(table, recentMessageLimit) {
  const roomId = getRoomId(table);
  const presenceSnapshot = getPresenceSnapshot(table);

  return {
    activePlayers: presenceSnapshot.players,
    metadata: {
      bigBlind: table.bigBlind,
      buyInAmount: table.buyInAmount,
      createdAt: table.createdAt,
      gameSettings: table.gameSettings,
      gameType: table.gameType,
      handCount: table.handCount,
      hostUserId: table.hostUserId ? table.hostUserId.toString() : null,
      id: roomId,
      lastWinnerSummary: table.lastWinnerSummary || null,
      maxPlayers: table.maxPlayers,
      minPlayersToStart: table.minPlayersToStart,
      name: table.tableName,
      phase: table.phase,
      pot: table.currentPot || 0,
      roomId,
      smallBlind: table.smallBlind,
      status: table.status,
      tableCode: table.tableCode || null,
      tableName: table.tableName,
      updatedAt: table.updatedAt,
    },
    presenceSnapshot,
    recentMessages: getRecentMessages(table, recentMessageLimit),
    roomId,
    unreadCount: 0,
  };
}

async function findRoomById(roomId) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return null;
  }

  const identifiers = [{ tableCode: normalizedRoomId.toUpperCase() }];

  if (mongoose.Types.ObjectId.isValid(normalizedRoomId)) {
    identifiers.push({ _id: normalizedRoomId });
  }

  return GameTable.findOne({
    $and: [buildOpenRoomFilter(), { $or: identifiers }],
  }).lean();
}

const getChatRooms = async (req, res) => {
  try {
    const limit = parsePositiveInteger(
      req.query.limit,
      DEFAULT_ROOM_LIST_LIMIT,
      MAX_ROOM_LIST_LIMIT
    );
    const includeDefaultRooms = shouldIncludeDefaultChatRooms(req);

    const findRoomListOptions = {
      excludeSlugs: includeDefaultRooms ? [] : DEFAULT_CHAT_ROOM_SLUGS,
      limit,
      requireCreator: !includeDefaultRooms,
    };

    if (req.user?._id) {
      findRoomListOptions.userId = req.user._id;
    }

    const userCreatedRooms = await ChatRoom.findRoomList(findRoomListOptions);

    if (userCreatedRooms.length > 0) {
      return res.status(200).json({
        count: userCreatedRooms.length,
        rooms: userCreatedRooms,
      });
    }

    const rooms = await GameTable.find(buildOpenRoomFilter())
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    const serializedRooms = rooms.map(serializeRoomListItem);

    const responseBody = {
      count: serializedRooms.length,
      rooms: serializedRooms,
    };

    if (serializedRooms.length === 0) {
      responseBody.message = "No live chat rooms are available.";
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching chat rooms",
      error: error.message,
    });
  }
};

const getChatRoomById = async (req, res) => {
  try {
    const recentMessageLimit = parsePositiveInteger(
      req.query.messageLimit,
      DEFAULT_RECENT_MESSAGE_LIMIT,
      MAX_RECENT_MESSAGE_LIMIT
    );
    const socialRoom = await findSocialChatRoom(req.params.roomId);

    if (socialRoom) {
      if (!userCanAccessChatRoom(socialRoom, req.user?._id)) {
        return res.status(403).json({
          message: "You are not allowed to access this chat room",
        });
      }

      return res.status(200).json({
        room: await serializeSocialChatRoomDetail(
          socialRoom,
          recentMessageLimit,
          req.user?._id || null
        ),
      });
    }

    const room = await findRoomById(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        message: "Chat room not found",
      });
    }

    return res.status(200).json({
      room: serializeRoomDetail(room, recentMessageLimit),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching chat room",
      error: error.message,
    });
  }
};

const getActiveChatRoomFriends = async (req, res) => {
  try {
    const friends = await getActiveFriendUsers(req.user);

    return res.status(200).json({
      count: friends.length,
      friends: friends.map(serializeActiveFriend),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching active friends",
      error: error.message,
    });
  }
};

const createChatRoom = async (req, res) => {
  try {
    const name = String(req.body?.name || "").replace(/\s+/g, " ").trim();
    const description = String(req.body?.description || "").replace(/\s+/g, " ").trim();
    const invitedPlayerIds = normalizePlayerIds(req.body?.invitedPlayerIds || req.body?.playerIds);

    if (!name) {
      return res.status(400).json({
        message: "Room name is required",
      });
    }

    if (name.length > 120) {
      return res.status(400).json({
        message: "Room name must be 120 characters or fewer",
      });
    }

    const invitedFriends = invitedPlayerIds.length > 0
      ? await getEligibleActiveFriendUsers(req.user, invitedPlayerIds)
      : [];
    const invitedFriendIds = invitedFriends.map((friend) => String(friend._id));
    const rejectedPlayerIds = invitedPlayerIds.filter(
      (playerId) => !invitedFriendIds.includes(playerId)
    );

    if (rejectedPlayerIds.length > 0) {
      return res.status(400).json({
        message: "Only active friends can be invited to a chat room",
        rejectedPlayerIds,
      });
    }

    const participantIds = [
      String(req.user._id),
      ...invitedFriendIds,
    ];
    const room = await ChatRoom.create({
      activePlayerCount: 0,
      createdByUserId: req.user._id,
      description: description || "Private room for planning poker sessions.",
      isPublic: false,
      name,
      participantStates: participantIds.map(buildParticipantState),
      slug: await generateUniqueRoomSlug(name),
      topic: "Private group chat",
      visibility: "private",
    });

    let notifications = [];

    if (invitedFriendIds.length > 0) {
      const notificationRecords = await createChatRoomInviteNotifications({
        recipientUserIds: invitedFriendIds,
        room,
        sender: req.user,
      });
      notifications = emitChatRoomInviteNotifications(notificationRecords, room, req.user);
    }

    return res.status(201).json({
      invitedPlayerIds: invitedFriendIds,
      notifications,
      room: await serializeSocialChatRoomDetail(room, DEFAULT_RECENT_MESSAGE_LIMIT, req.user._id),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating chat room",
      error: error.message,
    });
  }
};

const inviteChatRoomFriends = async (req, res) => {
  try {
    const room = await findSocialChatRoom(req.params.roomId);

    if (!room) {
      return res.status(404).json({
        message: "Chat room not found",
      });
    }

    if (!userCanAccessChatRoom(room, req.user._id)) {
      return res.status(403).json({
        message: "You are not allowed to invite friends to this chat room",
      });
    }

    const requestedPlayerIds = normalizePlayerIds(req.body?.playerIds || req.body?.invitedPlayerIds);

    if (requestedPlayerIds.length === 0) {
      return res.status(400).json({
        message: "At least one active friend is required",
      });
    }

    const activeFriends = await getEligibleActiveFriendUsers(req.user, requestedPlayerIds);
    const activeFriendIds = activeFriends.map((friend) => String(friend._id));
    const rejectedPlayerIds = requestedPlayerIds.filter(
      (playerId) => !activeFriendIds.includes(playerId)
    );

    if (rejectedPlayerIds.length > 0) {
      return res.status(400).json({
        message: "Only active friends can be invited to a chat room",
        rejectedPlayerIds,
      });
    }

    const existingParticipantIds = new Set(
      (room.participantStates || []).map((state) => String(state.userId))
    );
    const newParticipantIds = activeFriendIds.filter(
      (playerId) => !existingParticipantIds.has(playerId)
    );

    if (newParticipantIds.length > 0) {
      await ChatRoom.updateOne(
        { _id: room._id },
        {
          $push: {
            participantStates: {
              $each: newParticipantIds.map(buildParticipantState),
            },
          },
        }
      );
    }

    const updatedRoom = await ChatRoom.findById(room._id);
    const notificationRecords = newParticipantIds.length > 0
      ? await createChatRoomInviteNotifications({
          recipientUserIds: newParticipantIds,
          room: updatedRoom,
          sender: req.user,
        })
      : [];
    const notifications = emitChatRoomInviteNotifications(notificationRecords, updatedRoom, req.user);

    return res.status(200).json({
      alreadyInRoomPlayerIds: activeFriendIds.filter((playerId) => existingParticipantIds.has(playerId)),
      invitedPlayerIds: newParticipantIds,
      notifications,
      ok: true,
      room: await serializeSocialChatRoomDetail(updatedRoom, DEFAULT_RECENT_MESSAGE_LIMIT, req.user._id),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error inviting friends to chat room",
      error: error.message,
    });
  }
};

const seedDefaultChatRooms = async (req, res) => {
  try {
    if (isRestrictedChatRoomSeedEnvironment()) {
      return res.status(403).json({
        message: "Default chat room seeding is disabled in production and preview environments.",
      });
    }

    const { rooms, upsertedCount, modifiedCount, matchedCount } = await seedChatRooms({
      logger: { log: () => {} },
    });

    return res.status(201).json({
      count: rooms.length,
      matchedCount,
      modifiedCount,
      upsertedCount,
      rooms,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error seeding default chat rooms",
      error: error.message,
    });
  }
};

module.exports = {
  createChatRoom,
  getActiveChatRoomFriends,
  getChatRoomById,
  getChatRooms,
  inviteChatRoomFriends,
  seedDefaultChatRooms,
};
