const mongoose = require("mongoose");

function createDefaultGameSettings() {
  return {
    game: "holdem",
    locked: false,
    lowRule: "8-or-better",
    mode: "high-only",
    stips: {
      bestFiveCards: false,
      hostestWithTheMostest: false,
      suitedBeatsUnsuited: false,
      wildCards: false,
    },
    wildCards: [],
  };
}

const handPlayerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    playerId: {
      type: String,
      required: true,
      trim: true,
    },
    nameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    seatIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    holeCards: {
      type: [String],
      default: [],
    },
    result: {
      type: String,
      default: "",
      trim: true,
    },
    chipsWon: {
      type: Number,
      default: 0,
    },
    chipsDelta: {
      type: Number,
      default: 0,
    },
    chipsBefore: {
      type: Number,
      default: 0,
      min: 0,
    },
    chipsAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalContribution: {
      type: Number,
      default: 0,
      min: 0,
    },
    folded: {
      type: Boolean,
      default: false,
    },
    allIn: {
      type: Boolean,
      default: false,
    },
    handDescription: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const handHistorySchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameTable",
      required: true,
    },
    tableCode: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    tableName: {
      type: String,
      default: "",
      trim: true,
    },
    handNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "abandoned"],
      default: "in_progress",
    },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    gameType: {
      type: String,
      required: true,
      trim: true,
    },
    gameSettingsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: createDefaultGameSettings,
    },
    players: {
      type: [handPlayerSchema],
      default: [],
    },
    totalPot: {
      type: Number,
      default: 0,
      min: 0,
    },
    phase: {
      type: String,
      default: "waiting",
      trim: true,
    },
    communityCards: {
      type: [String],
      default: [],
    },
    actionLog: {
      type: [String],
      default: [],
    },
    winnerText: {
      type: String,
      default: "",
      trim: true,
    },
    stateSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastActionAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HandHistory", handHistorySchema);
