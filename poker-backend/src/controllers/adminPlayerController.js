const User = require("../models/User");
const HandHistory = require("../models/HandHistory");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");

const getPlayers = async (req, res) => {
  try {
    const { search = "", status = "" } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    const players = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Players fetched successfully",
      count: players.length,
      players,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching players",
      error: error.message,
    });
  }
};

const getPlayerById = async (req, res) => {
  try {
    const player = await User.findById(req.params.id).select("-password");

    if (!player) {
      return res.status(404).json({
        message: "Player not found",
      });
    }

    return res.status(200).json({
      player,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching player",
      error: error.message,
    });
  }
};

const updatePlayerStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["active", "blocked", "suspended"];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Valid status is required: active, blocked, suspended",
      });
    }

    const player = await User.findById(req.params.id);

    if (!player) {
      return res.status(404).json({
        message: "Player not found",
      });
    }

    player.status = status;
    player.isBlocked = status === "blocked";
    await player.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: "PLAYER_STATUS_UPDATED",
      targetType: "User",
      targetId: player._id.toString(),
      meta: {
        playerEmail: player.email,
        newStatus: status,
      },
    });

    return res.status(200).json({
      message: "Player status updated successfully",
      player: {
        id: player._id,
        name: player.name,
        email: player.email,
        status: player.status,
        isBlocked: player.isBlocked,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating player status",
      error: error.message,
    });
  }
};

const updatePlayerChips = async (req, res) => {
  try {
    const { action, amount } = req.body;

    if (!action || !["add", "subtract", "set"].includes(action)) {
      return res.status(400).json({
        message: "Action must be add, subtract, or set",
      });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({
        message: "Valid amount is required",
      });
    }

    const player = await User.findById(req.params.id);

    if (!player) {
      return res.status(404).json({
        message: "Player not found",
      });
    }

    const oldChips = player.chips;

    if (action === "add") {
      player.chips += numericAmount;
    } else if (action === "subtract") {
      player.chips = Math.max(0, player.chips - numericAmount);
    } else if (action === "set") {
      player.chips = numericAmount;
    }

    await player.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: "PLAYER_CHIPS_UPDATED",
      targetType: "User",
      targetId: player._id.toString(),
      meta: {
        playerEmail: player.email,
        action,
        oldChips,
        newChips: player.chips,
        amount: numericAmount,
      },
    });

    return res.status(200).json({
      message: "Player chips updated successfully",
      player: {
        id: player._id,
        name: player.name,
        email: player.email,
        chips: player.chips,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating player chips",
      error: error.message,
    });
  }
};

const getPlayerHands = async (req, res) => {
  try {
    const hands = await HandHistory.find({
      "players.userId": req.params.id,
    })
      .sort({ createdAt: -1 })
      .populate("tableId", "tableName gameType status");

    return res.status(200).json({
      message: "Player hands fetched successfully",
      count: hands.length,
      hands,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching player hands",
      error: error.message,
    });
  }
};

const getPlayerTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.params.id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Player transactions fetched successfully",
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching player transactions",
      error: error.message,
    });
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
  updatePlayerStatus,
  updatePlayerChips,
  getPlayerHands,
  getPlayerTransactions,
};