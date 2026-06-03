const mongoose = require("mongoose");

const FeedGiftClip = require("../models/FeedGiftClip");
const FeedPost = require("../models/FeedPost");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const TRANSACTION_TYPE = "feed_gift_clip";
const TRANSACTION_PROVIDER = "feed_gift_clips";

class FeedGiftClipError extends Error {
  constructor(message, statusCode = 400, code = "FEED_GIFT_CLIP_ERROR") {
    super(message);
    this.name = "FeedGiftClipError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeClipAmount(value) {
  const amount = Number.parseInt(value, 10);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new FeedGiftClipError("Gift Clip amount must be a positive number.", 400, "INVALID_GIFT_CLIP_AMOUNT");
  }

  return amount;
}

async function findVisiblePost(postId, currentUserId, session) {
  if (!isValidObjectId(postId)) {
    throw new FeedGiftClipError("Invalid post id.", 400, "INVALID_POST_ID");
  }

  const post = await FeedPost.findOne({
    _id: postId,
    "moderation.status": { $ne: "blocked" },
    status: "published",
    $or: [{ visibility: { $in: ["public", "unlisted"] } }, { authorUserId: currentUserId }],
  }).session(session);

  if (!post) {
    throw new FeedGiftClipError("Feed post not found.", 404, "FEED_POST_NOT_FOUND");
  }

  return post;
}

function serializeTransactionIds(senderTransaction, recipientTransaction) {
  return {
    recipient: recipientTransaction ? String(recipientTransaction._id) : null,
    sender: senderTransaction ? String(senderTransaction._id) : null,
  };
}

async function sendFeedGiftClip({ amount: rawAmount, currentUserId, message = "", postId, recipientUserId = null }) {
  if (!currentUserId || !isValidObjectId(currentUserId)) {
    throw new FeedGiftClipError("Authentication is required to send Gift Clips.", 401, "AUTH_REQUIRED");
  }

  const amount = normalizeClipAmount(rawAmount);
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const post = await findVisiblePost(postId, currentUserId, session);
      const resolvedRecipientUserId = post.authorUserId;

      if (recipientUserId) {
        if (!isValidObjectId(recipientUserId)) {
          throw new FeedGiftClipError("Invalid recipient user id.", 400, "INVALID_RECIPIENT_ID");
        }

        if (String(recipientUserId) !== String(resolvedRecipientUserId)) {
          throw new FeedGiftClipError("Recipient must own the target feed post.", 400, "RECIPIENT_NOT_POST_OWNER");
        }
      }

      const recipient = await User.findById(resolvedRecipientUserId).session(session).select("_id chips status isBlocked");
      if (!recipient || recipient.isBlocked || recipient.status !== "active") {
        throw new FeedGiftClipError("Gift Clip recipient is not available.", 404, "RECIPIENT_NOT_FOUND");
      }

      const sender = await User.findOneAndUpdate(
        {
          _id: currentUserId,
          chips: { $gte: amount },
          isBlocked: { $ne: true },
          status: "active",
        },
        { $inc: { chips: -amount } },
        { new: true, session },
      ).select("_id chips");

      if (!sender) {
        throw new FeedGiftClipError("Insufficient Gift Clip balance.", 400, "INSUFFICIENT_GIFT_CLIPS");
      }

      const updatedRecipient = await User.findByIdAndUpdate(
        resolvedRecipientUserId,
        { $inc: { chips: amount } },
        { new: true, session },
      ).select("_id chips");

      const [senderTransaction, recipientTransaction] = await Transaction.create(
        [
          {
            amount,
            meta: {
              balanceField: "chips",
              counterpartyUserId: String(resolvedRecipientUserId),
              direction: "debit",
              postId: String(post._id),
            },
            note: `Gift Clips sent to feed post ${post._id}`,
            provider: TRANSACTION_PROVIDER,
            status: "success",
            type: TRANSACTION_TYPE,
            userId: currentUserId,
          },
          {
            amount,
            meta: {
              balanceField: "chips",
              counterpartyUserId: String(currentUserId),
              direction: "credit",
              postId: String(post._id),
            },
            note: `Gift Clips received for feed post ${post._id}`,
            provider: TRANSACTION_PROVIDER,
            status: "success",
            type: TRANSACTION_TYPE,
            userId: resolvedRecipientUserId,
          },
        ],
        { session },
      );

      const [giftClip] = await FeedGiftClip.create(
        [
          {
            amount,
            message: normalizeText(message, 500),
            postId: post._id,
            recipientTransactionId: recipientTransaction._id,
            recipientUserId: resolvedRecipientUserId,
            senderTransactionId: senderTransaction._id,
            senderUserId: currentUserId,
            transactionId: senderTransaction._id,
          },
        ],
        { session },
      );

      const referenceId = String(giftClip._id);
      await Transaction.updateMany(
        { _id: { $in: [senderTransaction._id, recipientTransaction._id] } },
        { $set: { referenceId } },
        { session },
      );
      senderTransaction.referenceId = referenceId;
      recipientTransaction.referenceId = referenceId;

      const updatedPost = await FeedPost.findByIdAndUpdate(
        post._id,
        {
          $inc: {
            "counters.giftClipsCount": 1,
            "counters.giftClipsTotal": amount,
          },
        },
        { new: true, session },
      );

      result = {
        balances: {
          recipientChips: updatedRecipient?.chips ?? null,
          senderChips: sender.chips,
        },
        giftClip,
        post: updatedPost,
        transactionIds: serializeTransactionIds(senderTransaction, recipientTransaction),
        transactions: {
          recipient: recipientTransaction,
          sender: senderTransaction,
        },
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  FeedGiftClipError,
  sendFeedGiftClip,
};
