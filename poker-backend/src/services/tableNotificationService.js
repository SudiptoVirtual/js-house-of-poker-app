const mongoose = require("mongoose");

const Notification = require("../models/Notification");

const NOTIFICATION_TYPES = new Set(Notification.NOTIFICATION_TYPES || []);

function normalizeObjectIdString(value) {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
}

function trimBody(value, limit = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getDisplayName(user) {
  return user?.name || user?.email || "Player";
}

function buildActorDetails(actor = {}) {
  const actorId = normalizeObjectIdString(actor._id || actor.id || actor.userId);

  return {
    avatarUrl: actor.avatar || actor.avatarUrl || "",
    displayName: getDisplayName(actor),
    id: actorId,
    name: getDisplayName(actor),
    userId: actorId,
  };
}

function buildTableData(table = {}) {
  const tableCode = String(table.tableCode || table.roomId || table.id || "").trim().toUpperCase();
  const tableId = normalizeObjectIdString(table._id || table.tableDbId || table.tableId);
  const tableName = String(table.tableName || table.name || tableCode || tableId || "table").trim();

  return {
    tableCode: tableCode || null,
    tableId: tableCode || tableId,
    tableDbId: tableId,
    tableName,
  };
}

async function createTablePlayerJoinedNotification({ actor, recipientUserId, table } = {}) {
  if (!NOTIFICATION_TYPES.has("table_player_joined")) {
    throw new Error("Unsupported notification type: table_player_joined");
  }

  const actorUserId = normalizeObjectIdString(actor?._id || actor?.id || actor?.userId);
  const userId = normalizeObjectIdString(recipientUserId);
  const tableId = normalizeObjectIdString(table?._id || table?.tableDbId || table?.tableId);

  if (!userId || !actorUserId || userId === actorUserId) {
    return null;
  }

  const actorName = getDisplayName(actor);
  const tableData = buildTableData(table);
  const tableName = tableData.tableName || "your table";

  return Notification.create({
    actorUserId,
    body: trimBody(`${actorName} joined ${tableName}.`),
    data: {
      actor: buildActorDetails(actor),
      actorDisplayName: actorName,
      table: tableData,
      tableCode: tableData.tableCode,
      tableId: tableData.tableId,
      tableName,
    },
    tableId,
    title: "Player joined your table",
    type: "table_player_joined",
    userId,
  });
}

function serializeNotification(notification) {
  return typeof notification?.toClient === "function"
    ? notification.toClient()
    : {
        ...notification,
        id: String(notification?._id || notification?.id),
        actorUserId: notification?.actorUserId ? String(notification.actorUserId) : null,
        tableId: notification?.tableId ? String(notification.tableId) : null,
        userId: notification?.userId ? String(notification.userId) : null,
      };
}

function emitTableNotificationRecords(io, notificationRecords = []) {
  const notifications = notificationRecords.filter(Boolean).map(serializeNotification);

  notifications.forEach((notification) => {
    const payload = {
      notification,
      preview: notification.body,
      tableId: notification.tableId || notification.data?.tableId || null,
      type: notification.type,
      unreadCount: 1,
    };

    io?.sockets?.sockets?.forEach((candidateSocket) => {
      const userId = candidateSocket.data?.userId;

      if (userId && String(userId) === String(notification.userId)) {
        candidateSocket.emit("table:notification", payload);
        candidateSocket.emit("notification:new", payload);
      }
    });
  });

  return notifications;
}

module.exports = {
  buildTableData,
  createTablePlayerJoinedNotification,
  emitTableNotificationRecords,
  serializeNotification,
};
