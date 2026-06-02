const mongoose = require("mongoose");

const AuditLog = require("../models/AuditLog");
const ChatRoom = require("../models/ChatRoom");
const ChatRoomMessage = require("../models/ChatRoomMessage");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_REASON_LENGTH = 500;
const VALID_MODERATION_STATUSES = new Set(["accepted", "blocked", "pending-review"]);

function parsePositiveInteger(value, fallback, maximum = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function parseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeReason(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_REASON_LENGTH);
}

function normalizeFlags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((flag) => String(flag || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function buildRoomIdentifierFilter(roomId) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    return null;
  }

  const identifiers = [{ slug: normalizedRoomId.toLowerCase() }];

  if (mongoose.Types.ObjectId.isValid(normalizedRoomId)) {
    identifiers.push({ _id: normalizedRoomId });
  }

  return { $or: identifiers };
}

async function findRoomForAdmin(roomId) {
  const filter = buildRoomIdentifierFilter(roomId);

  if (!filter) {
    return null;
  }

  return ChatRoom.findOne(filter)
    .populate("createdByUserId", "name email displayName")
    .populate("disabledByAdminId", "name email role");
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id || user.id,
    name: user.name || user.displayName || "",
    email: user.email || "",
    role: user.role || undefined,
  };
}

function serializeTableLaunch(launch) {
  return {
    id: launch._id || `${launch.tableCode || launch.tableId}-${launch.launchedAt || launch.createdAt}`,
    createdAt: launch.createdAt,
    gameSettings: launch.gameSettings || null,
    invitedPlayerIds: launch.invitedPlayerIds || [],
    launchedAt: launch.launchedAt || launch.createdAt,
    launchedByUserId: launch.launchedByUserId,
    rules: launch.rules || null,
    tableCode: launch.tableCode || null,
    tableId: launch.tableId || null,
    tableName: launch.tableName || "",
    tableTier: launch.tableTier || null,
    visibility: launch.visibility || "room",
  };
}

function serializeRoom(room, { includeLaunches = false } = {}) {
  const serialized = {
    id: room._id,
    name: room.name,
    slug: room.slug,
    description: room.description,
    topic: room.topic,
    isPublic: room.isPublic,
    isDisabled: Boolean(room.isDisabled),
    disabledAt: room.disabledAt || null,
    disabledByAdmin: serializeUser(room.disabledByAdminId),
    disabledReason: room.disabledReason || "",
    activePlayerCount: room.activePlayerCount || 0,
    lastMessagePreview: room.lastMessagePreview || "",
    lastMessageAt: room.lastMessageAt || null,
    participantCount: Array.isArray(room.participantStates) ? room.participantStates.length : 0,
    tableLaunchCount: Array.isArray(room.tableLaunches) ? room.tableLaunches.length : 0,
    createdByUser: serializeUser(room.createdByUserId),
    createdByUserId: room.createdByUserId?._id || room.createdByUserId || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };

  if (includeLaunches) {
    serialized.tableLaunches = [...(room.tableLaunches || [])]
      .sort((left, right) => new Date(right.launchedAt || right.createdAt) - new Date(left.launchedAt || left.createdAt))
      .map(serializeTableLaunch);
  }

  return serialized;
}

function serializeMessage(message) {
  return {
    id: message._id,
    roomId: message.roomId?._id || message.roomId,
    room: message.roomId?.name
      ? {
          id: message.roomId._id,
          name: message.roomId.name,
          slug: message.roomId.slug,
          isDisabled: Boolean(message.roomId.isDisabled),
        }
      : undefined,
    senderUserId: message.senderUserId?._id || message.senderUserId || null,
    sender: message.senderUserId?.email
      ? {
          id: message.senderUserId._id,
          name: message.senderUserId.name || message.senderDisplayName,
          email: message.senderUserId.email,
        }
      : null,
    senderDisplayName: message.senderDisplayName,
    text: message.text,
    moderation: message.moderation,
    tone: message.tone || "player",
    launchContext: message.launchContext || null,
    deletedAt: message.deletedAt || null,
    deletedByAdminId: message.deletedByAdminId || null,
    deletionReason: message.deletionReason || "",
    createdAt: message.createdAt,
  };
}

