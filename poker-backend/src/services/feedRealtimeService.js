const mongoose = require("mongoose");

const FeedComment = require("../models/FeedComment");
const FeedPost = require("../models/FeedPost");
const FeedReaction = require("../models/FeedReaction");
const FeedShare = require("../models/FeedShare");
const { sendFeedGiftClip } = require("./feedGiftClipService");
const {
  createFeedCommentNotification,
  createFeedGiftClipNotification,
  createFeedShareNotification,
  createFeedSupportNotification,
  createFeedTableInviteNotifications,
  emitFeedNotificationRecords,
} = require("./feedNotificationService");
const {
  buildFeedTableInviteEventPayload,
  createFeedTableInvite,
  emitFeedTableInviteRecipientEvents,
} = require("./feedTableInviteService");
const {
  PLAYER_STATUSES,
  POST_VISIBILITIES,
  SHARE_DESTINATIONS,
  normalizeShareDestination,
} = require("../models/feedShared");

const FEED_GLOBAL_ROOM = "feed:global";
const FEED_POST_PREFIX = "feed:post";
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
    this.onTableInvitesUpdated = options.onTableInvitesUpdated;
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

  broadcastPostDeleted(postId, payload) {
    return this.emitToFeedAndPost(postId, "feed:post:deleted", payload);
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

  emitNotificationRecords(notificationRecords = []) {
    return emitFeedNotificationRecords(this.io, notificationRecords);
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
      postKind: payload.postKind === "table-invite" ? "table-invite" : "standard",
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
    const notificationRecords = await createFeedCommentNotification({
      actor: user,
      data: { commentId: String(result.comment._id), commentPreview: body.slice(0, 160) },
      post: result.post,
    });
    this.emitNotificationRecords(notificationRecords);
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
    if (changed && nextSupported) {
      const notificationRecords = await createFeedSupportNotification({
        actor: user,
        data: { reactionId: reaction ? String(reaction._id) : null, reactionType: "support" },
        post: updatedPost,
      });
      this.emitNotificationRecords(notificationRecords);
    }
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
    const notificationRecords = await createFeedShareNotification({
      actor: user,
      data: { destination, shareId: String(share._id), targetId: share.targetId || null, targetType: share.targetType || null },
      post: updatedPost,
    });
    this.emitNotificationRecords(notificationRecords);
    this.broadcastShareCreated(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }

  async sendGiftClips(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);

    const result = await sendFeedGiftClip({
      amount: payload.amount || payload.clips,
      currentUserId: user._id,
      message: payload.message,
      postId,
      recipientUserId: payload.recipientUserId,
    });

    await hydrateCurrentUserReaction(result.post, user._id);

    const eventPayload = {
      balances: result.balances,
      giftClip: result.giftClip.toClient(),
      ok: true,
      post: serializePost(result.post, user._id),
      transactionIds: result.transactionIds,
      transactions: result.transactionIds,
    };
    const notificationRecords = await createFeedGiftClipNotification({
      actor: user,
      data: {
        amount: result.giftClip.amount,
        giftClipId: String(result.giftClip._id),
        message: result.giftClip.message || "",
        transactionIds: result.transactionIds,
      },
      post: result.post,
    });
    this.emitNotificationRecords(notificationRecords);
    this.broadcastGiftClipsSent(postId, eventPayload);
    this.broadcastPostUpdated(postId, { ok: true, post: eventPayload.post });
    return eventPayload;
  }


  async createPromotion(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const postId = normalizePostId(payload);
    const { createPromotionCheckout } = require("./feedPromotionService");

    return createPromotionCheckout({
      input: payload,
      postId,
      user,
    });
  }

  async sendTableInvite(socket, payload = {}) {
    const user = await this.authenticate(socket, payload);
    const inviteResult = await createFeedTableInvite({
      sender: user,
      payload,
      onTableInvitesUpdated: this.onTableInvitesUpdated,
    });

    const eventPayload = buildFeedTableInviteEventPayload({
      currentUserId: user._id,
      invites: inviteResult.invites,
      message: inviteResult.message,
      post: inviteResult.post,
      tablePayload: inviteResult.tablePayload,
    });

    const notificationRecords = await createFeedTableInviteNotifications({
      actor: user,
      data: { message: inviteResult.message, source: "feed" },
      inviteRecords: inviteResult.invites,
      post: inviteResult.post,
      recipientUserIds: inviteResult.invites.map((invite) => invite.recipientAccountId),
      table: inviteResult.table,
    });
    this.emitNotificationRecords(notificationRecords);

    const deliveredPlayerIds = emitFeedTableInviteRecipientEvents(this.io, {
      invites: inviteResult.invites,
      post: inviteResult.post,
      sender: user,
      tablePayload: inviteResult.tablePayload,
    });

    const responsePayload = {
      ...eventPayload,
      deliveredPlayerIds,
      invitedPlayerIds: inviteResult.invites.map((invite) => String(invite.recipientAccountId)),
    };

    this.emitToFeedAndPost(String(inviteResult.post._id), "feed:tableInvite:sent", responsePayload);
    this.broadcastPostUpdated(String(inviteResult.post._id), { ok: true, post: responsePayload.post });
    return responsePayload;
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
