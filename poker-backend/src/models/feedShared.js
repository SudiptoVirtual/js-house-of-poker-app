const mongoose = require("mongoose");

const PLAYER_STATUSES = ["Online", "In Lobby", "In Chat Room", "Playing 357", "At Table", "Away"];
const POST_VISIBILITIES = ["public", "friends", "private", "unlisted"];
const MODERATION_STATUSES = ["accepted", "blocked", "pending-review"];
const POST_STATUSES = ["draft", "published", "archived", "deleted"];
const PROMOTION_STATES = ["none", "pending", "active", "paused", "expired", "rejected"];
const MEDIA_TYPES = ["image", "video", "clip", "link"];
const REACTION_TYPES = ["support"];
const SHARE_DESTINATIONS = ["copy-link", "chat-room", "table", "external"];

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
    budgetClips: {
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
    promotedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
  },
  { _id: false }
);

function serializePlayerSnapshot(document) {
  return {
    ...(document.authorSnapshot?.avatarUrl ? { avatarUrl: document.authorSnapshot.avatarUrl } : {}),
    handle: document.authorSnapshot?.handle || "@player",
    id: String(document.authorUserId),
    name: document.authorSnapshot?.name || "Player",
    status: document.authorSnapshot?.status || "Away",
    ...(document.authorSnapshot?.statusTier ? { statusTier: document.authorSnapshot.statusTier } : {}),
  };
}

function serializeTableContext(document) {
  const source = document.tableContext || {};
  const tableName = source.tableName || "";
  const gameLabel = source.gameLabel || "";

  if (!tableName && !gameLabel && !source.tableCode && source.seatsOpen == null) {
    return undefined;
  }

  return {
    gameLabel,
    ...(source.seatsOpen == null ? {} : { seatsOpen: source.seatsOpen }),
    ...(source.tableCode ? { tableCode: source.tableCode } : {}),
    tableName,
  };
}

function serializeGameContext(document) {
  if (!document.gameContext?.headline) {
    return undefined;
  }

  return {
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
      (reaction) => String(reaction.userId) === userId && reaction.type === "support" && !reaction.deletedAt
    );
  }

  if (document.supportedByCurrentPlayer !== undefined) {
    return Boolean(document.supportedByCurrentPlayer);
  }

  return undefined;
}

module.exports = {
  MEDIA_TYPES,
  MODERATION_STATUSES,
  PLAYER_STATUSES,
  POST_STATUSES,
  POST_VISIBILITIES,
  PROMOTION_STATES,
  REACTION_TYPES,
  SHARE_DESTINATIONS,
  countersSchema,
  dateToISOString,
  gameContextSchema,
  mediaSchema,
  moderationSchema,
  normalizeCount,
  nullableObjectIdToString,
  playerSnapshotSchema,
  promotionStateSchema,
  resolveSupportedByCurrentPlayer,
  serializeGameContext,
  serializePlayerSnapshot,
  serializeTableContext,
  tableContextSchema,
};
