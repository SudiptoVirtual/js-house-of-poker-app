const mongoose = require("mongoose");

const FeedComment = require("../models/FeedComment");
const FeedPost = require("../models/FeedPost");
const FeedReaction = require("../models/FeedReaction");
const FeedShare = require("../models/FeedShare");
const { sendFeedGiftClip } = require("../services/feedGiftClipService");
const { completePromotionPayment, createPromotionCheckout, handlePaymentWebhook } = require("../services/feedPromotionService");
const {
  buildFeedTableInviteEventPayload,
  createFeedTableInvite: createFeedTableInviteRecord,
  emitFeedTableInviteRecipientEvents,
} = require("../services/feedTableInviteService");
const { getFeedRealtimeService } = require("../services/feedRealtimeService");
const {
  createFeedCommentNotification,
  createFeedGiftClipNotification,
  createFeedShareNotification,
  createFeedSupportNotification,
  createFeedTableInviteNotifications,
  emitFeedNotificationRecords,
} = require("../services/feedNotificationService");
const ChatRoom = require("../models/ChatRoom");
const GameTable = require("../models/GameTable");
const User = require("../models/User");
const {
  PLAYER_STATUSES,
  POST_VISIBILITIES,
  REACTION_TYPES,
  SHARE_DESTINATIONS,
  buildChatRoomRoute,
  buildFriendsRoute,
  buildProfileRoute,
  buildTableRoute,
  normalizeShareDestination,
} = require("../models/feedShared");

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 25;
const MAX_COMMENT_LIMIT = 100;


function isChatRoomParticipant(room, userId) {
  if (!room || !userId) {
    return false;
  }

  const currentUserId = String(userId);
  return String(room.createdByUserId || "") === currentUserId || (room.participantStates || []).some((state) => String(state.userId) === currentUserId);
}

function canViewChatRoomContext(room, userId) {
  if (!room || room.isDisabled) {
    return false;
  }

  if (room.isPublic !== false && (room.visibility || "public") !== "private") {
    return true;
  }

  return isChatRoomParticipant(room, userId);
}

function isTablePlayer(table, userId) {
  if (!table || !userId) {
    return false;
  }

  const currentUserId = String(userId);
  return (table.players || []).some((player) => String(player.userId) === currentUserId);
}

function canViewTableContext(table, userId, chatRoom = null) {
  if (!table || table.status === "closed") {
    return false;
  }

  const visibility = String(table.chatRoomLaunchContext?.visibility || "public").toLowerCase();
  const restricted = ["private", "invite-only", "room"].includes(visibility) || Boolean(table.chatRoomLaunchContext?.chatRoomId);

  if (!restricted) {
    return true;
  }

  if (!userId) {
    return false;
  }

  const currentUserId = String(userId);
  return (
    isTablePlayer(table, userId) ||
    String(table.hostUserId || "") === currentUserId ||
    String(table.createdByUserId || "") === currentUserId ||
    String(table.chatRoomLaunchContext?.launchedByUserId || "") === currentUserId ||
    (table.chatRoomLaunchContext?.invitedPlayerIds || []).some((id) => String(id) === currentUserId) ||
    isChatRoomParticipant(chatRoom, userId)
  );
}

function serializeFriendStatus({ authorUserId, currentUser = null }) {
  const targetUserId = String(authorUserId || "");
  const currentUserId = currentUser?._id ? String(currentUser._id) : "";
  const isSelf = Boolean(currentUserId && currentUserId === targetUserId);
  const isFriend = Boolean(
    currentUser && (currentUser.friends || []).some((friendId) => String(friendId) === targetUserId)
  );
  const action = isSelf ? "view-self" : isFriend ? "message-or-invite" : currentUser ? "add-friend" : "sign-in";

  return {
    action,
    available: Boolean(currentUserId) && !isSelf,
    canAddFriend: Boolean(currentUserId) && !isSelf && !isFriend,
    canInviteToTable: Boolean(currentUserId) && !isSelf && isFriend,
    isFriend,
    isSelf,
    route: buildFriendsRoute(targetUserId, action),
    targetUserId,
  };
}

function serializeChatRoomContext(room, currentUserId) {
  if (!room) {
    return null;
  }

  const id = String(room._id);
  return {
    activePlayerCount: room.activePlayerCount || 0,
    id,
    isMember: isChatRoomParticipant(room, currentUserId),
    isPublic: room.isPublic !== false,
    name: room.name,
    route: buildChatRoomRoute(id),
    slug: room.slug,
    topic: room.topic || "",
    visibility: room.visibility || (room.isPublic ? "public" : "private"),
  };
}

