const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const GameTable = require("../models/GameTable");
const { seedChatRooms } = require("../scripts/seedChatRooms");
const { getChatRoomPresenceService } = require("../services/chatRoomPresenceService");

const DEFAULT_RECENT_MESSAGE_LIMIT = 25;
const MAX_RECENT_MESSAGE_LIMIT = 100;
const DEFAULT_ROOM_LIST_LIMIT = 50;
const MAX_ROOM_LIST_LIMIT = 100;


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

    const seededRooms = await ChatRoom.findRoomList({ limit });

    if (seededRooms.length > 0) {
      return res.status(200).json({
        count: seededRooms.length,
        rooms: seededRooms,
      });
    }

    const rooms = await GameTable.find(buildOpenRoomFilter())
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      count: rooms.length,
      rooms: rooms.map(serializeRoomListItem),
    });
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

const seedDefaultChatRooms = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        message: "Default chat room seeding is disabled in production.",
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
  getChatRoomById,
  getChatRooms,
  seedDefaultChatRooms,
};
