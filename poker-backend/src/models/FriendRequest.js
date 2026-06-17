const mongoose = require("mongoose");

const FRIEND_REQUEST_STATUSES = ["pending", "accepted", "declined", "blocked", "removed"];

function buildFriendPairKey(senderUserId, receiverUserId) {
  const ids = [senderUserId, receiverUserId]
    .map((userId) => String(userId || "").trim())
    .sort();

  return ids.join(":");
}

const friendRequestSchema = new mongoose.Schema(
  {
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pairKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: FRIEND_REQUEST_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

friendRequestSchema.pre("validate", function (next) {
  this.pairKey = buildFriendPairKey(this.senderUserId, this.receiverUserId);
  next();
});

friendRequestSchema.index(
  { pairKey: 1, status: 1 },
  {
    partialFilterExpression: { status: "pending" },
    unique: true,
  }
);
friendRequestSchema.index({ senderUserId: 1, status: 1, receiverUserId: 1, updatedAt: -1 });
friendRequestSchema.index({ receiverUserId: 1, status: 1, senderUserId: 1, updatedAt: -1 });
friendRequestSchema.index({ pairKey: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("FriendRequest", friendRequestSchema);
module.exports.FRIEND_REQUEST_STATUSES = FRIEND_REQUEST_STATUSES;
module.exports.buildFriendPairKey = buildFriendPairKey;