function serializeTableDiscoveryContext(table) {
  if (!table) {
    return null;
  }

  const tableCode = table.tableCode || table.chatRoomLaunchContext?.tableCode || "";
  const tableId = String(table._id);
  return {
    activeTableNavigation: buildTableRoute({ tableCode, tableId }),
    gameLabel: table.gameSettings?.game || table.gameType || "poker",
    id: tableId,
    phase: table.phase || null,
    seatsOpen: Math.max(0, (table.maxPlayers || 0) - (table.players?.length || 0)),
    status: table.status,
    tableCode,
    tableId,
    tableName: table.tableName,
  };
}

async function getCurrentUserWithFriends(currentUserId) {
  if (!currentUserId) {
    return null;
  }

  return User.findById(currentUserId).select("friends");
}

async function findRelatedChatRoom(post, explicitRoomId = null) {
  const roomId = explicitRoomId || post.chatRoomId;
  if (roomId && isValidObjectId(roomId)) {
    return ChatRoom.findById(roomId);
  }

  return null;
}

async function findRelatedTable(post) {
  const filters = [];

  if (post.tableId && isValidObjectId(post.tableId)) {
    filters.push({ _id: post.tableId });
  }

  if (post.tableCode) {
    filters.push({ tableCode: String(post.tableCode).trim().toUpperCase() });
  }

  if (!filters.length) {
    return null;
  }

  return GameTable.findOne({ $or: filters }).select("chatRoomLaunchContext createdByUserId gameSettings gameType hostUserId maxPlayers phase players status tableCode tableName updatedAt");
}

