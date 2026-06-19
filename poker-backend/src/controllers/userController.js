const User = require("../models/User");
const HandHistory = require("../models/HandHistory");
const { serializeUser } = require("../utils/userSerializer");
const { buildUserGameplayStats } = require("../utils/userStats");

const createTestUser = async (req, res) => {
  try {
    const testUser = await User.create({
      name: "Kapil Test User",
      email: `kapil${Date.now()}@example.com`,
      password: "123456",
      chips: 1000,
      walletBalance: 0,
    });

    res.status(201).json({
      message: "Test user created successfully",
      user: testUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating test user",
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    res.status(200).json({
      message: "Users fetched successfully",
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const gameplayStats = await buildUserGameplayStats(req.user._id);

    return res.status(200).json({
      user: serializeUser(req.user),
      gameplayStats,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

const getMyGameHistory = async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit || "20", 10);
    const limit = Math.min(100, Math.max(1, requestedLimit || 20));

    const hands = await HandHistory.find({
      "players.userId": req.user._id,
      status: "completed",
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate("tableId", "tableCode tableName gameType status");

    const userId = String(req.user._id);
    const records = hands.map((hand) => {
      const table = hand.tableId && typeof hand.tableId === "object" ? hand.tableId : null;
      const player = hand.players.find((item) => String(item.userId) === userId);
      const chipsDelta = player?.chipsDelta ?? player?.chipsWon ?? 0;
      const chipsWon = player?.chipsWon ?? Math.max(chipsDelta, 0);

      return {
        id: String(hand._id),
        tableId: table?._id ? String(table._id) : String(hand.tableId || ""),
        tableCode: hand.tableCode || table?.tableCode || "",
        tableName: hand.tableName || table?.tableName || "Poker table",
        handNumber: hand.handNumber,
        gameType: hand.gameType || table?.gameType || "Poker",
        completedAt: hand.completedAt,
        totalPot: hand.totalPot,
        result: player?.result || (chipsDelta > 0 ? "Won" : chipsDelta < 0 ? "Lost" : "Even"),
        chipsDelta,
        chipsWon,
        handDescription: player?.handDescription || "",
        winnerText: hand.winnerText || "",
      };
    });

    return res.status(200).json({
      count: records.length,
      records,
      hands: records,
      message: "Game history fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching game history",
      error: error.message,
    });
  }
};

const getMyActiveHand = async (req, res) => {
  try {
    const activeHand = await HandHistory.findOne({
      "players.userId": req.user._id,
      status: "in_progress",
    })
      .sort({ updatedAt: -1 })
      .populate("tableId", "tableCode tableName gameType status");

    return res.status(200).json({
      activeHand,
      message: "Active hand fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching active hand",
      error: error.message,
    });
  }
};

module.exports = {
  createTestUser,
  getAllUsers,
  getMyActiveHand,
  getMyGameHistory,
  getMyProfile,
};
