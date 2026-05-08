const GameTable = require("../models/GameTable");
const GameEventLog = require("../models/GameEventLog");
const { getIO } = require("../sockets/socketRegistry");

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

const emitLiveTablesSnapshot = async () => {
  const io = getIO();
  if (!io) return;

  const tables = await GameTable.find({
    status: { $in: ["waiting", "active", "paused"] },
  })
    .populate("players.userId", "name email")
    .sort({ createdAt: -1 });

  const data = tables.map(buildTableSummary);

  io.to("admin-live-stats").emit("admin:live-stats", {
    message: "Live tables snapshot",
    count: data.length,
    tables: data,
    generatedAt: new Date(),
  });
};

const emitTableSnapshot = async (tableId) => {
  const io = getIO();
  if (!io) return;

  const table = await GameTable.findById(tableId).populate(
    "players.userId",
    "name email chips walletBalance status"
  );

  if (!table) return;

  const recentEvents = await GameEventLog.find({ tableId })
    .sort({ createdAt: -1 })
    .limit(20);

  io.to(`admin-table-${tableId}`).emit("admin:table-watch", {
    message: "Live table snapshot",
    table: buildTableSummary(table),
    recentEvents,
    generatedAt: new Date(),
  });
};

const logTableEvent = async ({
  tableId,
  eventType,
  message,
  payload = {},
  createdByType = "system",
  createdById = "",
}) => {
  if (!tableId) return;

  await GameEventLog.create({
    tableId,
    eventType,
    message,
    payload,
    createdByType,
    createdById,
  });

  await emitTableSnapshot(tableId);
  await emitLiveTablesSnapshot();
};

module.exports = {
  emitLiveTablesSnapshot,
  emitTableSnapshot,
  logTableEvent,
};