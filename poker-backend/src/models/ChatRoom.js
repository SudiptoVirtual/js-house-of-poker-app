const mongoose = require("mongoose");

const participantStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const tableInviteHistorySchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    invitedPlayerIds: {
      type: [String],
      default: [],
    },
    invites: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    message: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    results: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tableCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      default: null,
    },
  },
  { _id: false }
);

const tableLaunchSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      required: true,
    },
    tableCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    tableName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    launchedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invitedPlayerIds: {
      type: [String],
      default: [],
    },
    visibility: {
      type: String,
      default: "room",
      trim: true,
    },
    tableTier: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    rules: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    launchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      maxlength: 140,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    topic: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },
    activePlayerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessagePreview: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    participantStates: {
      type: [participantStateSchema],
      default: [],
    },
    tableLaunches: {
      type: [tableLaunchSchema],
      default: [],
    },
    tableInviteHistory: {
      type: [tableInviteHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

chatRoomSchema.index({ isPublic: 1, lastMessageAt: -1, updatedAt: -1 });
chatRoomSchema.index({ "participantStates.userId": 1 });

chatRoomSchema.methods.getUnreadCountForUser = function getUnreadCountForUser(userId) {
  if (!userId) {
    return 0;
  }

  const userIdString = String(userId);
  const participantState = this.participantStates.find(
    (state) => String(state.userId) === userIdString
  );

  return participantState ? participantState.unreadCount : 0;
};

chatRoomSchema.methods.toRoomListItem = function toRoomListItem(userId) {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    topic: this.topic,
    isPublic: this.isPublic,
    activePlayerCount: this.activePlayerCount,
    lastMessagePreview: this.lastMessagePreview,
    lastMessageAt: this.lastMessageAt,
    unreadCount: this.getUnreadCountForUser(userId),
    createdByUserId: this.createdByUserId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

chatRoomSchema.statics.findRoomList = function findRoomList({
  userId = null,
  includePrivate = false,
  limit = 50,
} = {}) {
  const visibilityFilter = includePrivate
    ? {}
    : {
        $or: [
          { isPublic: true },
          ...(userId ? [{ "participantStates.userId": userId }] : []),
        ],
      };

  return this.find(visibilityFilter)
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(limit)
    .then((rooms) => rooms.map((room) => room.toRoomListItem(userId)));
};

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
