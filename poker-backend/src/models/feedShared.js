const mongoose = require("mongoose");

const PLAYER_STATUSES = ["Online", "In Lobby", "In Chat Room", "Playing 357", "At Table", "Away"];
const POST_VISIBILITIES = ["public", "friends", "private", "unlisted"];
const MODERATION_STATUSES = ["accepted", "blocked", "pending-review"];
const POST_STATUSES = ["draft", "published", "archived", "deleted"];
const POST_KINDS = ["standard", "table-invite", "share-win"];
const POST_TYPES = ["text", "media", "table_invite", "win_share"];
const PROMOTION_STATES = ["none", "pending", "active", "paused", "expired", "rejected"];
const MEDIA_TYPES = ["image", "video", "clip", "link"];
const MEDIA_PROCESSING_STATUSES = ["pending", "processing", "ready", "failed"];
const REACTION_TYPES = ["support"];
const SHARE_DESTINATIONS = ["copy-link", "profile", "feed", "chat-room", "table", "friend", "friends", "facebook", "external"];
const SHARE_DESTINATION_ALIASES = new Map([
  ["copy", "copy-link"],
  ["link", "copy-link"],
  ["clipboard", "copy-link"],
  ["chat", "chat-room"],
  ["chatroom", "chat-room"],
  ["room", "chat-room"],
  ["friends", "friend"],
  ["direct", "friend"],
  ["dm", "friend"],
  ["friend-chat", "friend"],
  ["direct-friend", "friend"],
  ["direct-friends", "friend"],
  ["poker-table", "table"],
  ["fb", "facebook"],
  ["social", "external"],
]);

function normalizeShareDestination(value, fallback = "copy-link") {
  const destination = String(value || fallback).trim().toLowerCase();

  return SHARE_DESTINATION_ALIASES.get(destination) || destination;
}

function nullableObjectIdToString(value) {
  return value ? String(value) : null;
}

function dateToISOString(value) {
  return value instanceof Date ? value.toISOString() : null;
}

function normalizeCount(value) {
  return Number.isFinite(value) ? value : 0;
}

const playerSnapshotSchema = new mongoose.Schema(
  {
    avatarUrl: {
      type: String,
      default: "",
      trim: true,
    },
    handle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: PLAYER_STATUSES,
      default: "Away",
    },
    statusTier: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const mediaSchema = new mongoose.Schema(
  {
    altText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    durationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    height: {
      type: Number,
      default: null,
      min: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    playableUrl: {
      type: String,
      default: "",
      trim: true,
    },
    processingStatus: {
      type: String,
      enum: MEDIA_PROCESSING_STATUSES,
      default: null,
    },
    thumbnailUrl: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: MEDIA_TYPES,
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    variants: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    width: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false }
);

const tableContextSchema = new mongoose.Schema(
  {
    gameLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    seatsOpen: {
      type: Number,
      default: null,
      min: 0,
    },
    tableCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 32,
    },
    tableName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  },
  { _id: false }
);

const gameContextSchema = new mongoose.Schema(
  {
    gameType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    handId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    handNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    headline: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    resultLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    stakesLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    tableName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  },
  { _id: false }
);

const moderationSchema = new mongoose.Schema(
  {
    flags: {
      type: [String],
      default: [],
    },
    reason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "accepted",
    },
  },
  { _id: false }
);

