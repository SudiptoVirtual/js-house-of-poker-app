const mongoose = require("mongoose");

const ChatRoom = require("../models/ChatRoom");
const Notification = require("../models/Notification");
const User = require("../models/User");

const NOTIFICATION_TYPES = new Set(Notification.NOTIFICATION_TYPES || []);

function normalizeObjectIdString(value) {
  const normalized = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : null;
}

function uniqueObjectIdStrings(values = []) {
  return [
    ...new Set(
      values
        .map(normalizeObjectIdString)
        .filter(Boolean)
    ),
  ];
}

function getDisplayName(user) {
  return user?.name || user?.email || "Player";
}

function stringifyOptionalId(value) {
  return value ? String(value) : null;
}

function trimBody(value, limit = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function getRoomMemberIds(room, presenceSnapshot = {}) {
  const memberIds = new Set(
    (room.participantStates || [])
      .map((state) => normalizeObjectIdString(state.userId))
      .filter(Boolean)
  );

  (presenceSnapshot.players || []).forEach((player) => {
    const playerId = normalizeObjectIdString(player.userId || player.id);
    if (playerId) {
      memberIds.add(playerId);
    }
  });

  return [...memberIds];
}

function getMentionTokens(text) {
  const tokens = new Set();
  const matcher = /@([a-z0-9_.-]{2,40})/gi;
  let match = matcher.exec(text || "");

  while (match) {
    tokens.add(match[1].toLowerCase());
    match = matcher.exec(text || "");
  }

  return tokens;
}

function userMatchesMention(user, mentionTokens) {
  if (!user || mentionTokens.size === 0) {
    return false;
  }

  const aliases = [user.handle, user.username, user.name, user.email]
    .filter(Boolean)
    .flatMap((value) => {
      const normalized = String(value).toLowerCase();
      return [normalized, normalized.split("@")[0], normalized.replace(/\s+/g, "")];
    });

  return aliases.some((alias) => mentionTokens.has(alias));
}

async function getMentionedRecipientIds({ candidateUserIds = [], text = "" } = {}) {
  const mentionTokens = getMentionTokens(text);

  if (mentionTokens.size === 0 || candidateUserIds.length === 0) {
    return [];
  }

  const users = await User.find({ _id: { $in: uniqueObjectIdStrings(candidateUserIds) } }).select(
    "email handle name username"
  );

  return users
    .filter((user) => userMatchesMention(user, mentionTokens))
    .map((user) => String(user._id));
}

async function incrementParticipantUnreadCounts(chatRoomId, userIds = []) {
  const recipientIds = uniqueObjectIdStrings(userIds);

  if (!chatRoomId || recipientIds.length === 0) {
    return;
  }

  await ChatRoom.updateOne(
    { _id: chatRoomId },
    {
      $inc: { "participantStates.$[participant].unreadCount": 1 },
    },
    {
      arrayFilters: [{ "participant.userId": { $in: recipientIds } }],
    }
  );

  const room = await ChatRoom.findById(chatRoomId).select("participantStates");
  const existingIds = new Set(
    (room?.participantStates || []).map((state) => String(state.userId))
  );
  const missingStates = recipientIds
    .filter((userId) => !existingIds.has(userId))
    .map((userId) => ({ lastSeenAt: null, unreadCount: 1, userId }));

  if (missingStates.length > 0) {
    await ChatRoom.updateOne(
      { _id: chatRoomId },
      { $push: { participantStates: { $each: missingStates } } }
    );
  }
}

async function createNotifications({
  actorUserId = null,
  body = "",
  chatRoomId = null,
  data = {},
  messageId = null,
  recipientUserIds = [],
  skipRoomUnreadIncrement = false,
  tableId = null,
  title = "",
  type,
} = {}) {
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`Unsupported notification type: ${type}`);
  }

  const recipients = uniqueObjectIdStrings(recipientUserIds).filter(
    (userId) => !actorUserId || String(userId) !== String(actorUserId)
  );

  if (recipients.length === 0) {
    return [];
  }

  const docs = await Notification.insertMany(
    recipients.map((userId) => ({
      actorUserId: normalizeObjectIdString(actorUserId),
      body: trimBody(body),
      chatRoomId: normalizeObjectIdString(chatRoomId),
      data,
      messageId: normalizeObjectIdString(messageId),
      tableId: normalizeObjectIdString(tableId),
      title: trimBody(title, 160),
      type,
      userId,
    })),
    { ordered: false }
  );

  if (chatRoomId && !skipRoomUnreadIncrement) {
    await incrementParticipantUnreadCounts(chatRoomId, recipients);
  }

  return docs;
}

