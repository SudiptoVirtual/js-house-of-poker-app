const mongoose = require("mongoose");
const {
  POST_STATUSES,
  POST_KINDS,
  POST_VISIBILITIES,
  countersSchema,
  gameContextSchema,
  mediaSchema,
  moderationSchema,
  playerSnapshotSchema,
  promotionStateSchema,
  resolveSupportedByCurrentPlayer,
  serializeGameContext,
  buildChatRoomRoute,
  buildFriendsRoute,
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
      default: "",
      trim: true,
      maxlength: 5000,
    },
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      default: null,
      index: true,
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
    postKind: {
      type: String,
      enum: POST_KINDS,
      default: "standard",
      index: true,
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
feedPostSchema.index(
  { authorUserId: 1, "gameContext.handId": 1 },
  { unique: true, partialFilterExpression: { postKind: "share-win", "gameContext.handId": { $type: "string" } } },
);
feedPostSchema.index({ isPromoted: 1, createdAt: -1 });
feedPostSchema.index({ isPromoted: -1, "promotion.startsAt": -1, createdAt: -1, _id: -1 });
feedPostSchema.index({ chatRoomId: 1, createdAt: -1 });
feedPostSchema.index({ tableId: 1, createdAt: -1 });
feedPostSchema.index({ tableCode: 1, createdAt: -1 });
feedPostSchema.index({ visibility: 1, status: 1, "moderation.status": 1, createdAt: -1 });

feedPostSchema.methods.toClient = function toClient(options = {}) {
  const counters = this.counters || {};
  const tableContext = serializeTableContext(this);
  const gameContext = serializeGameContext(this);
  const supportedByCurrentPlayer = resolveSupportedByCurrentPlayer(this, options.currentUserId);
  const reactionCounts = counters.reactionCounts instanceof Map
    ? Object.fromEntries(counters.reactionCounts)
    : counters.reactionCounts || {};

  return {
    commentCount: counters.commentCount || 0,
    content: this.body,
    ...(gameContext ? { gameContext } : {}),
    ...(counters.giftClipsCount ? { giftClipsCount: counters.giftClipsCount } : {}),
    ...(counters.giftClipsTotal ? { giftClipsTotal: counters.giftClipsTotal } : {}),
    id: String(this._id),
    isPromoted: Boolean(this.isPromoted),
    postKind: this.postKind || "standard",
    media: (this.media || []).map((item) => ({
      altText: item.altText || "",
      durationMs: item.durationMs ?? null,
      height: item.height ?? null,
      metadata: item.metadata || {},
      mimeType: item.mimeType || "",
      thumbnailUrl: item.thumbnailUrl || "",
      type: item.type,
      url: item.url,
      width: item.width ?? null,
    })),
    actorProfileLink: serializePlayerSnapshot(this).actorProfileLink,
    friendStatus: options.friendStatus || {
      action: "view-friends",
      available: Boolean(options.currentUserId) && String(options.currentUserId) !== String(this.authorUserId),
      isFriend: false,
      route: buildFriendsRoute(this.authorUserId, "view-friends"),
    },
    ...(this.chatRoomId ? {
      chatRoomContext: {
        id: String(this.chatRoomId),
        route: buildChatRoomRoute(this.chatRoomId),
      },
    } : {}),
    isTableRelated: Boolean(this.tableId || this.tableCode || tableContext),
    player: serializePlayerSnapshot(this),
    ...(this.promotion?.promotionId && this.promotion?.state && this.promotion.state !== "none"
      ? {
          promotion: {
            amount: this.promotion.amount || this.promotion.budgetClips || 0,
            budgetClips: this.promotion.budgetClips || 0,
            durationDays: this.promotion.durationDays || 0,
            endsAt: this.promotion.endsAt instanceof Date ? this.promotion.endsAt.toISOString() : null,
            id: this.promotion.promotionId ? String(this.promotion.promotionId) : null,
            paymentStatus: this.promotion.paymentStatus || null,
            startsAt: this.promotion.startsAt instanceof Date ? this.promotion.startsAt.toISOString() : null,
            state: this.promotion.state,
          },
        }
      : {}),
    ...(counters.promotedCount ? { promotedCount: counters.promotedCount } : {}),
    reactionCounts: { support: counters.supportersCount || 0, ...reactionCounts },
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