async function writeAuditLog({ adminId, action, targetType, targetId, meta = {} }) {
  return AuditLog.create({
    adminId,
    action,
    targetType,
    targetId,
    meta,
  });
}

const getRooms = async (req, res) => {
  try {
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
    const offset = parseNonNegativeInteger(req.query.offset);
    const { search = "", visibility = "all" } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { topic: { $regex: search, $options: "i" } },
      ];
    }

    if (visibility === "disabled") {
      filter.isDisabled = true;
    } else if (visibility === "enabled") {
      filter.isDisabled = { $ne: true };
    } else if (visibility === "public") {
      filter.isPublic = true;
      filter.isDisabled = { $ne: true };
    } else if (visibility === "private") {
      filter.isPublic = false;
      filter.isDisabled = { $ne: true };
    }

    const [rooms, count] = await Promise.all([
      ChatRoom.find(filter)
        .populate("createdByUserId", "name email displayName")
        .populate("disabledByAdminId", "name email role")
        .sort({ isDisabled: 1, lastMessageAt: -1, updatedAt: -1 })
        .skip(offset)
        .limit(limit),
      ChatRoom.countDocuments(filter),
    ]);

    return res.status(200).json({
      count,
      limit,
      offset,
      rooms: rooms.map((room) => serializeRoom(room)),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching admin chat rooms",
      error: error.message,
    });
  }
};

const getRoomById = async (req, res) => {
  try {
    const room = await findRoomForAdmin(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    return res.status(200).json({ room: serializeRoom(room, { includeLaunches: true }) });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching admin chat room",
      error: error.message,
    });
  }
};

const getFlaggedMessages = async (req, res) => {
  try {
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
    const offset = parseNonNegativeInteger(req.query.offset);
    const status = String(req.query.status || "pending-review").trim();
    const includeDeleted = req.query.includeDeleted === "true";
    const filter = {
      $or: [
        { "moderation.status": status },
        { "moderation.flags.0": { $exists: true } },
      ],
    };

    if (status === "all") {
      delete filter.$or;
      filter["moderation.flags.0"] = { $exists: true };
    } else if (!VALID_MODERATION_STATUSES.has(status)) {
      return res.status(400).json({ message: "Invalid moderation status" });
    }

    if (!includeDeleted) {
      filter.deletedAt = null;
    }

    const [messages, count] = await Promise.all([
      ChatRoomMessage.find(filter)
        .populate("roomId", "name slug isDisabled")
        .populate("senderUserId", "name email displayName")
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      ChatRoomMessage.countDocuments(filter),
    ]);

    return res.status(200).json({
      count,
      limit,
      messages: messages.map(serializeMessage),
      offset,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching flagged chat room messages",
      error: error.message,
    });
  }
};

