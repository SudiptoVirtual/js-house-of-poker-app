const mongoose = require("mongoose");

const FeedComment = require("../models/FeedComment");
const FeedGiftClip = require("../models/FeedGiftClip");
const FeedPost = require("../models/FeedPost");
const FeedPromotion = require("../models/FeedPromotion");
const FeedReaction = require("../models/FeedReaction");
const FeedShare = require("../models/FeedShare");
const GameTable = require("../models/GameTable");
const User = require("../models/User");
const {
  PLAYER_STATUSES,
  POST_VISIBILITIES,
  SHARE_DESTINATIONS,
  normalizeShareDestination,
} = require("../models/feedShared");

const FEED_GLOBAL_ROOM = "feed:global";
const FEED_POST_PREFIX = "feed:post";
const MAX_INVITE_RECIPIENTS = 10;
let latestFeedRealtimeService = null;

function getFeedPostRoom(postId) {
  return `${FEED_POST_PREFIX}:${postId}`;
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeShareMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const metadata = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 25)) {
    const normalizedKey = normalizeText(key, 80);
    if (!normalizedKey) continue;

    if (["string", "number", "boolean"].includes(typeof rawValue) || rawValue == null) {
      metadata[normalizedKey] = rawValue;
    }
  }

  return metadata;
}

function buildShareInput(payload = {}, destination) {
  return {
    channel: destination,
    destination,
    metadata: normalizeShareMetadata(payload.metadata),
    targetId: normalizeText(payload.targetId || payload.targetIdentifier || payload.roomId || payload.tableId || payload.targetUserId, 120),
    targetIdentifiers: {
      roomId: normalizeText(payload.roomId || payload.targetRoomId, 120),
      tableId: normalizeText(payload.tableId || payload.tableCode || payload.targetTableId, 120),
      userId: normalizeText(payload.targetUserId || payload.profileUserId, 120),
    },
    targetType: normalizeText(payload.targetType, 80),
  };
}

async function findExistingShare({ destination, postId, targetId, userId }) {
  return FeedShare.findOne({ destination, postId, targetId, userId }).select("_id");
}

async function findRecentShare({ destination, postId, userId }) {
  const rateLimitWindowStart = new Date(Date.now() - 30 * 1000);

  return FeedShare.findOne({
    createdAt: { $gte: rateLimitWindowStart },
    destination,
    postId,
    userId,
  })
    .sort({ createdAt: -1 })
    .select("_id createdAt");
}

function normalizePostId(payload = {}) {
  return normalizeText(payload.postId || payload.feedPostId || payload.id, 80);
}

function normalizeTableContext(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const tableName = normalizeText(value.tableName, 120);
  const gameLabel = normalizeText(value.gameLabel, 120);
  const tableCode = normalizeText(value.tableCode, 32).toUpperCase();
  const seatsOpen = Number.isFinite(value.seatsOpen) ? Math.max(0, value.seatsOpen) : null;

  if (!tableName && !gameLabel && !tableCode && seatsOpen == null) {
    return null;
  }

  return {
    gameLabel,
    seatsOpen,
    tableCode,
    tableName,
  };
}

function normalizeGameContext(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const headline = normalizeText(value.headline, 160);

  if (!headline) {
    return null;
  }

  return {
    headline,
    resultLabel: normalizeText(value.resultLabel, 120),
    stakesLabel: normalizeText(value.stakesLabel, 120),
    tableName: normalizeText(value.tableName, 120),
  };
}

function normalizeMedia(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 10)
    .map((item) => ({
      altText: normalizeText(item?.altText, 500),
      durationMs: Number.isFinite(item?.durationMs) ? Math.max(0, item.durationMs) : null,
      height: Number.isFinite(item?.height) ? Math.max(0, item.height) : null,
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
      mimeType: normalizeText(item?.mimeType, 120),
      thumbnailUrl: normalizeText(item?.thumbnailUrl, 1000),
      type: normalizeText(item?.type, 20),
      url: normalizeText(item?.url, 1000),
      width: Number.isFinite(item?.width) ? Math.max(0, item.width) : null,
    }))
    .filter((item) => item.type && item.url);
}

function getDisplayName(user) {
  return user?.name || user?.email || "Player";
}

