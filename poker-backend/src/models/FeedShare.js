const mongoose = require("mongoose");
const { SHARE_DESTINATIONS } = require("./feedShared");

const feedShareSchema = new mongoose.Schema(
  {
    destination: {
      type: String,
      enum: SHARE_DESTINATIONS,
      required: true,
      index: true,
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

feedShareSchema.index({ postId: 1, createdAt: -1 });
feedShareSchema.index(
  { postId: 1, userId: 1, destination: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { targetId: { $type: "string" } } }
);
feedShareSchema.index({ userId: 1, createdAt: -1 });

feedShareSchema.methods.toClient = function toClient() {
  return {
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    destination: this.destination,
    id: String(this._id),
    postId: String(this.postId),
    targetId: this.targetId || null,
    userId: String(this.userId),
  };
};

module.exports = mongoose.model("FeedShare", feedShareSchema);
module.exports.SHARE_DESTINATIONS = SHARE_DESTINATIONS;
