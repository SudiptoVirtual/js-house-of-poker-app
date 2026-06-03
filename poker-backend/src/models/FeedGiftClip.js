const mongoose = require("mongoose");

const feedGiftClipSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

feedGiftClipSchema.index({ postId: 1, createdAt: -1 });
feedGiftClipSchema.index({ senderUserId: 1, createdAt: -1 });
feedGiftClipSchema.index({ recipientUserId: 1, createdAt: -1 });

feedGiftClipSchema.methods.toClient = function toClient() {
  return {
    amount: this.amount,
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    id: String(this._id),
    message: this.message || "",
    postId: String(this.postId),
    recipientUserId: String(this.recipientUserId),
    senderUserId: String(this.senderUserId),
    transactionId: this.transactionId ? String(this.transactionId) : null,
  };
};

module.exports = mongoose.model("FeedGiftClip", feedGiftClipSchema);