async function createMessageNotifications({ message, room, sender, presenceSnapshot }) {
  const senderUserId = String(sender._id || message.senderUserId);
  const recipientUserIds = getRoomMemberIds(room, presenceSnapshot).filter(
    (userId) => userId !== senderUserId
  );
  const mentionedUserIds = await getMentionedRecipientIds({
    candidateUserIds: recipientUserIds,
    text: message.text,
  });
  const mentionRecipientSet = new Set(mentionedUserIds);
  const body = `${getDisplayName(sender)}: ${message.text}`;

  const chatNotifications = await createNotifications({
    actorUserId: senderUserId,
    body,
    chatRoomId: room._id,
    data: {
      roomName: room.name,
      senderDisplayName: getDisplayName(sender),
    },
    messageId: message._id,
    recipientUserIds: recipientUserIds.filter((userId) => !mentionRecipientSet.has(userId)),
    skipRoomUnreadIncrement: true,
    title: room.name ? `New message in ${room.name}` : "New chat message",
    type: "chat_message",
  });

  const mentionNotifications = await createNotifications({
    actorUserId: senderUserId,
    body,
    chatRoomId: room._id,
    data: {
      roomName: room.name,
      senderDisplayName: getDisplayName(sender),
    },
    messageId: message._id,
    recipientUserIds: mentionedUserIds,
    skipRoomUnreadIncrement: true,
    title: room.name ? `Mentioned in ${room.name}` : "You were mentioned",
    type: "mention",
  });

  return [...chatNotifications, ...mentionNotifications];
}

async function createChatRoomGiftClipNotifications({
  amount = null,
  message,
  recipientUserId = null,
  room,
  sender,
  transactionIds = null,
} = {}) {
  const senderUserId = sender?._id || message?.senderUserId;
  const chatRoomId = room?._id || message?.roomId;
  const messageId = message?._id;
  const giftClip = message?.giftClip || {};
  const resolvedAmount = Number.parseInt(amount ?? giftClip.amount ?? 0, 10) || 0;
  const resolvedRecipientUserId = recipientUserId || giftClip.recipientUserId;
  const normalizedSenderUserId = normalizeObjectIdString(senderUserId);
  const normalizedRecipientUserId = normalizeObjectIdString(resolvedRecipientUserId);
  const normalizedChatRoomId = normalizeObjectIdString(chatRoomId);
  const normalizedMessageId = normalizeObjectIdString(messageId);
  const roomName = room?.name || null;
  const senderDisplayName = getDisplayName(
    sender || {
      email: message?.senderDisplayName,
      name: message?.senderDisplayName,
    }
  );

  return createNotifications({
    actorUserId: normalizedSenderUserId,
    body: `${senderDisplayName} sent you ${resolvedAmount} Gift Clips${roomName ? ` in ${roomName}` : ""}.`,
    chatRoomId: normalizedChatRoomId,
    data: {
      amount: resolvedAmount,
      chatRoomId: normalizedChatRoomId,
      message: giftClip.message || message?.text || "",
      messageId: normalizedMessageId,
      recipientUserId: normalizedRecipientUserId,
      roomName,
      senderDisplayName,
      senderUserId: normalizedSenderUserId,
      transactionIds: transactionIds || giftClip.transactionIds || {
        recipient: stringifyOptionalId(giftClip.recipientTransactionId),
        sender: stringifyOptionalId(giftClip.senderTransactionId || giftClip.transactionId),
      },
      type: "chat_room_gift_clip",
    },
    messageId: normalizedMessageId,
    recipientUserIds: [normalizedRecipientUserId],
    title: "Gift Clips received",
    type: "chat_room_gift_clip",
  });
}

async function createChatRoomInviteNotifications({ recipientUserIds = [], room, sender }) {
  return createNotifications({
    actorUserId: sender._id,
    body: `${getDisplayName(sender)} invited you to ${room.name || "a chat room"}.`,
    chatRoomId: room._id,
    data: {
      roomName: room.name,
      senderDisplayName: getDisplayName(sender),
    },
    recipientUserIds,
    title: "Chat room invite",
    type: "chat_room_invite",
  });
}