const getRoomTableLaunches = async (req, res) => {
  try {
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
    const room = await findRoomForAdmin(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    const launches = [...(room.tableLaunches || [])]
      .sort((left, right) => new Date(right.launchedAt || right.createdAt) - new Date(left.launchedAt || left.createdAt))
      .slice(0, limit)
      .map(serializeTableLaunch);

    return res.status(200).json({
      count: launches.length,
      launches,
      room: serializeRoom(room),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching chat room table launches",
      error: error.message,
    });
  }
};

const updateRoomVisibility = async (req, res) => {
  try {
    const room = await findRoomForAdmin(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Chat room not found" });
    }

    const shouldDisable = req.body.isDisabled ?? req.body.disabled ?? req.body.hidden;

    if (typeof shouldDisable !== "boolean") {
      return res.status(400).json({ message: "isDisabled boolean is required" });
    }

    const previousState = {
      isDisabled: Boolean(room.isDisabled),
      disabledAt: room.disabledAt,
      disabledReason: room.disabledReason || "",
    };
    const reason = normalizeReason(req.body.reason || req.body.disabledReason);

    room.isDisabled = shouldDisable;
    room.disabledAt = shouldDisable ? new Date() : null;
    room.disabledByAdminId = shouldDisable ? req.admin._id : null;
    room.disabledReason = shouldDisable ? reason : "";
    await room.save();

    await writeAuditLog({
      adminId: req.admin._id,
      action: shouldDisable ? "CHAT_ROOM_DISABLED" : "CHAT_ROOM_ENABLED",
      targetType: "ChatRoom",
      targetId: room._id.toString(),
      meta: {
        previousState,
        newState: {
          isDisabled: room.isDisabled,
          disabledAt: room.disabledAt,
          disabledReason: room.disabledReason,
        },
      },
    });

    const refreshedRoom = await findRoomForAdmin(room._id);

    return res.status(200).json({
      message: shouldDisable ? "Chat room disabled" : "Chat room enabled",
      room: serializeRoom(refreshedRoom),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating chat room visibility",
      error: error.message,
    });
  }
};

const moderateMessage = async (req, res) => {
  try {
    const { status } = req.body;

    if (!VALID_MODERATION_STATUSES.has(status)) {
      return res.status(400).json({ message: "Valid moderation status is required" });
    }

    const message = await ChatRoomMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: "Chat room message not found" });
    }

    const previousModeration = message.moderation ? message.moderation.toObject?.() || message.moderation : {};
    const reason = normalizeReason(req.body.reason ?? message.moderation?.reason);
    const flags = req.body.flags ? normalizeFlags(req.body.flags) : message.moderation?.flags || [];

    message.moderation = {
      flags,
      reason,
      reviewedAt: new Date(),
      reviewedByUserId: req.admin._id,
      status,
    };
    await message.save();

    await writeAuditLog({
      adminId: req.admin._id,
      action: "CHAT_ROOM_MESSAGE_MODERATED",
      targetType: "ChatRoomMessage",
      targetId: message._id.toString(),
      meta: {
        previousModeration,
        newModeration: message.moderation,
        roomId: String(message.roomId),
      },
    });

    const refreshedMessage = await ChatRoomMessage.findById(message._id)
      .populate("roomId", "name slug isDisabled")
      .populate("senderUserId", "name email displayName");

    return res.status(200).json({
      message: "Chat room message moderated",
      chatMessage: serializeMessage(refreshedMessage),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error moderating chat room message",
      error: error.message,
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const message = await ChatRoomMessage.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: "Chat room message not found" });
    }

    if (!message.deletedAt) {
      message.deletedAt = new Date();
      message.deletedByAdminId = req.admin._id;
      message.deletionReason = normalizeReason(req.body.reason || req.query.reason);
      message.moderation = {
        ...(message.moderation?.toObject?.() || message.moderation || {}),
        reviewedAt: new Date(),
        reviewedByUserId: req.admin._id,
        status: "blocked",
      };
      await message.save();
    }

    await writeAuditLog({
      adminId: req.admin._id,
      action: "CHAT_ROOM_MESSAGE_DELETED",
      targetType: "ChatRoomMessage",
      targetId: message._id.toString(),
      meta: {
        deletionReason: message.deletionReason,
        roomId: String(message.roomId),
        senderUserId: message.senderUserId ? String(message.senderUserId) : null,
      },
    });

    return res.status(200).json({
      message: "Chat room message deleted",
      chatMessage: serializeMessage(message),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting chat room message",
      error: error.message,
    });
  }
};

module.exports = {
  deleteMessage,
  getFlaggedMessages,
  getRoomById,
  getRoomTableLaunches,
  getRooms,
  moderateMessage,
  updateRoomVisibility,
};
