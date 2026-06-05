const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const ChatRoomMessage = require("../models/ChatRoomMessage");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { userCanAccessChatRoom } = require("./chatRoomAccessService");
const CHAT_ROOM_PREFIX = "chat:room";
const TRANSACTION_TYPE = "chat_room_gift_clip";
const TRANSACTION_PROVIDER = "chat_room_gift_clips";

class ChatRoomGiftClipError extends Error {
  constructor(message, statusCode = 400, code = "CHAT_ROOM_GIFT_CLIP_ERROR") {
    super(message);
    this.name = "ChatRoomGiftClipError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getChatRoomChannel(roomId) {
  return `${CHAT_ROOM_PREFIX}:${roomId}`;
}

function stringifyOptionalId(value) {
  return value ? String(value) : null;
}

function serializeGiftClipPayload(giftClip) {
  if (!giftClip) {
    return null;
  }

  return {
    amount: giftClip.amount || 0,
    message: giftClip.message || "",
    recipientTransactionId: stringifyOptionalId(giftClip.recipientTransactionId),
    recipientUserId: stringifyOptionalId(giftClip.recipientUserId),
    senderTransactionId: stringifyOptionalId(giftClip.senderTransactionId),
    transactionId: stringifyOptionalId(giftClip.transactionId),
    transactionIds: {
      recipient: stringifyOptionalId(giftClip.recipientTransactionId),
      sender: stringifyOptionalId(giftClip.senderTransactionId || giftClip.transactionId),
    },
  };
}

function serializeChatRoomGiftClipMessage(message) {
  const roomId = String(message.roomId);
  const authorId = message.senderUserId ? String(message.senderUserId) : null;
  const createdAt = message.createdAt || new Date();
  const giftClip = serializeGiftClipPayload(message.giftClip);
  const text = message.text || giftClip?.message || "";

  return {
    authorId,
    authorName: message.senderDisplayName,
    body: text,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString(),
    id: String(message._id),
    giftClip,
    kind: "gift_clip",
    messageType: "gift_clip",
    moderation: message.moderation || {
      flags: [],
      reason: null,
      reviewedAt: null,
      status: "accepted",
    },
    playerId: authorId,
    playerName: message.senderDisplayName,
    roomId,
    text,
    tone: message.tone || "player",
  };
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
    throw new ChatRoomGiftClipError("Gift Clip amount must be a positive number.", 400, "INVALID_GIFT_CLIP_AMOUNT");
  }

  return amount;
}

function getDisplayName(user) {
  return user.name || user.email || "Player";
}

async function findAccessibleChatRoom(roomId, currentUserId, session) {
  const normalizedRoomId = String(roomId || "").trim();

  if (!normalizedRoomId) {
    throw new ChatRoomGiftClipError("Chat room id is required.", 400, "INVALID_ROOM_ID");
  }

  const identifiers = [{ slug: normalizedRoomId.toLowerCase() }];

  if (isValidObjectId(normalizedRoomId)) {
    identifiers.push({ _id: normalizedRoomId });
  }

  const room = await ChatRoom.findOne({ $or: identifiers, isDisabled: { $ne: true } }).session(session);

  if (!room) {
    throw new ChatRoomGiftClipError("Chat room not found.", 404, "CHAT_ROOM_NOT_FOUND");
  }

  if (!userCanAccessChatRoom(room, currentUserId)) {
    throw new ChatRoomGiftClipError("You are not allowed to send Gift Clips in this chat room.", 403, "ROOM_ACCESS_DENIED");
  }

  return room;
}

function serializeTransactionIds(senderTransaction, recipientTransaction) {
  return {
    recipient: recipientTransaction ? String(recipientTransaction._id) : null,
    sender: senderTransaction ? String(senderTransaction._id) : null,
  };
}

