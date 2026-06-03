const mongoose = require("mongoose");
const { REACTION_TYPES } = require("./feedShared");

const feedReactionSchema = new mongoose.Schema(
  {
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },
    reactionType: {
      type: String,
      alias: "type",
      enum: REACTION_TYPES,
      default: "support",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

feedReactionSchema.index({ postId: 1, userId: 1, reactionType: 1 }, { unique: true });
feedReactionSchema.index({ userId: 1, createdAt: -1 });
feedReactionSchema.index({ postId: 1, reactionType: 1, createdAt: -1 });

feedReactionSchema.methods.toClient = function toClient() {
  return {
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    deletedAt: this.deletedAt instanceof Date ? this.deletedAt.toISOString() : null,
    id: String(this._id),
    postId: String(this.postId),
    reactionType: this.reactionType,
    type: this.reactionType,
    userId: String(this.userId),
  };
};

module.exports = mongoose.model("FeedReaction", feedReactionSchema);
module.exports.REACTION_TYPES = REACTION_TYPES;
