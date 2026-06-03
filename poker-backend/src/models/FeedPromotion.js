const mongoose = require("mongoose");
const { PROMOTION_STATES } = require("./feedShared");

const feedPromotionSchema = new mongoose.Schema(
  {
    budgetClips: {
      type: Number,
      required: true,
      min: 1,
    },
    endsAt: {
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
    promotedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    spentClips: {
      type: Number,
      default: 0,
      min: 0,
    },
    startsAt: {
      type: Date,
      default: null,
      index: true,
    },
    state: {
      type: String,
      enum: PROMOTION_STATES.filter((state) => state !== "none"),
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

feedPromotionSchema.index({ state: 1, startsAt: -1, endsAt: 1 });
feedPromotionSchema.index({ postId: 1, state: 1 });
feedPromotionSchema.index({ promotedByUserId: 1, createdAt: -1 });

feedPromotionSchema.methods.toClient = function toClient() {
  return {
    budgetClips: this.budgetClips,
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    endsAt: this.endsAt instanceof Date ? this.endsAt.toISOString() : null,
    id: String(this._id),
    postId: String(this.postId),
    promotedByUserId: String(this.promotedByUserId),
    rejectionReason: this.rejectionReason || "",
    spentClips: this.spentClips || 0,
    startsAt: this.startsAt instanceof Date ? this.startsAt.toISOString() : null,
    state: this.state,
    updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : null,
  };
};

module.exports = mongoose.model("FeedPromotion", feedPromotionSchema);
module.exports.PROMOTION_STATES = PROMOTION_STATES;
