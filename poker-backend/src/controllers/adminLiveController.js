const GameTable = require("../models/GameTable");
const GameEventLog = require("../models/GameEventLog");

const buildTableSummary = (table) => {
  const playerCount = table.players.length;
  const foldedCount = table.players.filter((p) => p.isFolded).length;
  const allInCount = table.players.filter((p) => p.isAllIn).length;

  return {
    id: table._id,
    tableName: table.tableName,
    gameType: table.gameType,
    status: table.status,
    maxPlayers: table.maxPlayers,
    currentPot: table.currentPot,
    currentTurnSeat: table.currentTurnSeat,
    playerCount,
    foldedCount,
    allInCount,
    players: table.players.map((player) => ({
      userId: player.userId?._id || player.userId,
      name: player.userId?.name || "",
      email: player.userId?.email || "",
      seatNumber: player.seatNumber,
      chipsOnTable: player.chipsOnTable,
      isDealer: player.isDealer,
      isFolded: player.isFolded,
      isAllIn: player.isAllIn,
    })),
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
};

const getLiveTables = async (req, res) => {
  try {
    const { status = "", gameType = "", search = "" } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (gameType) filter.gameType = gameType;
    if (search) {
      filter.tableName = { $regex: search, $options: "i" };
    }

    const tables = await GameTable.find(filter)
      .populate("players.userId", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Live tables fetched successfully",
      count: tables.length,
      tables: tables.map(buildTableSummary),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching live tables",
      error: error.message,
    });
  }
};

const getLiveTableById = async (req, res) => {
  try {
    const table = await GameTable.findById(req.params.id).populate(
      "players.userId",
      "name email chips walletBalance status"
    );

    if (!table) {
      return res.status(404).json({
        message: "Live table not found",
      });
    }

    const recentEvents = await GameEventLog.find({
      tableId: table._id,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      message: "Live table fetched successfully",
      table: buildTableSummary(table),
      recentEvents,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching live table",
      error: error.message,
    });
  }
};

module.exports = {
  getLiveTables,
  getLiveTableById,
};