async function sendChatRoomGiftClip({
  amount: rawAmount,
  currentUserId,
  io = null,
  message = "",
  recipientUserId,
  roomId,
}) {
  if (!currentUserId || !isValidObjectId(currentUserId)) {
    throw new ChatRoomGiftClipError("Authentication is required to send Gift Clips.", 401, "AUTH_REQUIRED");
  }

  if (!recipientUserId || !isValidObjectId(recipientUserId)) {
    throw new ChatRoomGiftClipError("Invalid recipient user id.", 400, "INVALID_RECIPIENT_ID");
  }

  if (String(currentUserId) === String(recipientUserId)) {
    throw new ChatRoomGiftClipError("You cannot send Gift Clips to yourself.", 400, "SELF_GIFT_NOT_ALLOWED");
  }

  const amount = normalizeClipAmount(rawAmount);
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const room = await findAccessibleChatRoom(roomId, currentUserId, session);

      const recipient = await User.findById(recipientUserId)
        .session(session)
        .select("_id chips email name status isBlocked");
      if (!recipient || recipient.isBlocked || recipient.status !== "active") {
        throw new ChatRoomGiftClipError("Gift Clip recipient is not available.", 404, "RECIPIENT_NOT_FOUND");
      }

      if (!userCanAccessChatRoom(room, recipient._id)) {
        throw new ChatRoomGiftClipError(
          "Gift Clip recipient cannot access this chat room.",
          400,
          "RECIPIENT_ROOM_ACCESS_DENIED"
        );
      }

      const sender = await User.findOneAndUpdate(
        {
          _id: currentUserId,
          chips: { $gte: amount },
          isBlocked: { $ne: true },
          status: "active",
        },
        { $inc: { chips: -amount } },
        { new: true, session }
      ).select("_id chips email name");

      if (!sender) {
        throw new ChatRoomGiftClipError("Insufficient Gift Clip balance.", 400, "INSUFFICIENT_GIFT_CLIPS");
      }

      const updatedRecipient = await User.findByIdAndUpdate(
        recipient._id,
        { $inc: { chips: amount } },
        { new: true, session }
      ).select("_id chips");

      const [senderTransaction, recipientTransaction] = await Transaction.create(
        [
          {
            amount,
            meta: {
              balanceField: "chips",
              counterpartyUserId: String(recipient._id),
              direction: "debit",
              roomId: String(room._id),
            },
            note: `Gift Clips sent in chat room ${room._id}`,
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
              roomId: String(room._id),
            },
            note: `Gift Clips received in chat room ${room._id}`,
            provider: TRANSACTION_PROVIDER,
            status: "success",
            type: TRANSACTION_TYPE,
            userId: recipient._id,
          },
        ],
        { session }
      );

      const [chatMessage] = await ChatRoomMessage.create(
        [
          {
            giftClip: {
              amount,
              message: normalizeText(message, 500),
              recipientTransactionId: recipientTransaction._id,
              recipientUserId: recipient._id,
              senderTransactionId: senderTransaction._id,
              transactionId: senderTransaction._id,
            },
            kind: "gift_clip",
            messageType: "gift_clip",
            moderation: {
              flags: [],
              reason: null,
              reviewedAt: null,
              status: "accepted",
            },
            roomId: room._id,
            senderDisplayName: getDisplayName(sender),
            senderUserId: sender._id,
            text: "",
          },
        ],
        { session }
      );

      const referenceId = String(chatMessage._id);
      await Transaction.updateMany(
        { _id: { $in: [senderTransaction._id, recipientTransaction._id] } },
        { $set: { referenceId } },
        { session }
      );
      senderTransaction.referenceId = referenceId;
      recipientTransaction.referenceId = referenceId;

      result = {
        balances: {
          recipient: updatedRecipient ? updatedRecipient.chips : recipient.chips + amount,
          sender: sender.chips,
        },
        message: chatMessage,
        recipient,
        room,
        sender,
        transactionIds: serializeTransactionIds(senderTransaction, recipientTransaction),
      };
    });

    const serializedMessage = serializeChatRoomGiftClipMessage(result.message);
    const eventPayload = {
      balances: result.balances,
      message: serializedMessage,
      ok: true,
      roomId: String(result.room._id),
      success: true,
      transactionIds: result.transactionIds,
      transactions: result.transactionIds,
    };

    if (io) {
      io.to(getChatRoomChannel(result.room._id)).emit("chat:newMessage", {
        message: serializedMessage,
        roomId: String(result.room._id),
      });
    }

    return {
      ...result,
      eventPayload,
      serializedMessage,
    };
  } finally {
    session.endSession();
  }
}

module.exports = {
  ChatRoomGiftClipError,
  sendChatRoomGiftClip,
};
