const mongoose = require("mongoose");
const { moderationSchema, playerSnapshotSchema } = require("./feedShared");

const feedCommentSchema = new mongoose.Schema(
  {
    authorSnapshot: {
      type: playerSnapshotSchema,
      required: true,
    },
    authorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    moderation: {
      type: moderationSchema,
      default: () => ({}),
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedComment",
      default: null,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

feedCommentSchema.index({ postId: 1, createdAt: -1 });
feedCommentSchema.index({ authorUserId: 1, createdAt: -1 });
feedCommentSchema.index({ postId: 1, parentCommentId: 1, createdAt: 1 });
feedCommentSchema.index({ "moderation.status": 1, createdAt: -1 });

feedCommentSchema.methods.toClient = function toClient() {
  return {
    authorUserId: String(this.authorUserId),
    body: this.body,
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    deletedAt: this.deletedAt instanceof Date ? this.deletedAt.toISOString() : null,
    id: String(this._id),
    moderationStatus: this.moderation?.status || "accepted",
    parentCommentId: this.parentCommentId ? String(this.parentCommentId) : null,
    player: {
      ...(this.authorSnapshot?.avatarUrl ? { avatarUrl: this.authorSnapshot.avatarUrl } : {}),
      handle: this.authorSnapshot?.handle || "@player",
      id: String(this.authorUserId),
      name: this.authorSnapshot?.name || "Player",
      status: this.authorSnapshot?.status || "Away",
      ...(this.authorSnapshot?.statusTier ? { statusTier: this.authorSnapshot.statusTier } : {}),
    },
    postId: String(this.postId),
  };
};

module.exports = mongoose.model("FeedComment", feedCommentSchema);
