const crypto = require("crypto");
const GameTable = require("../models/GameTable");

const DEFAULT_SCAN_INTERVAL_MS = 30_000;
const DEFAULT_MIN_ACTIVE_TABLES = 3;
const DEFAULT_BOT_STACK = 2_000;
const DEFAULT_BOTS_PER_TABLE = 4;
const DEFAULT_TABLE_PREFIX = "TRAIN";

const BOT_PERSONALITY_ROTATION = [
  "tight-aggressive",
  "loose-aggressive",
  "tight-passive",
  "balanced",
  "bluffer",
];

const BEGINNER_STAGES = [
  { key: "ONBOARDING", minHands: 0, recommendation: "Start with the beginner tutorial and table controls walk-through." },
  { key: "BASICS", minHands: 10, recommendation: "Focus on pre-flop hand selection drills and blind position practice." },
  { key: "INTERMEDIATE", minHands: 50, recommendation: "Try strategy tables with mixed bot styles to improve adaptation." },
  { key: "ADVANCED", minHands: 150, recommendation: "Review hand history and play advanced mixed-style training tables." },
];

class BotTableManager {
  constructor(options = {}) {
    this.minActiveTables = Number(options.minActiveTables || process.env.BOT_TRAINING_MIN_TABLES || DEFAULT_MIN_ACTIVE_TABLES);
    this.scanIntervalMs = Number(options.scanIntervalMs || process.env.BOT_TRAINING_SCAN_INTERVAL_MS || DEFAULT_SCAN_INTERVAL_MS);
    this.defaultBuyIn = Number(options.defaultBuyIn || process.env.BOT_TRAINING_BUY_IN || DEFAULT_BOT_STACK);
    this.botsPerTable = Number(options.botsPerTable || process.env.BOT_TRAINING_BOTS_PER_TABLE || DEFAULT_BOTS_PER_TABLE);
    this.tablePrefix = options.tablePrefix || process.env.BOT_TRAINING_TABLE_PREFIX || DEFAULT_TABLE_PREFIX;

    this.activeTrainingTables = new Map();
    this.beginnerProgression = new Map();
    this.rotationIndex = 0;
    this.intervalId = null;
  }

  async start() {
    if (this.intervalId) {
      return;
    }

    await this.reconcileTrainingTables();
    this.intervalId = setInterval(() => {
      this.reconcileTrainingTables().catch((error) => {
        console.error("[BotTableManager] reconcile failed", error);
      });
    }, this.scanIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getActiveTables() {
    return [...this.activeTrainingTables.values()];
  }

  getBeginnerProgression(userId) {
    return this.beginnerProgression.get(String(userId)) || null;
  }

  trackBeginnerProgression(userId, handDelta = 1) {
    const key = String(userId);
    const current = this.beginnerProgression.get(key) || { handsPlayed: 0, stage: BEGINNER_STAGES[0].key };
    const handsPlayed = Math.max(0, current.handsPlayed + Number(handDelta || 0));
    const stage = this.resolveStageByHands(handsPlayed);
    const updated = { userId: key, handsPlayed, stage, updatedAt: new Date() };
    this.beginnerProgression.set(key, updated);
    return updated;
  }

  recommendTrainingContent(userId) {
    const progression = this.getBeginnerProgression(userId) || this.trackBeginnerProgression(userId, 0);
    const stage = BEGINNER_STAGES.find((item) => item.key === progression.stage) || BEGINNER_STAGES[0];

    return {
      userId: progression.userId,
      stage: stage.key,
      recommendation: stage.recommendation,
      suggestedTableStyles: this.getSuggestedStylesForStage(stage.key),
    };
  }

  async reconcileTrainingTables() {
    const active = await GameTable.find({ status: { $in: ["waiting", "active"] }, notes: /training-bot-table/i }).lean();
    this.activeTrainingTables = new Map(active.map((table) => [table._id.toString(), table]));

    await this.refillEmptyTables(active);
    await this.ensureMinimumTableCount();
  }

  async ensureMinimumTableCount() {
    const deficit = Math.max(0, this.minActiveTables - this.activeTrainingTables.size);
    if (!deficit) {
      return;
    }

    for (let idx = 0; idx < deficit; idx += 1) {
      const table = await this.createTrainingTable();
      this.activeTrainingTables.set(table._id.toString(), table.toObject());
    }
  }

  async refillEmptyTables(tables) {
    const refillOps = tables
      .filter((table) => Array.isArray(table.players) && table.players.length === 0)
      .map((table) => this.autoSeatBots(table));

    await Promise.all(refillOps);
  }

  async autoSeatBots(table) {
    const personalities = this.nextPersonalities(this.botsPerTable);
    const players = personalities.map((personality, seatNumber) => ({
      playerId: `bot-${table.tableCode || table._id}-${seatNumber}`,
      name: `Bot ${personality}`,
      chips: this.defaultBuyIn,
      chipsOnTable: this.defaultBuyIn,
      seatNumber,
      isDealer: seatNumber === 0,
      isFolded: false,
      isAllIn: false,
      isConnected: true,
      pendingRemoval: false,
      avatarUrl: "",
    }));

    await GameTable.updateOne(
      { _id: table._id },
      {
        $set: {
          players,
          status: "waiting",
          notes: "training-bot-table",
        },
      }
    );
  }

  async createTrainingTable() {
    const tableCode = `${this.tablePrefix}${crypto.randomInt(1000, 9999)}`;
    const table = await GameTable.create({
      tableCode,
      tableName: `Training Table ${tableCode}`,
      gameType: "holdem",
      status: "waiting",
      buyInAmount: this.defaultBuyIn,
      notes: "training-bot-table",
      players: [],
    });

    await this.autoSeatBots(table);
    return table;
  }

  nextPersonalities(count) {
    const selected = [];
    for (let idx = 0; idx < count; idx += 1) {
      const personality = BOT_PERSONALITY_ROTATION[this.rotationIndex % BOT_PERSONALITY_ROTATION.length];
      selected.push(personality);
      this.rotationIndex += 1;
    }

    return selected;
  }

  resolveStageByHands(handsPlayed) {
    let stage = BEGINNER_STAGES[0].key;

    for (const candidate of BEGINNER_STAGES) {
      if (handsPlayed >= candidate.minHands) {
        stage = candidate.key;
      }
    }

    return stage;
  }

  getSuggestedStylesForStage(stage) {
    switch (stage) {
      case "ONBOARDING":
        return ["tight-passive", "balanced"];
      case "BASICS":
        return ["tight-aggressive", "balanced"];
      case "INTERMEDIATE":
        return ["loose-aggressive", "bluffer", "balanced"];
      case "ADVANCED":
      default:
        return [...BOT_PERSONALITY_ROTATION];
    }
  }
}

module.exports = new BotTableManager();
module.exports.BotTableManager = BotTableManager;
