const mongoose = require("mongoose");

const gameEventLogSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Object,
      default: {},
    },
    createdByType: {
      type: String,
      enum: ["system", "admin", "player"],
      default: "system",
    },
    createdById: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GameEventLog", gameEventLogSchema);