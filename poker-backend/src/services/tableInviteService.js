const mongoose = require("mongoose");

const GameTable = require("../models/GameTable");

function sanitizeName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeInviteMessage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return trimmed.length > 0 ? trimmed : null;
}

function resolveUserId(user) {
  return String(user?._id || user?.id || user?.userId || "").trim();
}

function buildTableInviteRecord({ message = null, recipient, sender, source = "chat-room" }) {
  const recipientId = resolveUserId(recipient);
  const recipientName = sanitizeName(
    recipient?.name || recipient?.displayName || recipient?.email || recipientId
  ) || recipientId;
  const senderId = resolveUserId(sender);
  const senderName = sanitizeName(
    sender?.name || sender?.displayName || sender?.email || "Player"
  ) || "Player";

  return {
    createdAt: Date.now(),
    giftBuyInChips: 0,
    giftBuyInClips: 0,
    id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message: normalizeInviteMessage(message),
    recipientAccountId: recipientId,
    recipientHandle: recipient?.handle || recipient?.username || recipientName,
    recipientLabel: recipientName,
    senderPlayerId: senderId,
    senderPlayerName: senderName,
    source,
    status: "pending",
  };
}

function buildTableIdentifiers(tableId) {
  const normalizedTableId = String(tableId || "").trim();
  const identifiers = [];

  if (normalizedTableId) {
    identifiers.push({ tableCode: normalizedTableId.toUpperCase() });
    if (mongoose.Types.ObjectId.isValid(normalizedTableId)) {
      identifiers.push({ _id: normalizedTableId });
    }
  }

  return identifiers;
}

function ensureSenderCanInviteToTable(table, sender) {
  const senderUserId = resolveUserId(sender);
  const tablePlayerIds = new Set((table.players || []).map((player) => String(player.userId)));
  const hasTableAccess =
    String(table.createdByUserId || "") === senderUserId ||
    String(table.hostUserId || "") === senderUserId ||
    tablePlayerIds.has(senderUserId);

  if (!hasTableAccess) {
    throw new Error("You are not allowed to invite players to this table.");
  }
}

function ensureTableCanReceiveInvites(table) {
  const tableStatus = String(table.status || "").toLowerCase();
  const tablePhase = String(table.phase || "").toLowerCase();
  if (tableStatus === "closed" || tablePhase === "completed") {
    throw new Error("Table is closed or completed.");
  }
}

function serializeInviteTable(table) {
  return {
    id: table.tableCode || String(table._id),
    tableCode: table.tableCode || null,
    tableDbId: String(table._id),
    tableId: table.tableCode || String(table._id),
    tableName: table.tableName,
  };
}

async function appendTableInviteRecords({
  message = null,
  onTableInvitesUpdated = null,
  recipients = [],
  sender,
  source = "chat-room",
  table = null,
  tableId,
}) {
  if (!sender) {
    throw new Error("Invite sender is required.");
  }

  const identifiers = buildTableIdentifiers(tableId);
  if (!table && identifiers.length === 0) {
    throw new Error("Table id is required.");
  }

  const targetTable = table || await GameTable.findOne({ $or: identifiers });
  if (!targetTable) {
    throw new Error("Table not found.");
  }

  ensureTableCanReceiveInvites(targetTable);
  ensureSenderCanInviteToTable(targetTable, sender);

  const inviteRecords = recipients.map((recipient) =>
    buildTableInviteRecord({ message, recipient, sender, source })
  );

  targetTable.tableInvites = [...inviteRecords, ...(targetTable.tableInvites || [])].slice(0, 50);
  await targetTable.save();

  if (typeof onTableInvitesUpdated === "function") {
    await onTableInvitesUpdated(targetTable);
  }

  return {
    invites: inviteRecords,
    table: serializeInviteTable(targetTable),
  };
}

module.exports = {
  appendTableInviteRecords,
  buildTableIdentifiers,
  buildTableInviteRecord,
  ensureSenderCanInviteToTable,
  ensureTableCanReceiveInvites,
  normalizeInviteMessage,
  serializeInviteTable,
};
