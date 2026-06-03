const mongoose = require("mongoose");
const {
  POST_STATUSES,
  POST_VISIBILITIES,
  countersSchema,
  gameContextSchema,
  mediaSchema,
  moderationSchema,
  playerSnapshotSchema,
  promotionStateSchema,
  resolveSupportedByCurrentPlayer,
  serializeGameContext,
  serializePlayerSnapshot,
  serializeTableContext,
  tableContextSchema,
} = require("./feedShared");

const feedPostSchema = new mongoose.Schema(
  {
    authorSnapshot: {
      type: playerSnapshotSchema,
      required: true,
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    counters: {
      type: countersSchema,
      default: () => ({}),
    },
    gameContext: {
      type: gameContextSchema,
      default: null,
    },
    isPromoted: {
      type: Boolean,
      default: false,
      index: true,
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    moderation: {
      type: moderationSchema,
      default: () => ({}),
    },
    promotion: {
      type: promotionStateSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: POST_STATUSES,
      default: "published",
      index: true,
    },
    tableCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      index: true,
    },
    tableContext: {
      type: tableContextSchema,
      default: null,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      default: null,
      index: true,
    },
    visibility: {
      type: String,
      enum: POST_VISIBILITIES,
      default: "public",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

feedPostSchema.pre("validate", function syncTableCode(next) {
  if (!this.tableCode && this.tableContext?.tableCode) {
    this.tableCode = this.tableContext.tableCode;
  }

  if (this.tableCode && this.tableContext && !this.tableContext.tableCode) {
    this.tableContext.tableCode = this.tableCode;
  }

  if (this.promotion?.state === "active") {
    this.isPromoted = true;
    this.promotion.isPromoted = true;
  } else if (this.promotion?.isPromoted !== undefined) {
    this.isPromoted = Boolean(this.promotion.isPromoted);
  } else if (this.isPromoted && this.promotion) {
    this.promotion.isPromoted = true;
  }

  next();
});


feedPostSchema.index({ createdAt: -1, _id: -1 });
feedPostSchema.index({ authorUserId: 1, createdAt: -1 });
feedPostSchema.index({ isPromoted: 1, createdAt: -1 });
feedPostSchema.index({ tableId: 1, createdAt: -1 });
feedPostSchema.index({ tableCode: 1, createdAt: -1 });
feedPostSchema.index({ visibility: 1, status: 1, "moderation.status": 1, createdAt: -1 });

feedPostSchema.methods.toClient = function toClient(options = {}) {
  const counters = this.counters || {};
  const tableContext = serializeTableContext(this);
  const gameContext = serializeGameContext(this);
  const supportedByCurrentPlayer = resolveSupportedByCurrentPlayer(this, options.currentUserId);

  return {
    commentCount: counters.commentCount || 0,
    content: this.body,
    ...(gameContext ? { gameContext } : {}),
    ...(counters.giftClipsCount ? { giftClipsCount: counters.giftClipsCount } : {}),
    ...(counters.giftClipsTotal ? { giftClipsTotal: counters.giftClipsTotal } : {}),
    id: String(this._id),
    isPromoted: Boolean(this.isPromoted),
    isTableRelated: Boolean(this.tableId || this.tableCode || tableContext),
    player: serializePlayerSnapshot(this),
    ...(counters.promotedCount ? { promotedCount: counters.promotedCount } : {}),
    shareCount: counters.shareCount || 0,
    ...(supportedByCurrentPlayer === undefined ? {} : { supportedByCurrentPlayer }),
    supportersCount: counters.supportersCount || 0,
    ...(tableContext ? { tableContext } : {}),
    timestamp: this.createdAt instanceof Date ? this.createdAt.toISOString() : new Date().toISOString(),
  };
};

module.exports = mongoose.model("FeedPost", feedPostSchema);
module.exports.POST_STATUSES = POST_STATUSES;
module.exports.POST_VISIBILITIES = POST_VISIBILITIES;
