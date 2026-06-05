const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "chat_message",
  "chat_room_invite",
  "chat_room_gift_clip",
  "table_invite",
  "table_launched_from_chat",
  "mention",
  "feed_comment",
  "feed_support",
  "feed_share",
  "feed_gift_clip",
  "feed_promotion",
  "feed_table_invite",
  "friend_request",
  "friend_request_accepted",
  "friend_request_declined",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      default: null,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoomMessage",
      default: null,
      index: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      default: null,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      default: null,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, chatRoomId: 1, readAt: 1 });
notificationSchema.index({ chatRoomId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ postId: 1, type: 1, createdAt: -1 });

notificationSchema.methods.toClient = function toClient() {
  return {
    id: String(this._id),
    actorUserId: this.actorUserId ? String(this.actorUserId) : null,
    body: this.body,
    chatRoomId: this.chatRoomId ? String(this.chatRoomId) : null,
    createdAt: this.createdAt,
    data: this.data || {},
    messageId: this.messageId ? String(this.messageId) : null,
    postId: this.postId ? String(this.postId) : null,
    readAt: this.readAt,
    tableId: this.tableId ? String(this.tableId) : null,
    title: this.title,
    type: this.type,
    userId: String(this.userId),
  };
};

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