function normalizeLimit(value, defaultLimit, maxLimit) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function requireObjectId(value, res, label = "id") {
  if (!isValidObjectId(value)) {
    res.status(400).json({ message: `Invalid ${label}` });
    return null;
  }

  return value;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function encodeCursor(document) {
  if (!document?.createdAt || !document?._id) {
    return null;
  }

  return Buffer.from(`${document.createdAt.toISOString()}|${document._id}`).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const [createdAtValue, id] = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
    const createdAt = new Date(createdAtValue);

    if (Number.isNaN(createdAt.getTime()) || !isValidObjectId(id)) {
      return null;
    }

    return { createdAt, id };
  } catch (error) {
    return null;
  }
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

function buildShareInput(body = {}, destination) {
  return {
    channel: destination,
    destination,
    metadata: normalizeShareMetadata(body.metadata),
    targetId: normalizeText(body.targetId || body.targetIdentifier || body.roomId || body.tableId || body.targetUserId, 120),
    targetIdentifiers: {
      roomId: normalizeText(body.roomId || body.targetRoomId, 120),
      tableId: normalizeText(body.tableId || body.tableCode || body.targetTableId, 120),
      userId: normalizeText(body.targetUserId || body.profileUserId, 120),
    },
    targetType: normalizeText(body.targetType, 80),
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

function broadcastShareCreated(postId, payload) {
  const feedRealtimeService = getFeedRealtimeService();

  if (feedRealtimeService) {
    feedRealtimeService.broadcastShareCreated(postId, { ok: true, ...payload });
    feedRealtimeService.broadcastPostUpdated(postId, { ok: true, post: payload.post });
  }
}

function broadcastGiftClipsSent(postId, payload) {
  const feedRealtimeService = getFeedRealtimeService();

  if (feedRealtimeService) {
    feedRealtimeService.broadcastGiftClipsSent(postId, { ok: true, ...payload });
    feedRealtimeService.broadcastPostUpdated(postId, { ok: true, post: payload.post });
  }
}

function broadcastCommentCreated(postId, payload) {
  const feedRealtimeService = getFeedRealtimeService();

  if (feedRealtimeService) {
    feedRealtimeService.broadcastCommentCreated(postId, { ok: true, ...payload });
    feedRealtimeService.broadcastPostUpdated(postId, { ok: true, post: payload.post });
  }
}

function emitFeedNotifications(notificationRecords) {
  const feedRealtimeService = getFeedRealtimeService();
  return emitFeedNotificationRecords(feedRealtimeService?.io, notificationRecords);
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

async function hydrateCurrentUserReaction(posts, currentUserId, session = null) {
  if (!currentUserId || posts.length === 0) {
    return posts;
  }

  const reactions = await FeedReaction.find({
    deletedAt: null,
    postId: { $in: posts.map((post) => post._id) },
    reactionType: "support",
    userId: currentUserId,
  })
    .session(session)
    .select("postId userId type deletedAt");
  const supportedPostIds = new Set(reactions.map((reaction) => String(reaction.postId)));

  posts.forEach((post) => {
    post.supportedByCurrentPlayer = supportedPostIds.has(String(post._id));
  });

  return posts;
}

function serializePost(post, currentUserId, currentUser = null) {
  return post.toClient({
    currentUserId,
    ...(currentUser ? { friendStatus: serializeFriendStatus({ authorUserId: post.authorUserId, currentUser }) } : {}),
  });
}


function buildReactionSummaryPayload({ post, reaction = null, reactionType = "support", supported, userId }) {
  const clientPost = serializePost(post, userId);
  const reactionCounts = clientPost.reactionCounts || {};
  const summary = {
    count: reactionCounts[reactionType] ?? (reactionType === "support" ? clientPost.supportersCount : 0),
    reactionType,
    type: reactionType,
  };

  return {
    post: clientPost,
    reaction: reaction ? reaction.toClient() : null,
    reactionCounts,
    summaries: [summary],
    supported,
    supportedByCurrentPlayer: clientPost.supportedByCurrentPlayer,
    supportersCount: clientPost.supportersCount,
  };
}

function broadcastSupportUpdated(postId, payload) {
  const feedRealtimeService = getFeedRealtimeService();

  if (feedRealtimeService) {
    feedRealtimeService.broadcastSupportUpdated(postId, { ok: true, ...payload });
    feedRealtimeService.broadcastPostUpdated(postId, { ok: true, post: payload.post });
  }
}

async function updateSupportReaction({ postId, reactionType = "support", requestedSupported, userId }) {
  const reactionQuery = { postId, reactionType, userId };
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
      reaction = await FeedReaction.create({ postId, reactionType, userId });
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

  const post = changed
    ? await FeedPost.findOneAndUpdate(
        { _id: postId },
        {
          $inc: {
            [`counters.reactionCounts.${reactionType}`]: nextSupported ? 1 : -1,
            ...(reactionType === "support" ? { "counters.supportersCount": nextSupported ? 1 : -1 } : {}),
          },
        },
        { new: true },
      )
    : await FeedPost.findById(postId);

  if (post && post.counters?.supportersCount < 0) {
    post.counters.supportersCount = 0;
    post.counters.reactionCounts = post.counters.reactionCounts || {};
    post.counters.reactionCounts.set?.(reactionType, 0);
    await post.save();
  }

  post.supportedByCurrentPlayer = nextSupported;

  return { changed, post, reaction, supported: nextSupported };
}

function serializeComment(comment, currentUserId = null) {
  const moderationStatus = comment?.moderation?.status || "accepted";
  const isAuthor = currentUserId && String(comment.authorUserId) === String(currentUserId);

  return comment.toClient({
    includeBody: moderationStatus !== "blocked" && (!comment.deletedAt || isAuthor),
  });
}

async function runCommentTransaction(callback, fallback) {
  const session = await mongoose.startSession();
  let transactionStarted = false;

  try {
    session.startTransaction();
    transactionStarted = true;

    // Deliberately invoke the callback once. Mongoose's withTransaction helper may
    // retry callbacks after transient errors, which is unsafe once fallback writes
    // are possible.
    const result = await callback(session);
    await session.commitTransaction();
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      await session.abortTransaction().catch(() => {});
    }

    if (!isTransactionUnsupportedError(error) || typeof fallback !== "function") {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  return fallback();
}

function isTransactionUnsupportedError(error) {
  const message = String(error?.message || "");

  // Match deployment-capability errors only. Other transaction failures must be
  // surfaced rather than replayed through the non-transactional path.
  return (
    /transaction numbers are only allowed on a replica set member or mongos/i.test(message) ||
    /transactions? (?:are|is) not supported (?:by|on|for|in) (?:(?:this|the|your|a) )?(?:deployment|topology|server|standalone)/i.test(message) ||
    /this mongodb deployment does not support transactions/i.test(message)
  );
}

async function createComment({ body, parentCommentId, postId, user }, session = null) {
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
    session ? { session } : undefined,
  );

  return comment;
}

async function incrementPostCommentCount(postId, session = null) {
  return FeedPost.findOneAndUpdate(
    { _id: postId },
    { $inc: { "counters.commentCount": 1 } },
    { new: true, ...(session ? { session } : {}) },
  );
}

async function reconcilePostCommentCount(postId) {
  const commentCount = await FeedComment.countDocuments({ deletedAt: null, postId });
  return FeedPost.findOneAndUpdate(
    { _id: postId },
    { $set: { "counters.commentCount": commentCount } },
    { new: true },
  );
}

async function createCommentWithoutTransaction({ body, currentUserId, parentCommentId, postId, user }) {
  const post = await findVisiblePost(postId, currentUserId);
  if (!post) {
    return null;
  }

  const comment = await createComment({ body, parentCommentId, postId, user });
  let updatedPost;

  try {
    updatedPost = await incrementPostCommentCount(post._id);
    if (!updatedPost) {
      await FeedComment.deleteOne({ _id: comment._id });
      return null;
    }
  } catch (error) {
    try {
      await FeedComment.deleteOne({ _id: comment._id });
    } catch (compensationError) {
      await reconcilePostCommentCount(post._id).catch(() => {});
    }
    throw error;
  }

  if (currentUserId) {
    await hydrateCurrentUserReaction([updatedPost], currentUserId);
  }

  return { comment, post: updatedPost };
}

async function createCommentAndIncrementPost({ body, currentUserId, parentCommentId = null, postId, user }) {
  const options = { body, currentUserId, parentCommentId, postId, user };

  return runCommentTransaction(async (session) => {
    const post = await findVisiblePost(postId, currentUserId, session);

    if (!post) {
      return null;
    }

    const comment = await createComment({ body, parentCommentId, postId, user }, session);
    const updatedPost = await incrementPostCommentCount(post._id, session);

    if (updatedPost && currentUserId) {
      await hydrateCurrentUserReaction([updatedPost], currentUserId, session);
    }

    return { comment, post: updatedPost };
  }, () => createCommentWithoutTransaction(options));
}

async function decrementPostCommentCount(postId, session = null) {
  return FeedPost.findOneAndUpdate(
    { _id: postId },
    [
      {
        $set: {
          "counters.commentCount": {
            $max: [0, { $subtract: [{ $ifNull: ["$counters.commentCount", 0] }, 1] }],
          },
        },
      },
    ],
    { new: true, ...(session ? { session } : {}) },
  );
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
  if (post && currentUserId) {
    await hydrateCurrentUserReaction([post], currentUserId, session);
  }

  return post;
}

function sendServerError(res, error, fallbackMessage = "Feed request failed") {
  console.error(fallbackMessage, error);

  if (error?.statusCode) {
    return res.status(error.statusCode).json({ code: error.code, message: error.message });
  }

  return res.status(500).json({ message: fallbackMessage });
}

async function createPost(req, res) {
  try {
    const content = normalizeText(req.body?.content || req.body?.body, 5000);

    if (!content) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const visibility = POST_VISIBILITIES.includes(req.body?.visibility) ? req.body.visibility : "public";
    const tableContext = normalizeTableContext(req.body?.tableContext);
    const gameContext = normalizeGameContext(req.body?.gameContext);
    const tableId = isValidObjectId(req.body?.tableId) ? req.body.tableId : null;

    const post = await FeedPost.create({
      authorSnapshot: buildPlayerSnapshot(req.user),
      authorUserId: req.user._id,
      body: content,
      gameContext,
      media: normalizeMedia(req.body?.media),
      tableCode: normalizeText(req.body?.tableCode || tableContext?.tableCode, 32).toUpperCase(),
      tableContext,
      tableId,
      visibility,
    });

    return res.status(201).json({ post: serializePost(post, req.user._id) });
  } catch (error) {
    return sendServerError(res, error, "Unable to create feed post");
  }
}

async function listPosts(req, res) {
  try {
    const limit = normalizeLimit(req.query.limit, DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const cursor = decodeCursor(req.query.cursor);
    const currentUserId = req.user?._id || null;
    const query = {
      "moderation.status": { $ne: "blocked" },
      status: "published",
    };

    if (currentUserId) {
      query.$or = [{ visibility: "public" }, { authorUserId: currentUserId }];
    } else {
      query.visibility = "public";
    }

    if (req.query.authorUserId && isValidObjectId(req.query.authorUserId)) {
      query.authorUserId = req.query.authorUserId;
    }

    if (req.query.tableCode) {
      query.tableCode = String(req.query.tableCode).trim().toUpperCase();
    }

    if (cursor) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const posts = await FeedPost.find(query)
      .sort({ isPromoted: -1, "promotion.startsAt": -1, createdAt: -1, _id: -1 })
      .limit(limit + 1);
    const page = posts.slice(0, limit);
    await hydrateCurrentUserReaction(page, currentUserId);
    const currentUser = await getCurrentUserWithFriends(currentUserId);

    return res.json({
      pagination: {
        hasMore: posts.length > limit,
        limit,
        nextCursor: posts.length > limit ? encodeCursor(page[page.length - 1]) : null,
      },
      posts: page.map((post) => serializePost(post, currentUserId, currentUser)),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to list feed posts");
  }
}

async function getPost(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);

    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const currentUser = await getCurrentUserWithFriends(currentUserId);

    return res.json({ post: serializePost(post, currentUserId, currentUser) });
  } catch (error) {
    return sendServerError(res, error, "Unable to read feed post");
  }
}

async function updatePost(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const post = await FeedPost.findOne({ _id: postId, status: { $ne: "deleted" } });
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    if (String(post.authorUserId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own feed posts" });
    }

    if (req.body?.content !== undefined || req.body?.body !== undefined) {
      const content = normalizeText(req.body.content || req.body.body, 5000);
      if (!content) {
        return res.status(400).json({ message: "Post content is required" });
      }
      post.body = content;
    }

    if (req.body?.visibility !== undefined) {
      if (!POST_VISIBILITIES.includes(req.body.visibility)) {
        return res.status(400).json({ message: "Invalid post visibility" });
      }
      post.visibility = req.body.visibility;
    }

    if (req.body?.tableContext !== undefined) {
      post.tableContext = normalizeTableContext(req.body.tableContext);
    }

    if (req.body?.gameContext !== undefined) {
      post.gameContext = normalizeGameContext(req.body.gameContext);
    }

    if (req.body?.media !== undefined) {
      post.media = normalizeMedia(req.body.media);
    }

    await post.save();
    await hydrateCurrentUserReaction([post], req.user._id);

    return res.json({ post: serializePost(post, req.user._id) });
  } catch (error) {
    return sendServerError(res, error, "Unable to update feed post");
  }
}

async function deletePost(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const post = await FeedPost.findOne({ _id: postId, status: { $ne: "deleted" } });
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    if (String(post.authorUserId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only delete your own feed posts" });
    }

    post.status = "deleted";
    await post.save();

    return res.json({ deleted: true, postId: String(post._id) });
  } catch (error) {
    return sendServerError(res, error, "Unable to delete feed post");
  }
}

async function listComments(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const limit = normalizeLimit(req.query.limit, DEFAULT_COMMENT_LIMIT, MAX_COMMENT_LIMIT);
    const cursor = decodeCursor(req.query.cursor);
    const query = {
      "moderation.status": { $ne: "blocked" },
      deletedAt: null,
      parentCommentId: req.query.parentCommentId && isValidObjectId(req.query.parentCommentId)
        ? req.query.parentCommentId
        : null,
      postId,
    };

    if (cursor) {
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ];
    }

    const comments = await FeedComment.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
    const page = comments.slice(0, limit);

    return res.json({
      comments: page.map((comment) => serializeComment(comment, currentUserId)),
      pagination: {
        hasMore: comments.length > limit,
        limit,
        nextCursor: comments.length > limit ? encodeCursor(page[page.length - 1]) : null,
      },
      post: serializePost(post, currentUserId),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to list feed comments");
  }
}

async function addComment(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const body = normalizeText(req.body?.comment || req.body?.body || req.body?.content, 2000);
    if (!body) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    const parentCommentId = req.body?.parentCommentId && isValidObjectId(req.body.parentCommentId)
      ? req.body.parentCommentId
      : null;

    const result = await createCommentAndIncrementPost({
      body,
      currentUserId: req.user._id,
      parentCommentId,
      postId,
      user: req.user,
    });

    if (!result?.post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const payload = {
      comment: serializeComment(result.comment, req.user._id),
      post: serializePost(result.post, req.user._id),
    };
    const notificationRecords = await createFeedCommentNotification({
      actor: req.user,
      data: { commentId: String(result.comment._id), commentPreview: body.slice(0, 160) },
      post: result.post,
    });
    emitFeedNotifications(notificationRecords);
    broadcastCommentCreated(postId, { ...payload, userId: String(req.user._id) });

    return res.status(201).json(payload);
  } catch (error) {
    return sendServerError(res, error, "Unable to add feed comment");
  }
}

async function updateComment(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const commentId = requireObjectId(req.params.commentId, res, "comment id");
    if (!commentId) return null;

    const body = normalizeText(req.body?.comment || req.body?.body || req.body?.content, 2000);
    if (!body) {
      return res.status(400).json({ message: "Comment body is required" });
    }

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const comment = await FeedComment.findOne({ _id: commentId, deletedAt: null, postId });
    if (!comment || comment.moderation?.status === "blocked") {
      return res.status(404).json({ message: "Feed comment not found" });
    }

    if (String(comment.authorUserId) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only edit your own feed comments" });
    }

    comment.body = body;
    await comment.save();

    return res.json({
      comment: serializeComment(comment, req.user._id),
      post: serializePost(post, req.user._id),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to update feed comment");
  }
}

async function deleteComment(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const commentId = requireObjectId(req.params.commentId, res, "comment id");
    if (!commentId) return null;

    const deleteCommentOperation = async (session = null) => {
      const visiblePost = await findVisiblePost(postId, req.user._id, session);
      if (!visiblePost) {
        return { status: "post_not_found" };
      }

      const commentQuery = FeedComment.findOne({ _id: commentId, deletedAt: null, postId });
      const comment = session ? await commentQuery.session(session) : await commentQuery;

      if (!comment || comment.moderation?.status === "blocked") {
        return { status: "not_found" };
      }

      if (String(comment.authorUserId) !== String(req.user._id)) {
        return { status: "forbidden" };
      }

      comment.deletedAt = new Date();
      await comment.save(session ? { session } : undefined);

      let post;
      try {
        post = await decrementPostCommentCount(postId, session);
      } catch (error) {
        if (!session) {
          try {
            comment.deletedAt = null;
            await comment.save();
          } catch (compensationError) {
            await reconcilePostCommentCount(postId).catch(() => {});
          }
        }
        throw error;
      }

      if (post) {
        await hydrateCurrentUserReaction([post], req.user._id, session);
      }

      return { comment, post, status: "deleted" };
    };

    const result = await runCommentTransaction(
      (session) => deleteCommentOperation(session),
      () => deleteCommentOperation(),
    );

    if (result.status === "not_found") {
      return res.status(404).json({ message: "Feed comment not found" });
    }

    if (result.status === "post_not_found") {
      return res.status(404).json({ message: "Feed post not found" });
    }

    if (result.status === "forbidden") {
      return res.status(403).json({ message: "You can only delete your own feed comments" });
    }

    return res.json({
      comment: serializeComment(result.comment, req.user._id),
      deleted: true,
      post: result.post ? serializePost(result.post, req.user._id) : null,
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to delete feed comment");
  }
}

async function setSupport(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const visiblePost = await findVisiblePost(postId, req.user._id);
    if (!visiblePost) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const result = await updateSupportReaction({
      postId,
      reactionType: "support",
      requestedSupported: true,
      userId: req.user._id,
    });
    const payload = buildReactionSummaryPayload(result);
    if (result.changed && result.supported) {
      const notificationRecords = await createFeedSupportNotification({
        actor: req.user,
        data: { reactionId: result.reaction ? String(result.reaction._id) : null, reactionType: "support" },
        post: result.post,
      });
      emitFeedNotifications(notificationRecords);
    }
    broadcastSupportUpdated(postId, { ...payload, userId: String(req.user._id) });

    return res.json(payload);
  } catch (error) {
    return sendServerError(res, error, "Unable to support feed post");
  }
}

async function removeSupport(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const visiblePost = await findVisiblePost(postId, req.user._id);
    if (!visiblePost) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const result = await updateSupportReaction({
      postId,
      reactionType: "support",
      requestedSupported: false,
      userId: req.user._id,
    });
    const payload = buildReactionSummaryPayload(result);
    broadcastSupportUpdated(postId, { ...payload, userId: String(req.user._id) });

    return res.json(payload);
  } catch (error) {
    return sendServerError(res, error, "Unable to remove feed support");
  }
}

async function toggleReaction(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const reactionType = normalizeText(req.body?.reactionType || req.body?.type || req.params.type || "support", 40);
    if (!REACTION_TYPES.includes(reactionType)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    const visiblePost = await findVisiblePost(postId, req.user._id);
    if (!visiblePost) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const result = await updateSupportReaction({
      postId,
      reactionType,
      requestedSupported: typeof req.body?.supported === "boolean" ? req.body.supported : req.body?.active,
      userId: req.user._id,
    });
    const payload = buildReactionSummaryPayload(result);

    if (reactionType === "support") {
      if (result.changed && result.supported) {
        const notificationRecords = await createFeedSupportNotification({
          actor: req.user,
          data: { reactionId: result.reaction ? String(result.reaction._id) : null, reactionType: "support" },
          post: result.post,
        });
        emitFeedNotifications(notificationRecords);
      }
      broadcastSupportUpdated(postId, { ...payload, userId: String(req.user._id) });
    }

    return res.json(payload);
  } catch (error) {
    return sendServerError(res, error, "Unable to toggle feed reaction");
  }
}

async function createReaction(req, res) {
  return toggleReaction(req, res);
}

async function listReactionSummaries(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const clientPost = serializePost(post, currentUserId);
    const reactionCounts = clientPost.reactionCounts || {};
    const summaries = REACTION_TYPES.map((reactionType) => ({
      count: reactionCounts[reactionType] ?? (reactionType === "support" ? clientPost.supportersCount : 0),
      reactionType,
      supportedByCurrentPlayer: reactionType === "support" ? clientPost.supportedByCurrentPlayer : undefined,
      type: reactionType,
    }));

    return res.json({
      post: clientPost,
      reactionCounts,
      summaries,
      supportedByCurrentPlayer: clientPost.supportedByCurrentPlayer,
      supportersCount: clientPost.supportersCount,
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to list feed reaction summaries");
  }
}

async function createShare(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const destination = normalizeShareDestination(req.body?.destination || req.body?.destinationId || req.body?.channel);
    if (!SHARE_DESTINATIONS.includes(destination)) {
      return res.status(400).json({ message: "Invalid share destination" });
    }

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const shareInput = buildShareInput(req.body, destination);
    const existingShare = await findExistingShare({
      destination,
      postId,
      targetId: shareInput.targetId,
      userId: req.user._id,
    });
    if (existingShare) {
      return res.status(409).json({ message: "This post has already been shared to that destination" });
    }

    const recentShare = await findRecentShare({ destination, postId, userId: req.user._id });
    if (recentShare) {
      return res.status(429).json({ message: "Please wait before sharing this post to that destination again" });
    }

    const share = await FeedShare.create({ ...shareInput, postId, userId: req.user._id });
    const updatedPost = await FeedPost.findByIdAndUpdate(
      post._id,
      { $inc: { "counters.shareCount": 1 } },
      { new: true }
    );
    if (!updatedPost) {
      throw new Error("Feed post not found.");
    }

    await hydrateCurrentUserReaction([updatedPost], req.user._id);

    const eventPayload = { post: serializePost(updatedPost, req.user._id), share: share.toClient() };
    const notificationRecords = await createFeedShareNotification({
      actor: req.user,
      data: { destination, shareId: String(share._id), targetId: share.targetId || null, targetType: share.targetType || null },
      post: updatedPost,
    });
    emitFeedNotifications(notificationRecords);
    broadcastShareCreated(postId, { ...eventPayload, userId: String(req.user._id) });

    return res.status(201).json(eventPayload);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This post has already been shared to that destination" });
    }

    return sendServerError(res, error, "Unable to share feed post");
  }
}

async function sendGiftClip(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const result = await sendFeedGiftClip({
      amount: req.body?.amount || req.body?.clips,
      currentUserId: req.user._id,
      message: req.body?.message,
      postId,
      recipientUserId: req.body?.recipientUserId,
    });

    await hydrateCurrentUserReaction([result.post], req.user._id);

    const eventPayload = {
      balances: result.balances,
      giftClip: result.giftClip.toClient(),
      post: serializePost(result.post, req.user._id),
      transactionIds: result.transactionIds,
      transactions: result.transactionIds,
    };
    const notificationRecords = await createFeedGiftClipNotification({
      actor: req.user,
      data: {
        amount: result.giftClip.amount,
        giftClipId: String(result.giftClip._id),
        message: result.giftClip.message || "",
        transactionIds: result.transactionIds,
      },
      post: result.post,
    });
    emitFeedNotifications(notificationRecords);
    broadcastGiftClipsSent(postId, eventPayload);

    return res.status(201).json(eventPayload);
  } catch (error) {
    return sendServerError(res, error, "Unable to send Gift Clips");
  }
}


async function purchasePromotion(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const result = await createPromotionCheckout({
      input: req.body || {},
      postId,
      user: req.user,
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendServerError(res, error, "Unable to create feed promotion checkout");
  }
}

async function completePromotion(req, res) {
  try {
    const promotionId = requireObjectId(req.params.promotionId, res, "promotion id");
    if (!promotionId) return null;

    const result = await completePromotionPayment({
      paymentReference: req.body?.paymentReference || req.body?.referenceId,
      promotionId,
      provider: req.body?.provider || "manual",
    });
    return res.json(result);
  } catch (error) {
    return sendServerError(res, error, "Unable to complete feed promotion payment");
  }
}

async function promotionPaymentWebhook(req, res) {
  try {
    const result = await handlePaymentWebhook(req.verifiedPromotionWebhookPayload || req.body || {});
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendServerError(res, error, "Unable to process feed promotion payment webhook");
  }
}

async function createTableInvite(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const feedRealtimeService = getFeedRealtimeService();
    const inviteResult = await createFeedTableInviteRecord({
      payload: { ...req.body, postId },
      post,
      sender: req.user,
      onTableInvitesUpdated: feedRealtimeService?.onTableInvitesUpdated,
    });
    const eventPayload = buildFeedTableInviteEventPayload({
      currentUserId: req.user._id,
      invites: inviteResult.invites,
      message: inviteResult.message,
      post,
      tablePayload: inviteResult.tablePayload,
    });

    const notificationRecords = await createFeedTableInviteNotifications({
      actor: req.user,
      data: { message: inviteResult.message, source: "feed" },
      inviteRecords: inviteResult.invites,
      post,
      recipientUserIds: inviteResult.invites.map((invite) => invite.recipientAccountId),
      table: inviteResult.table,
    });
    emitFeedNotifications(notificationRecords);

    const deliveredPlayerIds = emitFeedTableInviteRecipientEvents(feedRealtimeService?.io, {
      invites: inviteResult.invites,
      post,
      sender: req.user,
      tablePayload: inviteResult.tablePayload,
    });
    const responsePayload = {
      ...eventPayload,
      deliveredPlayerIds,
      invitedPlayerIds: inviteResult.invites.map((invite) => String(invite.recipientAccountId)),
    };

    if (feedRealtimeService) {
      feedRealtimeService.emitToFeedAndPost(postId, "feed:tableInvite:sent", responsePayload);
      feedRealtimeService.broadcastPostUpdated(postId, { ok: true, post: responsePayload.post });
    }

    return res.status(201).json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create feed table invite";
    const statusCode = /not found/i.test(message)
      ? 404
      : /not allowed/i.test(message)
        ? 403
        : /required|match|linked|eligible|closed|completed/i.test(message)
          ? 400
          : 500;
    return res.status(statusCode).json({ message });
  }
}



async function resolveAuthorProfile(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const [author, currentUser] = await Promise.all([
      User.findById(post.authorUserId).select("avatar email friends isOnline name playerStatus status"),
      getCurrentUserWithFriends(currentUserId),
    ]);
    if (!author || author.status !== "active") {
      return res.status(404).json({ message: "Feed author not found" });
    }

    const authorId = String(author._id);
    return res.json({
      author: {
        avatarUrl: author.avatar || post.authorSnapshot?.avatarUrl || "",
        handle: getHandle(author),
        id: authorId,
        name: getDisplayName(author),
        status: author.isOnline ? "Online" : "Away",
        statusTier: author.playerStatus?.tier || null,
      },
      friendStatus: serializeFriendStatus({ authorUserId: authorId, currentUser }),
      postId: String(post._id),
      route: buildProfileRoute(authorId),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to resolve feed author profile");
  }
}

async function resolveFriendAction(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const currentUser = await getCurrentUserWithFriends(currentUserId);
    return res.json({
      friendStatus: serializeFriendStatus({ authorUserId: post.authorUserId, currentUser }),
      postId: String(post._id),
      route: buildFriendsRoute(post.authorUserId, currentUser ? "add-friend" : "sign-in"),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to resolve feed friend action");
  }
}

async function resolveChatRoomContext(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    let room = await findRelatedChatRoom(post);
    if (!room) {
      const table = await findRelatedTable(post);
      room = table?.chatRoomLaunchContext?.chatRoomId ? await findRelatedChatRoom(post, table.chatRoomLaunchContext.chatRoomId) : null;
    }

    if (!room) {
      return res.status(404).json({ message: "Feed post has no related chat room" });
    }

    if (!canViewChatRoomContext(room, currentUserId)) {
      return res.status(403).json({ message: "You are not authorized to view this chat room context" });
    }

    return res.json({
      chatRoomContext: serializeChatRoomContext(room, currentUserId),
      postId: String(post._id),
      route: buildChatRoomRoute(room._id),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to resolve feed chat room context");
  }
}

async function resolveTableContext(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const currentUserId = req.user?._id || null;
    const post = await findVisiblePost(postId, currentUserId);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const table = await findRelatedTable(post);
    if (!table) {
      return res.status(404).json({ message: "Feed post has no related table" });
    }

    const room = table.chatRoomLaunchContext?.chatRoomId ? await findRelatedChatRoom(post, table.chatRoomLaunchContext.chatRoomId) : null;
    if (!canViewTableContext(table, currentUserId, room)) {
      return res.status(403).json({ message: "You are not authorized to view this table context" });
    }

    return res.json({
      postId: String(post._id),
      route: buildTableRoute({ tableCode: table.tableCode, tableId: table._id }),
      tableContext: serializeTableDiscoveryContext(table),
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to resolve feed table context");
  }
}

async function getDiscoveryPayload(req, res) {
  try {
    const currentUserId = req.user?._id || null;
    const [promotedPosts, activeTables] = await Promise.all([
      FeedPost.find({
        "moderation.status": { $ne: "blocked" },
        isPromoted: true,
        status: "published",
        visibility: "public",
      })
        .sort({ "promotion.startsAt": -1, "counters.promotedCount": -1, createdAt: -1, _id: -1 })
        .limit(5),
      GameTable.find({ status: { $in: ["waiting", "active"] } })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("chatRoomLaunchContext createdByUserId gameSettings gameType hostUserId maxPlayers phase players status tableCode tableName updatedAt"),
    ]);

    await hydrateCurrentUserReaction(promotedPosts, currentUserId);

    return res.json({
      discovery: {
        activeTables: activeTables
          .filter((table) => canViewTableContext(table, currentUserId))
          .map((table) => ({
            ...serializeTableDiscoveryContext(table),
            updatedAt: toIsoString(table.updatedAt),
          })),
        shareDestinations: SHARE_DESTINATIONS.map((destination) => ({
          id: destination,
          label: destination
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        })),
        suggestedActions: ["support", "comment", "share", "gift-clips", "promote", "invite-to-table"],
        promotedPosts: promotedPosts.map((post) => serializePost(post, currentUserId)),
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to load feed discovery payload");
  }
}

module.exports = {
  addComment,
  completePromotion,
  createPost,
  createReaction,
  createShare,
  createTableInvite,
  deleteComment,
  deletePost,
  getDiscoveryPayload,
  getPost,
  resolveAuthorProfile,
  resolveChatRoomContext,
  resolveFriendAction,
  resolveTableContext,
  promotionPaymentWebhook,
  listComments,
  listPosts,
  listReactionSummaries,
  purchasePromotion,
  removeSupport,
  sendGiftClip,
  setSupport,
  toggleReaction,
  updateComment,
  updatePost,
};
