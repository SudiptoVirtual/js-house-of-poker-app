const mongoose = require("mongoose");

const withdrawalRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "success", "failed"],
      default: "pending",
    },
    provider: {
      type: String,
      default: "manual",
      trim: true,
    },
    payoutMethod: {
      type: String,
      default: "bank",
      trim: true,
    },
    referenceId: {
      type: String,
      default: "",
      trim: true,
    },
    requestedNote: {
      type: String,
      default: "",
      trim: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
    approvedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    rejectedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);