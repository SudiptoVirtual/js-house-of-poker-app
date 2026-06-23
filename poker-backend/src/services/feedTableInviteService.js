const mongoose = require("mongoose");

const FeedPost = require("../models/FeedPost");
const GameTable = require("../models/GameTable");
const User = require("../models/User");
const { appendTableInviteRecords, buildTableIdentifiers, serializeInviteTable } = require("./tableInviteService");

const MAX_INVITE_RECIPIENTS = 10;

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function getDisplayName(user) {
  return user?.displayName || user?.name || user?.username || user?.email || "Player";
}

function getHandle(user) {
  return user?.handle || user?.username || user?.email || getDisplayName(user);
}

function normalizePostId(payload = {}) {
  return String(payload.postId || payload.id || payload.feedPostId || "").trim();
}

function serializePost(post, currentUserId) {
  return typeof post?.toClient === "function" ? post.toClient({ currentUserId }) : post;
}

async function findVisibleFeedPost(postId, userId) {
  if (!isValidObjectId(postId)) {
    return null;
  }

  return FeedPost.findOne({
    _id: postId,
    $or: [
      { visibility: "public", status: "published" },
      { authorUserId: userId, status: { $ne: "deleted" } },
    ],
  });
}

function collectPostTableCandidates(post) {
  return [
    post?.tableContext?.tableCode,
    post?.tableCode,
    post?.tableId ? String(post.tableId) : null,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function normalizeTableToken(value) {
  return String(value || "").trim().toUpperCase();
}

async function resolveFeedPostTable({ payload = {}, post }) {
  const postCandidates = collectPostTableCandidates(post);
  if (postCandidates.length === 0) {
    throw new Error("Feed post is not linked to a table.");
  }

  const requestedCandidates = [payload.tableId, payload.tableCode, payload.targetTableId]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
  const allowedTokens = new Set(postCandidates.map(normalizeTableToken));

  if (requestedCandidates.length > 0) {
    const hasValidRequestedContext = requestedCandidates.some((candidate) => allowedTokens.has(normalizeTableToken(candidate)));
    if (!hasValidRequestedContext) {
      throw new Error("Requested table does not match the feed post table context.");
    }
  }

  const identifiers = postCandidates.flatMap(buildTableIdentifiers);
  const table = identifiers.length > 0 ? await GameTable.findOne({ $or: identifiers }) : null;

  if (!table) {
    throw new Error("Feed post table was not found.");
  }

  return table;
}

function normalizeFriendId(friend) {
  const candidate = friend?._id || friend?.id || friend;
  return isValidObjectId(candidate) ? String(candidate) : null;
}

async function getSenderFriendIds(sender) {
  if (Array.isArray(sender?.friends)) {
    return sender.friends.map(normalizeFriendId).filter(Boolean);
  }

  const senderWithFriends = await User.findById(sender?._id).select("friends");
  return Array.isArray(senderWithFriends?.friends) ? senderWithFriends.friends.map(normalizeFriendId).filter(Boolean) : [];
}

async function buildFeedInviteRecipients({ payload = {}, post, sender }) {
  const requestedRecipientIds = [
    payload.recipientUserId,
    ...(Array.isArray(payload.recipientUserIds) ? payload.recipientUserIds : []),
  ]
    .filter(Boolean)
    .map(String)
    .filter(isValidObjectId);

  const uniqueRequestedRecipientIds = [...new Set(requestedRecipientIds)]
    .filter((id) => id !== String(sender._id));

  if (uniqueRequestedRecipientIds.length === 0) {
    throw new Error("At least one recipient is required.");
  }

  const senderFriendIds = new Set(await getSenderFriendIds(sender));
  const eligibleFriendRecipientIds = uniqueRequestedRecipientIds
    .filter((id) => senderFriendIds.has(id))
    .slice(0, MAX_INVITE_RECIPIENTS);

  if (eligibleFriendRecipientIds.length === 0) {
    throw new Error("Only friends can receive feed table invites.");
  }

  const recipients = await User.find({
    _id: { $in: eligibleFriendRecipientIds },
    isBlocked: { $ne: true },
    status: { $ne: "blocked" },
  });

  if (recipients.length === 0) {
    throw new Error("Only friends can receive feed table invites.");
  }

  return recipients;
}

function serializeInviteForRecipient(invite) {
  return {
    ...invite,
    recipientAccountId: String(invite.recipientAccountId),
  };
}

async function createFeedTableInvite({ onTableInvitesUpdated = null, payload = {}, post = null, sender }) {
  const resolvedPost = post || await findVisibleFeedPost(normalizePostId(payload), sender._id);
  if (!resolvedPost) {
    throw new Error("Feed post not found.");
  }

  const table = await resolveFeedPostTable({ payload, post: resolvedPost });
  const recipients = await buildFeedInviteRecipients({ payload, post: resolvedPost, sender });
  const message = normalizeText(payload.message || `Inviting from feed post ${resolvedPost.id}`, 120) || null;

  const persistence = await appendTableInviteRecords({
    message,
    onTableInvitesUpdated,
    recipients,
    sender,
    source: "feed",
    table,
  });

  return {
    invites: persistence.invites,
    message,
    post: resolvedPost,
    recipients,
    table,
    tablePayload: serializeInviteTable(table),
  };
}

function buildFeedTableInviteEventPayload({ currentUserId, invites, message, post, tablePayload }) {
  return {
    invites: invites.map(serializeInviteForRecipient),
    message,
    ok: true,
    post: serializePost(post, currentUserId),
    table: tablePayload,
  };
}

function emitFeedTableInviteRecipientEvents(io, { invites = [], post, sender, tablePayload }) {
  const invitedPlayerIds = invites.map((invite) => String(invite.recipientAccountId));
  const payload = {
    invitedPlayerIds,
    invites: invites.map(serializeInviteForRecipient),
    playerIds: invitedPlayerIds,
    postId: String(post._id || post.id),
    recipient: true,
    sender: false,
    senderPlayerId: String(sender._id || sender.id || sender.userId || ""),
    senderPlayerName: getDisplayName(sender),
    source: "feed",
    tableCode: tablePayload.tableCode,
    tableDbId: tablePayload.tableDbId,
    tableId: tablePayload.tableId,
    tableName: tablePayload.tableName,
  };
  const deliveredPlayerIds = [];

  io?.sockets?.sockets?.forEach((candidateSocket) => {
    const userId = candidateSocket.data?.userId;
    if (userId && invitedPlayerIds.includes(String(userId))) {
      candidateSocket.emit("table:playerInvited", payload);
      deliveredPlayerIds.push(String(userId));
    }
  });

  return deliveredPlayerIds;
}

module.exports = {
  buildFeedInviteRecipients,
  buildFeedTableInviteEventPayload,
  createFeedTableInvite,
  emitFeedTableInviteRecipientEvents,
  findVisibleFeedPost,
  getDisplayName,
  getHandle,
  normalizePostId,
};
