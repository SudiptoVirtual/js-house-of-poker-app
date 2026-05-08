const TABLE_CHAT_HISTORY_LIMIT = 30;
const TABLE_CHAT_MESSAGE_CHAR_LIMIT = 160;

function createAcceptedModeration() {
  return {
    flags: [],
    reason: null,
    reviewedAt: null,
    status: 'accepted',
  };
}

function normalizeTableChatText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TABLE_CHAT_MESSAGE_CHAR_LIMIT);
}

function moderateTableChatMessage() {
  return createAcceptedModeration();
}

function appendTableChatMessage(room, input) {
  const text = normalizeTableChatText(input?.message ?? input?.text);
  if (!text) {
    throw new Error('Chat message cannot be empty.');
  }

  const moderation = moderateTableChatMessage({
    playerId: input?.playerId ?? null,
    roomId: room?.id ?? null,
    text,
  });
  if (moderation.status === 'blocked') {
    throw new Error(moderation.reason || 'Chat message was blocked.');
  }

  const createdAt = Date.now();
  const nextMessage = {
    createdAt,
    id: `chat-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    moderation,
    playerId: input?.playerId ?? null,
    playerName: String(input?.playerName ?? 'Player').trim().slice(0, 24) || 'Player',
    text,
    tone: input?.playerId ? 'player' : 'system',
  };

  room.chatMessages = [...(room.chatMessages ?? []), nextMessage].slice(
    -TABLE_CHAT_HISTORY_LIMIT,
  );

  return nextMessage;
}

module.exports = {
  appendTableChatMessage,
  createAcceptedModeration,
  moderateTableChatMessage,
  normalizeTableChatText,
  TABLE_CHAT_HISTORY_LIMIT,
  TABLE_CHAT_MESSAGE_CHAR_LIMIT,
};
