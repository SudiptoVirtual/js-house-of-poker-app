const mongoose = require("mongoose");
const { SHARE_DESTINATIONS, normalizeShareDestination } = require("./feedShared");

const targetIdentifiersSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    tableId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    userId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
  },
  { _id: false }
);

const feedShareSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      default() {
        return normalizeShareDestination(this.destination);
      },
      enum: SHARE_DESTINATIONS,
      required: true,
      index: true,
      set: (value) => normalizeShareDestination(value),
    },
    destination: {
      type: String,
      enum: SHARE_DESTINATIONS,
      required: true,
      index: true,
      set: (value) => normalizeShareDestination(value),
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    targetIdentifiers: {
      type: targetIdentifiersSchema,
      default: () => ({}),
    },
    targetType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

feedShareSchema.pre("validate", function normalizeShareFields(next) {
  const normalizedDestination = normalizeShareDestination(this.destination || this.channel);
  this.destination = normalizedDestination;
  this.channel = normalizeShareDestination(this.channel || normalizedDestination);
  next();
});

feedShareSchema.index({ postId: 1, createdAt: -1 });
feedShareSchema.index(
  { postId: 1, userId: 1, destination: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { targetId: { $type: "string" } } }
);
feedShareSchema.index({ userId: 1, destination: 1, createdAt: -1 });

feedShareSchema.methods.toClient = function toClient() {
  return {
    channel: this.channel || this.destination,
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    destination: this.destination,
    id: String(this._id),
    metadata: this.metadata && typeof this.metadata === "object" ? this.metadata : {},
    postId: String(this.postId),
    targetId: this.targetId || null,
    targetIdentifiers: {
      ...(this.targetIdentifiers?.roomId ? { roomId: this.targetIdentifiers.roomId } : {}),
      ...(this.targetIdentifiers?.tableId ? { tableId: this.targetIdentifiers.tableId } : {}),
      ...(this.targetIdentifiers?.userId ? { userId: this.targetIdentifiers.userId } : {}),
    },
    targetType: this.targetType || null,
    userId: String(this.userId),
  };
};

module.exports = mongoose.model("FeedShare", feedShareSchema);
module.exports.SHARE_DESTINATIONS = SHARE_DESTINATIONS;
