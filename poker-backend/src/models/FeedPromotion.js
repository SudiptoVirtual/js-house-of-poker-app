const mongoose = require("mongoose");
const { PROMOTION_STATES } = require("./feedShared");

const PAYMENT_STATUSES = ["pending", "requires_action", "paid", "failed", "canceled", "refunded"];
const PAYMENT_PROVIDERS = ["manual", "mock", "stripe"];

const targetingMetadataSchema = new mongoose.Schema(
  {
    audience: {
      type: [String],
      default: [],
    },
    gameTypes: {
      type: [String],
      default: [],
    },
    locations: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    tableCodes: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const feedPromotionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      default: function defaultAmount() {
        return this.budgetClips || null;
      },
      min: 1,
    },
    budgetClips: {
      type: Number,
      required: true,
      min: 1,
    },
    checkoutUrl: {
      type: String,
      default: "",
      trim: true,
    },
    creatorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: function defaultCreatorUserId() {
        return this.sponsorUserId || this.promotedByUserId || null;
      },
      index: true,
    },
    durationDays: {
      type: Number,
      default: 7,
      min: 1,
    },
    endsAt: {
      type: Date,
      default: null,
      index: true,
    },
    paymentProvider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: "manual",
      index: true,
    },
    paymentReference: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    promotedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      select: false,
    },
    sponsorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: function defaultSponsorUserId() {
        return this.promotedByUserId || null;
      },
      index: true,
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
    targeting: {
      type: targetingMetadataSchema,
      default: () => ({}),
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

feedPromotionSchema.index({ state: 1, startsAt: -1, endsAt: 1 });
feedPromotionSchema.index({ postId: 1, state: 1 });
feedPromotionSchema.index({ sponsorUserId: 1, createdAt: -1 });
feedPromotionSchema.index({ creatorUserId: 1, createdAt: -1 });
feedPromotionSchema.index({ paymentProvider: 1, paymentReference: 1 });

feedPromotionSchema.pre("validate", function normalizeLegacyPromotionFields(next) {
  if (!this.sponsorUserId && this.promotedByUserId) {
    this.sponsorUserId = this.promotedByUserId;
  }

  if (!this.creatorUserId && this.postCreatorUserId) {
    this.creatorUserId = this.postCreatorUserId;
  }

  if (!this.creatorUserId && this.sponsorUserId) {
    this.creatorUserId = this.sponsorUserId;
  }

  if (!this.amount && this.budgetClips) {
    this.amount = this.budgetClips;
  }

  next();
});

feedPromotionSchema.path("sponsorUserId").required(true);
feedPromotionSchema.path("creatorUserId").required(true);
feedPromotionSchema.path("amount").required(true);

feedPromotionSchema.methods.toClient = function toClient() {
  return {
    amount: this.amount,
    budgetClips: this.budgetClips,
    checkoutUrl: this.checkoutUrl || null,
    createdAt: this.createdAt instanceof Date ? this.createdAt.toISOString() : null,
    creatorUserId: String(this.creatorUserId),
    durationDays: this.durationDays,
    endsAt: this.endsAt instanceof Date ? this.endsAt.toISOString() : null,
    id: String(this._id),
    paymentProvider: this.paymentProvider,
    paymentReference: this.paymentReference || null,
    paymentStatus: this.paymentStatus,
    postId: String(this.postId),
    promotedByUserId: String(this.sponsorUserId),
    rejectionReason: this.rejectionReason || "",
    sponsorUserId: String(this.sponsorUserId),
    spentClips: this.spentClips || 0,
    startsAt: this.startsAt instanceof Date ? this.startsAt.toISOString() : null,
    state: this.state,
    targeting: this.targeting || {},
    transactionId: this.transactionId ? String(this.transactionId) : null,
    updatedAt: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : null,
  };
};

module.exports = mongoose.model("FeedPromotion", feedPromotionSchema);
module.exports.PAYMENT_PROVIDERS = PAYMENT_PROVIDERS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.PROMOTION_STATES = PROMOTION_STATES;