function getHandle(user) {
  const handle = user?.handle || user?.username || user?.email?.split("@")[0] || getDisplayName(user);
  return String(handle || "player").startsWith("@") ? String(handle) : `@${handle}`;
}

function buildPlayerSnapshot(user) {
  let status = "Away";

  if (user?.isOnline) {
    status = "Online";
  }

  if (!PLAYER_STATUSES.includes(status)) {
    status = "Away";
  }

  return {
    avatarUrl: user?.avatar || "",
    handle: getHandle(user),
    name: getDisplayName(user),
    status,
    statusTier: user?.playerStatus?.tier || null,
  };
}

async function hydrateCurrentUserReaction(post, currentUserId, session = null) {
  if (!post || !currentUserId) {
    return post;
  }

  const reaction = await FeedReaction.findOne({
    deletedAt: null,
    postId: post._id,
    reactionType: "support",
    userId: currentUserId,
  })
    .session(session)
    .select("_id");

  post.supportedByCurrentPlayer = Boolean(reaction);
  return post;
}

function serializePost(post, currentUserId) {
  return post.toClient({ currentUserId });
}

function serializeComment(comment, currentUserId = null) {
  const moderationStatus = comment?.moderation?.status || "accepted";
  const isAuthor = currentUserId && String(comment.authorUserId) === String(currentUserId);

  return comment.toClient({
    includeBody: moderationStatus !== "blocked" && (!comment.deletedAt || isAuthor),
  });
}

async function findVisiblePost(postId, currentUserId = null, session = null) {
  if (!isValidObjectId(postId)) {
    return null;
  }

  const query = {
    _id: postId,
    "moderation.status": { $ne: "blocked" },
    status: "published",
  };

  if (currentUserId) {
    query.$or = [{ visibility: { $in: ["public", "unlisted"] } }, { authorUserId: currentUserId }];
  } else {
    query.visibility = "public";
  }

  const post = await FeedPost.findOne(query).session(session);
  return hydrateCurrentUserReaction(post, currentUserId, session);
}