const countersSchema = new mongoose.Schema(
  {
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftClipsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftClipsTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    promotedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reactionCounts: {
      type: Map,
      of: Number,
      default: () => ({}),
    },
    supportersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const promotionStateSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    budgetClips: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    isPromoted: {
      type: Boolean,
      default: false,
      index: true,
    },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPromotion",
      default: null,
    },
    promotedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paymentReference: {
      type: String,
      default: "",
      trim: true,
    },
    paymentStatus: {
      type: String,
      default: "",
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    spentClips: {
      type: Number,
      default: 0,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    state: {
      type: String,
      enum: PROMOTION_STATES,
      default: "none",
    },
    targeting: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { _id: false }
);

function buildProfileRoute(userId) {
  const id = String(userId || "");

  return {
    deepLink: id ? `houseofpoker://profile/${id}` : "houseofpoker://profile",
    params: id ? { playerId: id, userId: id } : {},
    route: "Profile",
    screen: "ProfileScreen",
  };
}

function buildFriendsRoute(userId, action = "open") {
  const id = String(userId || "");

  return {
    action,
    deepLink: id ? `houseofpoker://friends?userId=${encodeURIComponent(id)}&action=${encodeURIComponent(action)}` : "houseofpoker://friends",
    params: id ? { action, userId: id } : { action },
    route: "Friends",
    screen: "FriendsScreen",
  };
}

function serializePlayerSnapshot(document, options = {}) {
  const playerId = String(document.authorUserId);

  return {
    ...(document.authorSnapshot?.avatarUrl ? { avatarUrl: document.authorSnapshot.avatarUrl } : {}),
    handle: document.authorSnapshot?.handle || "@player",
    actorProfileLink: buildProfileRoute(playerId),
    id: playerId,
    name: document.authorSnapshot?.name || "Player",
    profileDeepLink: `houseofpoker://profile/${playerId}`,
    profileRoute: buildProfileRoute(playerId),
    status: document.authorSnapshot?.status || "Away",
    ...(document.authorSnapshot?.statusTier ? { statusTier: document.authorSnapshot.statusTier } : {}),
  };
}

function buildTableRoute({ tableCode = "", tableId = "" } = {}) {
  const normalizedCode = String(tableCode || "").trim().toUpperCase();
  const normalizedId = String(tableId || "").trim();
  const identifier = normalizedCode || normalizedId;

  return {
    deepLink: identifier ? `houseofpoker://tables/${encodeURIComponent(identifier)}` : "houseofpoker://game",
    params: {
      ...(normalizedCode ? { tableCode: normalizedCode } : {}),
      ...(normalizedId ? { tableId: normalizedId } : {}),
    },
    route: "Game",
    screen: "GameScreen",
  };
}

function buildChatRoomRoute(roomId) {
  const id = String(roomId || "").trim();

  return {
    deepLink: id ? `houseofpoker://chat-rooms/${encodeURIComponent(id)}` : "houseofpoker://chat-rooms",
    params: id ? { roomId: id, selectedRoomId: id } : {},
    route: "ChatRooms",
    screen: "ChatRoomsScreen",
  };
}

function serializeTableContext(document) {
  const source = document.tableContext || {};
  const populatedTable = document.tableId && typeof document.tableId === "object" && document.tableId._id
    ? document.tableId
    : null;
  const tableId = populatedTable?._id || document.tableId;
  const tableCode = source.tableCode || document.tableCode || populatedTable?.tableCode || "";
  const tableName = source.tableName || populatedTable?.tableName || "";
  const gameType = populatedTable?.gameType || populatedTable?.gameSettings?.game || "";
  const gameLabel = source.gameLabel || (gameType === "357" ? "3-5-7" : gameType === "holdem" ? "Texas Hold'em" : gameType);
  const occupiedSeats = Array.isArray(populatedTable?.players)
    ? populatedTable.players.length
    : Array.isArray(populatedTable?.seats)
      ? populatedTable.seats.filter((seat) => seat?.playerId || seat?.player).length
      : null;
  const seatsOpen = source.seatsOpen == null && Number.isFinite(populatedTable?.maxPlayers) && occupiedSeats != null
    ? Math.max(0, populatedTable.maxPlayers - occupiedSeats)
    : source.seatsOpen;

  if (!tableName && !gameLabel && !tableCode && !tableId && seatsOpen == null) {
    return undefined;
  }

  return {
    activeTableNavigation: buildTableRoute({ tableCode, tableId: tableId ? String(tableId) : "" }),
    gameLabel,
    ...(seatsOpen == null ? {} : { seatsOpen }),
    ...(tableId ? { tableId: String(tableId) } : {}),
    ...(tableCode ? { tableCode } : {}),
    tableName,
  };
}

function serializeGameContext(document) {
  if (!document.gameContext?.headline) {
    return undefined;
  }

  return {
    ...(document.gameContext.gameType ? { gameType: document.gameContext.gameType } : {}),
    ...(document.gameContext.handId ? { handId: document.gameContext.handId } : {}),
    ...(document.gameContext.handNumber ? { handNumber: document.gameContext.handNumber } : {}),
    headline: document.gameContext.headline,
    ...(document.gameContext.resultLabel ? { resultLabel: document.gameContext.resultLabel } : {}),
    ...(document.gameContext.stakesLabel ? { stakesLabel: document.gameContext.stakesLabel } : {}),
    ...(document.gameContext.tableName ? { tableName: document.gameContext.tableName } : {}),
  };
}

function resolveSupportedByCurrentPlayer(document, currentUserId) {
  if (!currentUserId) {
    return undefined;
  }

  const userId = String(currentUserId);

  if (Array.isArray(document.currentUserReactions)) {
    return document.currentUserReactions.some(
      (reaction) => String(reaction.userId) === userId && (reaction.reactionType || reaction.type) === "support" && !reaction.deletedAt
    );
  }

  if (document.supportedByCurrentPlayer !== undefined) {
    return Boolean(document.supportedByCurrentPlayer);
  }

  return undefined;
}

module.exports = {
  MEDIA_PROCESSING_STATUSES,
  MEDIA_TYPES,
  MODERATION_STATUSES,
  PLAYER_STATUSES,
  POST_STATUSES,
  POST_KINDS,
  POST_TYPES,
  POST_VISIBILITIES,
  PROMOTION_STATES,
  REACTION_TYPES,
  SHARE_DESTINATIONS,
  SHARE_DESTINATION_ALIASES,
  countersSchema,
  dateToISOString,
  gameContextSchema,
  mediaSchema,
  moderationSchema,
  normalizeCount,
  normalizeShareDestination,
  nullableObjectIdToString,
  playerSnapshotSchema,
  promotionStateSchema,
  resolveSupportedByCurrentPlayer,
  buildChatRoomRoute,
  buildFriendsRoute,
  buildProfileRoute,
  buildTableRoute,
  serializeGameContext,
  serializePlayerSnapshot,
  serializeTableContext,
  tableContextSchema,
};
