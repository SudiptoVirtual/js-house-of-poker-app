const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const {
  emitLiveTablesSnapshot,
  emitTableSnapshot,
} = require("../utils/liveEmitter");

const verifyAdminSocketToken = async (token) => {
  if (!token) {
    throw new Error("Admin token is required");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.type !== "admin") {
    throw new Error("Invalid admin token");
  }

  const admin = await Admin.findById(decoded.id).select(
    "_id name email role isActive"
  );

  if (!admin || !admin.isActive) {
    throw new Error("Admin not found or inactive");
  }

  return admin;
};

const initAdminLiveSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("admin:live-stats", async (payload = {}) => {
      try {
        const token = payload.token || socket.handshake.auth?.token;
        const admin = await verifyAdminSocketToken(token);

        socket.data.admin = admin;
        socket.join("admin-live-stats");

        await emitLiveTablesSnapshot();

        socket.emit("admin:live-stats:ack", {
          message: "Subscribed to live stats",
          admin: {
            id: admin._id,
            name: admin.name,
            role: admin.role,
          },
        });
      } catch (error) {
        socket.emit("admin:error", {
          message: error.message || "Unauthorized admin socket",
        });
      }
    });

    socket.on("admin:table-watch", async (payload = {}) => {
      try {
        const token = payload.token || socket.handshake.auth?.token;
        const { tableId } = payload;

        if (!tableId) {
          return socket.emit("admin:error", {
            message: "tableId is required",
          });
        }

        const admin = await verifyAdminSocketToken(token);

        socket.data.admin = admin;
        socket.join(`admin-table-${tableId}`);

        await emitTableSnapshot(tableId);

        socket.emit("admin:table-watch:ack", {
          message: "Subscribed to live table",
          tableId,
          admin: {
            id: admin._id,
            name: admin.name,
            role: admin.role,
          },
        });
      } catch (error) {
        socket.emit("admin:error", {
          message: error.message || "Unauthorized admin socket",
        });
      }
    });

    socket.on("admin:table-unwatch", (payload = {}) => {
      if (payload.tableId) {
        socket.leave(`admin-table-${payload.tableId}`);
      }
    });

    socket.on("admin:live-unsubscribe", () => {
      socket.leave("admin-live-stats");
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

module.exports = {
  initAdminLiveSocket,
};