async function createTableInviteNotifications({ chatRoom, inviteRecords = [], sender, table }) {
  return createNotifications({
    actorUserId: sender._id,
    body: `${getDisplayName(sender)} invited you to ${table.tableName || "a poker table"}.`,
    chatRoomId: chatRoom._id,
    data: {
      invites: inviteRecords.map((invite) => ({
        id: invite.id,
        message: invite.message || null,
        recipientAccountId: invite.recipientAccountId,
        status: invite.status,
      })),
      senderDisplayName: getDisplayName(sender),
      tableCode: table.tableCode,
      tableName: table.tableName,
    },
    recipientUserIds: inviteRecords.map((invite) => invite.recipientAccountId),
    tableId: table.tableDbId,
    title: "Table invite",
    type: "table_invite",
  });
}

async function createTableLaunchNotifications({ chatRoom, invitedPlayerIds = [], launchPayload, presenceSnapshot, user }) {
  const roomMemberIds = getRoomMemberIds(chatRoom, presenceSnapshot);
  const recipientUserIds = uniqueObjectIdStrings([...roomMemberIds, ...invitedPlayerIds]).filter(
    (userId) => userId !== String(user._id)
  );

  return createNotifications({
    actorUserId: user._id,
    body: `${getDisplayName(user)} launched ${launchPayload.tableName || "a table"} from ${chatRoom.name}.`,
    chatRoomId: chatRoom._id,
    data: {
      launchedAt: launchPayload.launchedAt,
      roomName: chatRoom.name,
      senderDisplayName: getDisplayName(user),
      tableCode: launchPayload.tableCode,
      tableName: launchPayload.tableName,
    },
    recipientUserIds,
    tableId: launchPayload.tableDbId,
    title: "Table launched",
    type: "table_launched_from_chat",
  });
}

async function markRoomNotificationsRead({ chatRoomId, userId, readAt = new Date() } = {}) {
  const normalizedRoomId = normalizeObjectIdString(chatRoomId);
  const normalizedUserId = normalizeObjectIdString(userId);

  if (!normalizedRoomId || !normalizedUserId) {
    return { matchedCount: 0, modifiedCount: 0, readAt };
  }

  const result = await Notification.updateMany(
    { chatRoomId: normalizedRoomId, readAt: null, type: "chat_message", userId: normalizedUserId },
    { $set: { readAt } }
  );

  await ChatRoom.updateOne(
    { _id: normalizedRoomId, "participantStates.userId": normalizedUserId },
    {
      $set: {
        "participantStates.$.lastReadAt": readAt,
        "participantStates.$.lastSeenAt": readAt,
        "participantStates.$.unreadCount": 0,
      },
    }
  );

  return {
    matchedCount: result.matchedCount || result.n || 0,
    modifiedCount: result.modifiedCount || result.nModified || 0,
    readAt,
  };
}

async function getUnreadCountsByRoom(userId, roomIds = []) {
  const normalizedUserId = normalizeObjectIdString(userId);
  const normalizedRoomIds = uniqueObjectIdStrings(roomIds);

  if (!normalizedUserId || normalizedRoomIds.length === 0) {
    return new Map();
  }

  const counts = await Notification.aggregate([
    {
      $match: {
        chatRoomId: { $in: normalizedRoomIds.map((roomId) => new mongoose.Types.ObjectId(roomId)) },
        readAt: null,
        type: "chat_message",
        userId: new mongoose.Types.ObjectId(normalizedUserId),
      },
    },
    { $group: { _id: "$chatRoomId", unreadCount: { $sum: 1 } } },
  ]);

  return new Map(counts.map((count) => [String(count._id), count.unreadCount]));
}

function serializeNotification(notification) {
  return typeof notification.toClient === "function"
    ? notification.toClient()
    : {
        ...notification,
        id: String(notification._id || notification.id),
        actorUserId: notification.actorUserId ? String(notification.actorUserId) : null,
        chatRoomId: notification.chatRoomId ? String(notification.chatRoomId) : null,
        messageId: notification.messageId ? String(notification.messageId) : null,
        tableId: notification.tableId ? String(notification.tableId) : null,
        userId: notification.userId ? String(notification.userId) : null,
      };
}

module.exports = {
  createChatRoomGiftClipNotifications,
  createChatRoomInviteNotifications,
  createMessageNotifications,
  createNotifications,
  createTableInviteNotifications,
  createTableLaunchNotifications,
  getRoomMemberIds,
  getUnreadCountsByRoom,
  markRoomNotificationsRead,
  serializeNotification,
};
