const mongoose = require("mongoose");
const ChatRoom = require("./ChatRoom");

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
      enum: ["accepted", "blocked", "pending-review"],
      default: "accepted",
    },
  },
  { _id: false }
);

const chatRoomMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    senderDisplayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    moderation: {
      type: moderationSchema,
      default: () => ({}),
    },
    tone: {
      type: String,
      enum: ["player", "system"],
      default: "player",
    },
    launchContext: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    deletionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

chatRoomMessageSchema.index({ roomId: 1, createdAt: -1 });
chatRoomMessageSchema.index({ "moderation.status": 1, createdAt: -1 });

function buildMessagePreview(message) {
  const prefix = message.senderDisplayName ? `${message.senderDisplayName}: ` : "";
  const preview = `${prefix}${message.text}`.replace(/\s+/g, " ").trim();

  return preview.length > 240 ? `${preview.slice(0, 237)}...` : preview;
}

chatRoomMessageSchema.post("save", function updateRoomPreview(message) {
  if (message.deletedAt || message.moderation?.status === "blocked") {
    return undefined;
  }

  const unreadIncrement = message.senderUserId
    ? {
        "participantStates.$[participant].unreadCount": 1,
      }
    : {};

  const updateOptions = message.senderUserId
    ? { arrayFilters: [{ "participant.userId": { $ne: message.senderUserId } }] }
    : {};

  return ChatRoom.updateOne(
    { _id: message.roomId },
    {
      $set: {
        lastMessagePreview: buildMessagePreview(message),
        lastMessageAt: message.createdAt,
      },
      ...(Object.keys(unreadIncrement).length > 0 ? { $inc: unreadIncrement } : {}),
    },
    updateOptions
  );
});

module.exports = mongoose.model("ChatRoomMessage", chatRoomMessageSchema);
