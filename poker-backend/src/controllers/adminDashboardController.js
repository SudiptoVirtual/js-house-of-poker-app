const User = require("../models/User");
const GameTable = require("../models/GameTable");
const Transaction = require("../models/Transaction");
const HandHistory = require("../models/HandHistory");

const getDashboardStats = async (req, res) => {
  try {
    const totalPlayers = await User.countDocuments();
    const activeTables = await GameTable.countDocuments({ status: "active" });
    const totalTables = await GameTable.countDocuments();

    const depositsAgg = await Transaction.aggregate([
      { $match: { type: "deposit", status: { $in: ["success", "approved"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const withdrawalsAgg = await Transaction.aggregate([
      { $match: { type: "withdrawal", status: { $in: ["success", "approved"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const pendingWithdrawals = await Transaction.countDocuments({
      type: "withdrawal",
      status: "pending",
    });

    const totalHands = await HandHistory.countDocuments();

    res.json({
      totalPlayers,
      totalTables,
      activeTables,
      totalDeposits: depositsAgg[0]?.total || 0,
      totalWithdrawals: withdrawalsAgg[0]?.total || 0,
      pendingWithdrawals,
      totalHands,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
};