const { logTableEvent } = require("../utils/liveEmitter");
const GameTable = require("../models/GameTable");
const AuditLog = require("../models/AuditLog");

const allowedGameTypes = ["7/27", "55 Little Red", "357"];
const allowedStatuses = ["waiting", "active", "paused", "closed"];

const createTable = async (req, res) => {
  try {
    const {
      tableName,
      gameType,
      maxPlayers = 6,
      ante = 0,
      smallBlind = 0,
      bigBlind = 0,
      notes = "",
    } = req.body;

    if (!tableName || !gameType) {
      return res.status(400).json({
        message: "Table name and game type are required",
      });
    }

    if (!allowedGameTypes.includes(gameType)) {
      return res.status(400).json({
        message: "Invalid game type",
      });
    }

    const existingTable = await GameTable.findOne({
      tableName: tableName.trim(),
    });

    if (existingTable) {
      return res.status(409).json({
        message: "A table with this name already exists",
      });
    }

    const table = await GameTable.create({
      tableName: tableName.trim(),
      gameType,
      maxPlayers,
      ante,
      smallBlind,
      bigBlind,
      notes,
      createdByAdminId: req.admin._id,
    });

    await AuditLog.create({
      adminId: req.admin._id,
      action: "TABLE_CREATED",
      targetType: "GameTable",
      targetId: table._id.toString(),
      meta: {
        tableName: table.tableName,
        gameType: table.gameType,
      },
    });
	
	await logTableEvent({
	  tableId: table._id,
	  eventType: "TABLE_CREATED",
	  message: `Table ${table.tableName} created`,
	  payload: {
		tableName: table.tableName,
		gameType: table.gameType,
		status: table.status,
	  },
	  createdByType: "admin",
	  createdById: req.admin._id.toString(),
	});

    return res.status(201).json({
      message: "Table created successfully",
      table,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating table",
      error: error.message,
    });
  }
};

const getTables = async (req, res) => {
  try {
    const { search = "", status = "", gameType = "" } = req.query;

    const filter = {};

    if (search) {
      filter.tableName = { $regex: search, $options: "i" };
    }

    if (status) {
      filter.status = status;
    }

    if (gameType) {
      filter.gameType = gameType;
    }

    const tables = await GameTable.find(filter)
      .populate("players.userId", "name email")
      .populate("createdByAdminId", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Tables fetched successfully",
      count: tables.length,
      tables,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching tables",
      error: error.message,
    });
  }
};

const getTableById = async (req, res) => {
  try {
    const table = await GameTable.findById(req.params.id)
      .populate("players.userId", "name email chips walletBalance status")
      .populate("createdByAdminId", "name email role");

    if (!table) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    return res.status(200).json({
      table,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching table",
      error: error.message,
    });
  }
};

const updateTableStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Valid status is required: waiting, active, paused, closed",
      });
    }

    const table = await GameTable.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    const oldStatus = table.status;
    table.status = status;
    await table.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: "TABLE_STATUS_UPDATED",
      targetType: "GameTable",
      targetId: table._id.toString(),
      meta: {
        tableName: table.tableName,
        oldStatus,
        newStatus: status,
      },
    });
	
	await logTableEvent({
	  tableId: table._id,
	  eventType: "TABLE_CONFIG_UPDATED",
	  message: `Table ${table.tableName} configuration updated`,
	  payload: {
		oldConfig,
		newConfig: {
		  tableName: table.tableName,
		  gameType: table.gameType,
		  maxPlayers: table.maxPlayers,
		  ante: table.ante,
		  smallBlind: table.smallBlind,
		  bigBlind: table.bigBlind,
		  notes: table.notes,
		},
	  },
	  createdByType: "admin",
	  createdById: req.admin._id.toString(),
	});

    return res.status(200).json({
      message: "Table status updated successfully",
      table,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating table status",
      error: error.message,
    });
  }
};

const updateTableConfig = async (req, res) => {
  try {
    const {
      tableName,
      gameType,
      maxPlayers,
      ante,
      smallBlind,
      bigBlind,
      notes,
    } = req.body;

    const table = await GameTable.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    if (gameType && !allowedGameTypes.includes(gameType)) {
      return res.status(400).json({
        message: "Invalid game type",
      });
    }

    const oldConfig = {
      tableName: table.tableName,
      gameType: table.gameType,
      maxPlayers: table.maxPlayers,
      ante: table.ante,
      smallBlind: table.smallBlind,
      bigBlind: table.bigBlind,
      notes: table.notes,
    };

    if (tableName !== undefined) table.tableName = tableName.trim();
    if (gameType !== undefined) table.gameType = gameType;
    if (maxPlayers !== undefined) table.maxPlayers = maxPlayers;
    if (ante !== undefined) table.ante = ante;
    if (smallBlind !== undefined) table.smallBlind = smallBlind;
    if (bigBlind !== undefined) table.bigBlind = bigBlind;
    if (notes !== undefined) table.notes = notes;

    await table.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: "TABLE_CONFIG_UPDATED",
      targetType: "GameTable",
      targetId: table._id.toString(),
      meta: {
        tableName: table.tableName,
        oldConfig,
        newConfig: {
          tableName: table.tableName,
          gameType: table.gameType,
          maxPlayers: table.maxPlayers,
          ante: table.ante,
          smallBlind: table.smallBlind,
          bigBlind: table.bigBlind,
          notes: table.notes,
        },
      },
    });

    return res.status(200).json({
      message: "Table config updated successfully",
      table,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating table config",
      error: error.message,
    });
  }
};

const removePlayerFromTable = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "userId is required",
      });
    }

    const table = await GameTable.findById(req.params.id);

    if (!table) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    const existingPlayer = table.players.find(
      (player) => player.userId.toString() === userId
    );

    if (!existingPlayer) {
      return res.status(404).json({
        message: "Player not found on this table",
      });
    }

    table.players = table.players.filter(
      (player) => player.userId.toString() !== userId
    );

    await table.save();

    await AuditLog.create({
      adminId: req.admin._id,
      action: "TABLE_PLAYER_REMOVED",
      targetType: "GameTable",
      targetId: table._id.toString(),
      meta: {
        tableName: table.tableName,
        removedUserId: userId,
      },
    });
	
	await logTableEvent({
	  tableId: table._id,
	  eventType: "TABLE_PLAYER_REMOVED",
	  message: `Player removed from table ${table.tableName}`,
	  payload: {
		removedUserId: userId,
	  },
	  createdByType: "admin",
	  createdById: req.admin._id.toString(),
	});

    return res.status(200).json({
      message: "Player removed from table successfully",
      table,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error removing player from table",
      error: error.message,
    });
  }
};

module.exports = {
  createTable,
  getTables,
  getTableById,
  updateTableStatus,
  updateTableConfig,
  removePlayerFromTable,
};