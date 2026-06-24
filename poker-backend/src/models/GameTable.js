const mongoose = require("mongoose");

const POKER_PHASES = [
  "waiting",
  "deal_3",
  "decide_3",
  "deal_5",
  "decide_5",
  "deal_7",
  "decide_7",
  "reveal",
  "resolve",
  "reshuffle",
  "preflop",
  "flop",
  "turn",
  "river",
  "showdown",
  "completed",
];

const SUPPORTED_GAME_TYPES = [
  "7/27",
  "7-27",
  "55 Little Red",
  "357",
  "holdem",
  "shanghai",
  "in-between-the-sheets",
];

const CLIP_TO_CHIP_RATE = 40;
const ALLOWED_TABLE_TIER_CLIPS = [1, 5, 10, 20, 100, 500, 1000, 10000];
const DEFAULT_MAX_BET_CLIPS = 100;
const DEFAULT_MAX_BET_CHIPS = DEFAULT_MAX_BET_CLIPS * CLIP_TO_CHIP_RATE;
const DEFAULT_MAX_PLAYERS = 6;
const THREE_FIVE_SEVEN_MAX_PLAYERS = 7;

function resolveDefaultMaxPlayers(gameType) {
  return gameType === "357" ? THREE_FIVE_SEVEN_MAX_PLAYERS : DEFAULT_MAX_PLAYERS;
}

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

const moderationSchema = new mongoose.Schema(
  {
    flags: {
      type: [String],
      default: [],
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedAt: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["accepted", "blocked", "pending-review"],
      default: "accepted",
    },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    createdAt: {
      type: Number,
      required: true,
    },
    id: {
      type: String,
      required: true,
      trim: true,
    },
    moderation: {
      type: moderationSchema,
      default: () => ({}),
    },
    playerId: {
      type: String,
      default: null,
      trim: true,
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    tone: {
      type: String,
      enum: ["player", "system"],
      default: "player",
    },
  },
  { _id: false }
);

const tableInviteSchema = new mongoose.Schema(
  {
    createdAt: {
      type: Number,
      required: true,
    },
    giftBuyInChips: {
      type: Number,
      default: 0,
      min: 0,
    },
    giftBuyInClips: {
      type: Number,
      default: 0,
      min: 0,
    },
    id: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: null,
      trim: true,
    },
    recipientAccountId: {
      type: String,
      required: true,
      trim: true,
    },
    recipientHandle: {
      type: String,
      default: "",
      trim: true,
    },
    recipientLabel: {
      type: String,
      default: "",
      trim: true,
    },
    senderPlayerId: {
      type: String,
      required: true,
      trim: true,
    },
    senderPlayerName: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ["share-link", "friend-list", "seat-pass", "chat-room"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { _id: false }
);

const gameSettingsSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      default: "holdem",
      trim: true,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    lowRule: {
      type: String,
      default: "8-or-better",
      trim: true,
    },
    mode: {
      type: String,
      default: "high-only",
      trim: true,
    },
    stips: {
      bestFiveCards: {
        type: Boolean,
        default: false,
      },
      hostestWithTheMostest: {
        type: Boolean,
        default: false,
      },
      suitedBeatsUnsuited: {
        type: Boolean,
        default: false,
      },
      wildCards: {
        type: Boolean,
        default: false,
      },
    },
    wildCards: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const tablePlayerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    playerStatus: {
      type: String,
      default: "NO_STATUS",
      trim: true,
    },
    statusIcon: {
      type: String,
      default: "badge-no-status",
      trim: true,
    },
    referralCode: {
      type: String,
      default: "",
      trim: true,
    },
    seatNumber: {
      type: Number,
      required: true,
      min: 0,
    },
    chipsOnTable: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDealer: {
      type: Boolean,
      default: false,
    },
    isFolded: {
      type: Boolean,
      default: false,
    },
    isAllIn: {
      type: Boolean,
      default: false,
    },
    isConnected: {
      type: Boolean,
      default: true,
    },
    pendingRemoval: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);


const chatRoomLaunchContextSchema = new mongoose.Schema(
  {
    chatRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      default: null,
      index: true,
    },
    launchedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    invitedPlayerIds: {
      type: [String],
      default: [],
    },
    visibility: {
      type: String,
      default: "room",
      trim: true,
    },
    tableTier: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    rules: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    tableCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    launchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const gameTableSchema = new mongoose.Schema(
  {
    tableCode: {
      type: String,
      default: null,
      index: true,
      sparse: true,
      trim: true,
      unique: true,
      uppercase: true,
    },
    tableName: {
      type: String,
      required: true,
      trim: true,
    },
    gameType: {
      type: String,
      enum: SUPPORTED_GAME_TYPES,
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "active", "paused", "closed"],
      default: "waiting",
    },
    phase: {
      type: String,
      enum: POKER_PHASES,
      default: "waiting",
    },
    maxPlayers: {
      type: Number,
      default: function defaultMaxPlayers() {
        return resolveDefaultMaxPlayers(this.gameType);
      },
      min: 2,
      max: 10,
    },
    minPlayersToStart: {
      type: Number,
      default: 2,
      min: 2,
    },
    buyInAmount: {
      type: Number,
      default: 1000,
      min: 1,
    },
    maxBetClips: {
      type: Number,
      enum: ALLOWED_TABLE_TIER_CLIPS,
      default: DEFAULT_MAX_BET_CLIPS,
    },
    maxBetChips: {
      type: Number,
      default: DEFAULT_MAX_BET_CHIPS,
      min: 1,
    },
    ante: {
      type: Number,
      default: 0,
    },
    smallBlind: {
      type: Number,
      default: 0,
    },
    bigBlind: {
      type: Number,
      default: 0,
    },
    currentPot: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentTurnSeat: {
      type: Number,
      default: null,
    },
    currentTurnPlayerId: {
      type: String,
      default: null,
      trim: true,
    },
    handCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentHandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HandHistory",
      default: null,
    },
    currentHandSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    variantStateSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    gameSettings: {
      type: gameSettingsSchema,
      default: createDefaultGameSettings,
    },
    actionLog: {
      type: [String],
      default: [],
    },
    chatMessages: {
      type: [chatMessageSchema],
      default: [],
    },
    tableInvites: {
      type: [tableInviteSchema],
      default: [],
    },
    chatRoomLaunchContext: {
      type: chatRoomLaunchContextSchema,
      default: null,
    },
    players: {
      type: [tablePlayerSchema],
      default: [],
    },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastDealerPlayerId: {
      type: String,
      default: null,
      trim: true,
    },
    lastWinnerSummary: {
      type: String,
      default: null,
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GameTable", gameTableSchema);
module.exports.ALLOWED_TABLE_TIER_CLIPS = ALLOWED_TABLE_TIER_CLIPS;
module.exports.CLIP_TO_CHIP_RATE = CLIP_TO_CHIP_RATE;
module.exports.DEFAULT_MAX_BET_CHIPS = DEFAULT_MAX_BET_CHIPS;
module.exports.DEFAULT_MAX_BET_CLIPS = DEFAULT_MAX_BET_CLIPS;
