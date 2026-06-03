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
  REACTION_TYPES,
  SHARE_DESTINATIONS,
} = require("../models/feedShared");

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 50;
const DEFAULT_COMMENT_LIMIT = 25;
const MAX_COMMENT_LIMIT = 100;
const MAX_INVITE_RECIPIENTS = 10;

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
    type: "support",
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

async function createCommentAndIncrementPost({ body, currentUserId, parentCommentId = null, postId, user }) {
  return runCommentTransaction(async (session) => {
    const post = await findVisiblePost(postId, currentUserId, session);

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

    if (updatedPost && currentUserId) {
      await hydrateCurrentUserReaction([updatedPost], currentUserId, session);
    }

    return { comment, post: updatedPost };
  });
}

async function decrementPostCommentCount(postId, session) {
  return FeedPost.findOneAndUpdate(
    { _id: postId },
    { $inc: { "counters.commentCount": -1 } },
    { new: true, session },
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
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);
    const page = posts.slice(0, limit);
    await hydrateCurrentUserReaction(page, currentUserId);

    return res.json({
      pagination: {
        hasMore: posts.length > limit,
        limit,
        nextCursor: posts.length > limit ? encodeCursor(page[page.length - 1]) : null,
      },
      posts: page.map((post) => serializePost(post, currentUserId)),
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

    return res.json({ post: serializePost(post, currentUserId) });
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

    return res.status(201).json({
      comment: serializeComment(result.comment, req.user._id),
      post: serializePost(result.post, req.user._id),
    });
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

    const result = await runCommentTransaction(async (session) => {
      const visiblePost = await findVisiblePost(postId, req.user._id, session);
      if (!visiblePost) {
        return { status: "post_not_found" };
      }

      const comment = await FeedComment.findOne({ _id: commentId, deletedAt: null, postId }).session(session);

      if (!comment || comment.moderation?.status === "blocked") {
        return { status: "not_found" };
      }

      if (String(comment.authorUserId) !== String(req.user._id)) {
        return { status: "forbidden" };
      }

      comment.deletedAt = new Date();
      await comment.save({ session });

      const post = await decrementPostCommentCount(postId, session);
      if (post) {
        post.counters.commentCount = Math.max(0, post.counters?.commentCount || 0);
        await post.save({ session });
        await hydrateCurrentUserReaction([post], req.user._id, session);
      }

      return { comment, post, status: "deleted" };
    });

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

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    let reaction = await FeedReaction.findOne({ postId, type: "support", userId: req.user._id }).sort({ createdAt: -1 });
    let changed = false;

    if (reaction) {
      if (reaction.deletedAt) {
        reaction.deletedAt = null;
        await reaction.save();
        changed = true;
      }
    } else {
      reaction = await FeedReaction.create({ postId, type: "support", userId: req.user._id });
      changed = true;
    }

    if (changed) {
      post.counters.supportersCount = (post.counters.supportersCount || 0) + 1;
      await post.save();
    }

    post.supportedByCurrentPlayer = true;

    return res.json({
      post: serializePost(post, req.user._id),
      reaction: reaction.toClient(),
      supported: true,
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to support feed post");
  }
}

async function removeSupport(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const reaction = await FeedReaction.findOne({ deletedAt: null, postId, type: "support", userId: req.user._id });

    if (reaction) {
      reaction.deletedAt = new Date();
      await reaction.save();
      post.counters.supportersCount = Math.max(0, (post.counters.supportersCount || 0) - 1);
      await post.save();
    }

    post.supportedByCurrentPlayer = false;

    return res.json({
      post: serializePost(post, req.user._id),
      reaction: reaction ? reaction.toClient() : null,
      supported: false,
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to remove feed support");
  }
}

async function createReaction(req, res) {
  const type = normalizeText(req.body?.type || req.params.type || "support", 40);

  if (!REACTION_TYPES.includes(type)) {
    return res.status(400).json({ message: "Invalid reaction type" });
  }

  return setSupport(req, res);
}

async function createShare(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const destination = normalizeText(req.body?.destination || req.body?.destinationId || "copy-link", 40);
    if (!SHARE_DESTINATIONS.includes(destination)) {
      return res.status(400).json({ message: "Invalid share destination" });
    }

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const targetId = normalizeText(req.body?.targetId, 120);
    const share = await FeedShare.create({ destination, postId, targetId, userId: req.user._id });
    post.counters.shareCount = (post.counters.shareCount || 0) + 1;
    await post.save();
    await hydrateCurrentUserReaction([post], req.user._id);

    return res.status(201).json({ post: serializePost(post, req.user._id), share: share.toClient() });
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

    const amount = Math.max(1, Number.parseInt(req.body?.amount || req.body?.clips, 10));
    if (!Number.isFinite(amount)) {
      return res.status(400).json({ message: "Gift Clip amount is required" });
    }

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const giftClip = await FeedGiftClip.create({
      amount,
      message: normalizeText(req.body?.message, 500),
      postId,
      recipientUserId: post.authorUserId,
      senderUserId: req.user._id,
      transactionId: isValidObjectId(req.body?.transactionId) ? req.body.transactionId : null,
    });

    post.counters.giftClipsCount = (post.counters.giftClipsCount || 0) + 1;
    post.counters.giftClipsTotal = (post.counters.giftClipsTotal || 0) + amount;
    await post.save();
    await hydrateCurrentUserReaction([post], req.user._id);

    return res.status(201).json({ giftClip: giftClip.toClient(), post: serializePost(post, req.user._id) });
  } catch (error) {
    return sendServerError(res, error, "Unable to send Gift Clips");
  }
}

async function purchasePromotion(req, res) {
  try {
    const postId = requireObjectId(req.params.postId, res, "post id");
    if (!postId) return null;

    const budgetClips = Math.max(1, Number.parseInt(req.body?.budgetClips || req.body?.amount, 10));
    if (!Number.isFinite(budgetClips)) {
      return res.status(400).json({ message: "Promotion budget is required" });
    }

    const post = await findVisiblePost(postId, req.user._id);
    if (!post) {
      return res.status(404).json({ message: "Feed post not found" });
    }

    const now = new Date();
    const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : now;
    const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;
    const state = req.body?.state === "pending" ? "pending" : "active";

    const promotion = await FeedPromotion.create({
      budgetClips,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      postId,
      promotedByUserId: req.user._id,
      startsAt: Number.isNaN(startsAt.getTime()) ? now : startsAt,
      state,
    });

    post.isPromoted = true;
    post.promotion = {
      budgetClips,
      endsAt: promotion.endsAt,
      isPromoted: true,
      promotedByUserId: req.user._id,
      spentClips: 0,
      startsAt: promotion.startsAt,
      state,
    };
    post.counters.promotedCount = (post.counters.promotedCount || 0) + 1;
    await post.save();
    await hydrateCurrentUserReaction([post], req.user._id);

    return res.status(201).json({ post: serializePost(post, req.user._id), promotion: promotion.toClient() });
  } catch (error) {
    return sendServerError(res, error, "Unable to purchase feed promotion");
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

    const tableId = normalizeText(req.body?.tableId || req.body?.tableCode || post.tableCode, 80);
    if (!tableId) {
      return res.status(400).json({ message: "Table id or code is required" });
    }

    const identifiers = [{ tableCode: tableId.toUpperCase() }];
    if (isValidObjectId(tableId)) {
      identifiers.push({ _id: tableId });
    }

    const table = await GameTable.findOne({ $or: identifiers });
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    const recipientIds = [
      req.body?.recipientUserId,
      ...(Array.isArray(req.body?.recipientUserIds) ? req.body.recipientUserIds : []),
      post.authorUserId,
    ]
      .filter(Boolean)
      .map(String)
      .filter(isValidObjectId);
    const uniqueRecipientIds = [...new Set(recipientIds)].filter((id) => id !== String(req.user._id)).slice(0, MAX_INVITE_RECIPIENTS);

    if (uniqueRecipientIds.length === 0) {
      return res.status(400).json({ message: "At least one recipient is required" });
    }

    const recipients = await User.find({ _id: { $in: uniqueRecipientIds }, isBlocked: { $ne: true }, status: { $ne: "blocked" } });
    const senderId = String(req.user._id);
    const tablePlayerIds = new Set((table.players || []).map((player) => String(player.userId)));
    const hasTableAccess =
      String(table.createdByUserId || "") === senderId ||
      String(table.hostUserId || "") === senderId ||
      tablePlayerIds.has(senderId);

    if (!hasTableAccess) {
      return res.status(403).json({ message: "You are not allowed to invite players to this table" });
    }

    const message = normalizeText(req.body?.message || `Inviting from feed post ${post.id}`, 500) || null;
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
      senderPlayerName: getDisplayName(req.user),
      source: "share-link",
      status: "pending",
    }));

    table.tableInvites = [...invites, ...(table.tableInvites || [])].slice(0, 50);
    await table.save();

    return res.status(201).json({
      invites,
      post: serializePost(post, req.user._id),
      table: {
        id: table.tableCode || String(table._id),
        tableCode: table.tableCode || null,
        tableDbId: String(table._id),
        tableId: table.tableCode || String(table._id),
        tableName: table.tableName,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Unable to create feed table invite");
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
        .sort({ createdAt: -1, _id: -1 })
        .limit(5),
      GameTable.find({ status: { $in: ["waiting", "active"] } })
        .sort({ updatedAt: -1 })
        .limit(8)
        .select("gameSettings maxPlayers players status tableCode tableName updatedAt"),
    ]);

    await hydrateCurrentUserReaction(promotedPosts, currentUserId);

    return res.json({
      discovery: {
        activeTables: activeTables.map((table) => ({
          gameLabel: table.gameSettings?.game || "poker",
          id: String(table._id),
          seatsOpen: Math.max(0, (table.maxPlayers || 0) - (table.players?.length || 0)),
          status: table.status,
          tableCode: table.tableCode,
          tableName: table.tableName,
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
  createPost,
  createReaction,
  createShare,
  createTableInvite,
  deleteComment,
  deletePost,
  getDiscoveryPayload,
  getPost,
  listComments,
  listPosts,
  purchasePromotion,
  removeSupport,
  sendGiftClip,
  setSupport,
  updateComment,
  updatePost,
};