async function runCommentTransaction(callback) {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function emitAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

class FeedRealtimeService {
  constructor(io, options = {}) {
    this.io = io;
    this.authenticateSocketUser = options.authenticateSocketUser;
  }

  async authenticate(socket, payload = {}) {
    if (typeof this.authenticateSocketUser !== "function") {
      throw new Error("Feed realtime authentication is not configured.");
    }

    return this.authenticateSocketUser(socket, payload);
  }

  emitToFeed(eventName, payload) {
    this.io.to(FEED_GLOBAL_ROOM).emit(eventName, payload);
    return payload;
  }

  emitToPost(postId, eventName, payload) {
    this.io.to(getFeedPostRoom(postId)).emit(eventName, payload);
    return payload;
  }

  broadcastPostCreated(payload) {
    return this.emitToFeed("feed:post:created", payload);
  }

  emitToFeedAndPost(postId, eventName, payload) {
    this.io.to([FEED_GLOBAL_ROOM, getFeedPostRoom(postId)]).emit(eventName, payload);
    return payload;
  }

  broadcastPostUpdated(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:post:updated", payload);
  }

  broadcastCommentCreated(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:comment:created", payload);
  }

  broadcastSupportUpdated(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:support:updated", payload);
  }

  broadcastShareCreated(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:share:created", payload);
  }

  broadcastGiftClipsSent(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:giftClips:sent", payload);
  }

  broadcastPromotionUpdated(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:promotion:updated", payload);
  }

  async join(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const joinedRooms = new Set(socket.data.feedRoomIds || []);

    socket.join(FEED_GLOBAL_ROOM);
    joinedRooms.add(FEED_GLOBAL_ROOM);

    if (postId) {
      const post = await findVisiblePost(postId, user._id);
      if (!post) {
        throw new Error("Feed post not found.");
      }

      const postRoom = getFeedPostRoom(postId);
      socket.join(postRoom);
      joinedRooms.add(postRoom);
    }

    socket.data.feedRoomIds = [...joinedRooms];

    const response = {
      ok: true,
      playerId: String(user._id),
      postId: postId || null,
      roomIds: socket.data.feedRoomIds,
    };
    socket.emit("feed:joined", response);
    return response;
  }

  async leave(socket, payload = {}) {
    const postId = normalizePostId(payload);
    const joinedRooms = new Set(socket.data.feedRoomIds || []);

    if (postId) {
      const postRoom = getFeedPostRoom(postId);
      socket.leave(postRoom);
      joinedRooms.delete(postRoom);
    } else {
      joinedRooms.forEach((roomId) => socket.leave(roomId));
      joinedRooms.clear();
    }

    socket.data.feedRoomIds = [...joinedRooms];

    const response = {
      ok: true,
      postId: postId || null,
      roomIds: socket.data.feedRoomIds,
    };
    socket.emit("feed:left", response);
    return response;
  }

  leaveAll(socket) {
    (socket.data.feedRoomIds || []).forEach((roomId) => socket.leave(roomId));
    socket.data.feedRoomIds = [];
  }

  async createPost(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const content = normalizeText(payload.content || payload.body, 5000);

    if (!content) {
      throw new Error("Post content is required.");
    }

    const tableContext = normalizeTableContext(payload.tableContext);
    const gameContext = normalizeGameContext(payload.gameContext);
    const visibility = POST_VISIBILITIES.includes(payload.visibility) ? payload.visibility : "public";
    const tableId = isValidObjectId(payload.tableId) ? payload.tableId : null;
    const post = await FeedPost.create({
      authorSnapshot: buildPlayerSnapshot(user),
      authorUserId: user._id,
      body: content,
      gameContext,
      media: normalizeMedia(payload.media),
      tableCode: normalizeText(payload.tableCode || tableContext?.tableCode, 32).toUpperCase(),
      tableContext,
      tableId,
      visibility,
    });
    const eventPayload = { ok: true, post: serializePost(post, user._id) };

    this.broadcastPostCreated(eventPayload);
    socket.join(getFeedPostRoom(String(post._id)));
    socket.data.feedRoomIds = Array.from(new Set([...(socket.data.feedRoomIds || []), getFeedPostRoom(String(post._id))]));
    return eventPayload;
  }

  async createComment(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const body = normalizeText(payload.comment || payload.body || payload.content, 2000);

    if (!body) {
      throw new Error("Comment body is required.");
    }

    const parentCommentId = payload.parentCommentId && isValidObjectId(payload.parentCommentId)
      ? payload.parentCommentId
      : null;
    const result = await runCommentTransaction(async (session) => {
      const post = await findVisiblePost(postId, user._id, session);

      if (!post) {
        return null;
      }

      const [comment] = await FeedComment.create(
        [
          {
            authorSnapshot: buildPlayerSnapshot(user),
            authorUserId: user._id,
            body,
            parentCommentId,
            postId,
          },
        ],
        { session },
      );

      const updatedPost = await FeedPost.findOneAndUpdate(
        { _id: post._id },
        { $inc: { "counters.commentCount": 1 } },
        { new: true, session },
      );
      await hydrateCurrentUserReaction(updatedPost, user._id, session);

      return { comment, post: updatedPost };
    });

    if (!result?.post) {
      throw new Error("Feed post not found.");
    }

    const eventPayload = {
      ok: true,
      comment: serializeComment(result.comment, user._id),
      post: serializePost(result.post, user._id),
    };
    this.broadcastCommentCreated(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async toggleSupport(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const requestedSupported = payload.supported;
    const post = await findVisiblePost(postId, user._id);

    if (!post) {
      throw new Error("Feed post not found.");
    }

    const reactionQuery = { postId, reactionType: "support", userId: user._id };
    let reaction = await FeedReaction.findOne(reactionQuery);
    const currentlySupported = Boolean(reaction && !reaction.deletedAt);
    const nextSupported = typeof requestedSupported === "boolean" ? requestedSupported : !currentlySupported;
    let changed = false;

    if (nextSupported && reaction?.deletedAt) {
      reaction = await FeedReaction.findOneAndUpdate(
        { ...reactionQuery, deletedAt: { $ne: null } },
        { $set: { deletedAt: null } },
        { new: true },
      );
      changed = Boolean(reaction);
    } else if (nextSupported && !reaction) {
      try {
        reaction = await FeedReaction.create({ postId, reactionType: "support", userId: user._id });
        changed = true;
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        reaction = await FeedReaction.findOne(reactionQuery);
      }
    } else if (!nextSupported && reaction && !reaction.deletedAt) {
      reaction = await FeedReaction.findOneAndUpdate(
        { ...reactionQuery, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true },
      );
      changed = Boolean(reaction);
    }

    const updatedPost = changed
      ? await FeedPost.findOneAndUpdate(
          { _id: post._id },
          {
            $inc: {
              "counters.reactionCounts.support": nextSupported ? 1 : -1,
              "counters.supportersCount": nextSupported ? 1 : -1,
            },
          },
          { new: true },
        )
      : post;

    if (updatedPost.counters?.supportersCount < 0) {
      updatedPost.counters.supportersCount = 0;
      updatedPost.counters.reactionCounts = updatedPost.counters.reactionCounts || {};
      updatedPost.counters.reactionCounts.set?.("support", 0);
      await updatedPost.save();
    }

    updatedPost.supportedByCurrentPlayer = nextSupported;

    const clientPost = serializePost(updatedPost, user._id);
    const eventPayload = {
      ok: true,
      post: clientPost,
      reaction: reaction ? reaction.toClient() : null,
      reactionCounts: clientPost.reactionCounts || {},
      summaries: [
        {
          count: clientPost.supportersCount,
          reactionType: "support",
          type: "support",
        },
      ],
      supported: nextSupported,
      supportedByCurrentPlayer: clientPost.supportedByCurrentPlayer,
      supportersCount: clientPost.supportersCount,
      userId: String(user._id),
    };
    this.broadcastSupportUpdated(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async createShare(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const destination = normalizeShareDestination(payload.destination || payload.destinationId || payload.channel);

    if (!SHARE_DESTINATIONS.includes(destination)) {
      throw new Error("Invalid share destination.");
    }

    const post = await findVisiblePost(postId, user._id);
    if (!post) {
      throw new Error("Feed post not found.");
    }

    const shareInput = buildShareInput(payload, destination);
    const existingShare = await findExistingShare({
      destination,
      postId,
      targetId: shareInput.targetId,
      userId: user._id,
    });
    if (existingShare) {
      throw new Error("This post has already been shared to that destination.");
    }

    const recentShare = await findRecentShare({ destination, postId, userId: user._id });
    if (recentShare) {
      throw new Error("Please wait before sharing this post to that destination again.");
    }

    let share;
    try {
      share = await FeedShare.create({ ...shareInput, postId, userId: user._id });
    } catch (error) {
      if (error?.code === 11000) {
        throw new Error("This post has already been shared to that destination.");
      }

      throw error;
    }

    const updatedPost = await FeedPost.findByIdAndUpdate(
      post._id,
      { $inc: { "counters.shareCount": 1 } },
      { new: true }
    );
    if (!updatedPost) {
      throw new Error("Feed post not found.");
    }

    await hydrateCurrentUserReaction(updatedPost, user._id);

    const eventPayload = { ok: true, post: serializePost(updatedPost, user._id), share: share.toClient(), userId: String(user._id) };
    this.broadcastShareCreated(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async sendGiftClips(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const amount = Math.max(1, Number.parseInt(payload.amount || payload.clips, 10));

    if (!Number.isFinite(amount)) {
      throw new Error("Gift Clip amount is required.");
    }

    const post = await findVisiblePost(postId, user._id);
    if (!post) {
      throw new Error("Feed post not found.");
    }

    const giftClip = await FeedGiftClip.create({
      amount,
      message: normalizeText(payload.message, 500),
      postId,
      recipientUserId: post.authorUserId,
      senderUserId: user._id,
      transactionId: isValidObjectId(payload.transactionId) ? payload.transactionId : null,
    });

    post.counters.giftClipsCount = (post.counters.giftClipsCount || 0) + 1;
    post.counters.giftClipsTotal = (post.counters.giftClipsTotal || 0) + amount;
    await post.save();
    await hydrateCurrentUserReaction(post, user._id);

    const eventPayload = { giftClip: giftClip.toClient(), ok: true, post: serializePost(post, user._id) };
    this.broadcastGiftClipsSent(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async createPromotion(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const budgetClips = Math.max(1, Number.parseInt(payload.budgetClips || payload.amount, 10));

    if (!Number.isFinite(budgetClips)) {
      throw new Error("Promotion budget is required.");
    }

    const post = await findVisiblePost(postId, user._id);
    if (!post) {
      throw new Error("Feed post not found.");
    }

    const now = new Date();
    const startsAt = payload.startsAt ? new Date(payload.startsAt) : now;
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
    const state = payload.state === "pending" ? "pending" : "active";
    const promotion = await FeedPromotion.create({
      budgetClips,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      postId,
      promotedByUserId: user._id,
      startsAt: Number.isNaN(startsAt.getTime()) ? now : startsAt,
      state,
    });

    post.isPromoted = true;
    post.promotion = {
      budgetClips,
      endsAt: promotion.endsAt,
      isPromoted: true,
      promotedByUserId: user._id,
      spentClips: 0,
      startsAt: promotion.startsAt,
      state,
    };
    post.counters.promotedCount = (post.counters.promotedCount || 0) + 1;
    await post.save();
    await hydrateCurrentUserReaction(post, user._id);

    const eventPayload = {
      ok: true,
      post: serializePost(post, user._id),
      promotion: promotion.toClient(),
    };
    this.broadcastPromotionUpdated(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async sendTableInvite(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const post = await findVisiblePost(postId, user._id);

    if (!post) {
      throw new Error("Feed post not found.");
    }

    const tableId = normalizeText(payload.tableId || payload.tableCode || post.tableCode, 80);
    if (!tableId) {
      throw new Error("Table id or code is required.");
    }

    const identifiers = [{ tableCode: tableId.toUpperCase() }];
    if (isValidObjectId(tableId)) {
      identifiers.push({ _id: tableId });
    }

    const table = await GameTable.findOne({ $or: identifiers });
    if (!table) {
      throw new Error("Table not found.");
    }

    const recipientIds = [
      payload.recipientUserId,
      ...(Array.isArray(payload.recipientUserIds) ? payload.recipientUserIds : []),
      post.authorUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter(isValidObjectId);
    const uniqueRecipientIds = [...new Set(recipientIds)]
      .filter((id) => id !== String(user._id))
      .slice(0, MAX_INVITE_RECIPIENTS);

    if (uniqueRecipientIds.length === 0) {
      throw new Error("At least one recipient is required.");
    }

    const senderId = String(user._id);
    const tablePlayerIds = new Set((table.players || []).map((player) => String(player.userId)));
    const hasTableAccess =
      String(table.createdByUserId || "") === senderId ||
      String(table.hostUserId || "") === senderId ||
      tablePlayerIds.has(senderId);

    if (!hasTableAccess) {
      throw new Error("You are not allowed to invite players to this table.");
    }

    const recipients = await User.find({
      _id: { $in: uniqueRecipientIds },
      isBlocked: { $ne: true },
      status: { $ne: "blocked" },
    });
    const message = normalizeText(payload.message || `Inviting from feed post ${post.id}`, 500) || null;
    const invites = recipients.map((recipient) => ({
      createdAt: Date.now(),
      giftBuyInChips: 0,
      giftBuyInClips: 0,
      id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      recipientAccountId: String(recipient._id),
      recipientHandle: getHandle(recipient),
      recipientLabel: getDisplayName(recipient),
      senderPlayerId: senderId,
      senderPlayerName: getDisplayName(user),
      source: "share-link",
      status: "pending",
    }));

    table.tableInvites = [...invites, ...(table.tableInvites || [])].slice(0, 50);
    await table.save();

    const eventPayload = {
      invites,
      ok: true,
      post: serializePost(post, user._id),
      table: {
        id: table.tableCode || String(table._id),
        tableCode: table.tableCode || null,
        tableDbId: String(table._id),
        tableId: table.tableCode || String(table._id),
        tableName: table.tableName,
      },
    };

    this.emitToFeedAndPost(postId, "feed:tableInvite:sent", eventPayload);
    return eventPayload;
  }
}

function createFeedRealtimeService(io, options) {
  latestFeedRealtimeService = new FeedRealtimeService(io, options);
  return latestFeedRealtimeService;
}

function getFeedRealtimeService() {
  return latestFeedRealtimeService;
}

module.exports = {
  FEED_GLOBAL_ROOM,
  FeedRealtimeService,
  createFeedRealtimeService,
  emitAck,
  getFeedPostRoom,
  getFeedRealtimeService,
};
