const TABLE_CHAT_HISTORY_LIMIT = 30;
const TABLE_CHAT_MESSAGE_CHAR_LIMIT = 160;
const TABLE_CHAT_USER_RATE_LIMIT = 5;
const TABLE_CHAT_USER_RATE_WINDOW_MS = 10_000;
const TABLE_CHAT_TABLE_RATE_LIMIT = 30;
const TABLE_CHAT_TABLE_RATE_WINDOW_MS = 60_000;
const TABLE_CHAT_MODERATION_LOG_LIMIT = 100;

const chatUserRateBuckets = new Map();
const chatTableRateBuckets = new Map();

const BLOCKED_CHAT_PATTERNS = [
  {
    flag: 'identity_hate_or_harassment',
    reason: 'Messages that attack protected classes are not allowed in table chat.',
    pattern: /\b(?:n[i1!]gg?(?:a|er)s?|f[a@]gg?(?:ot)?s?|k[i1!]kes?|sp[i1!]cs?|tr[a@]nn(?:y|ies)|r[e3]t[a@]rds?)\b/i,
  },
  {
    flag: 'threat_or_violent_abuse',
    reason: 'Threats or violent abuse are not allowed in table chat.',
    pattern: /\b(?:kill|murder|doxx?|swat|hunt down)\s+(?:you|ur|u|him|her|them)\b/i,
  },
  {
    flag: 'sexual_abuse',
    reason: 'Sexual harassment or abuse is not allowed in table chat.',
    pattern: /\b(?:rape|sexually assault)\s+(?:you|ur|u|him|her|them)\b/i,
  },
];

const FLAGGED_CHAT_PATTERNS = [
  {
    flag: 'profanity_or_abusive_language',
    reason: 'Message contains profanity or abusive language and requires moderation review.',
    pattern: /\b(?:fuck|shit|bitch|asshole|cunt|dickhead|motherfucker|bastard)\b/i,
  },
  {
    flag: 'targeted_harassment',
    reason: 'Message appears to target another player and requires moderation review.',
    pattern: /\b(?:idiot|moron|loser|trash|stupid)\b/i,
  },
];

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

function moderateTableChatMessage({ text } = {}) {
  const message = normalizeTableChatText(text);
  const blockedFlags = BLOCKED_CHAT_PATTERNS.filter(({ pattern }) => pattern.test(message));

  if (blockedFlags.length > 0) {
    return {
      flags: blockedFlags.map(({ flag }) => flag),
      reason: blockedFlags[0].reason,
      reviewedAt: null,
      status: 'blocked',
    };
  }

  const reviewFlags = FLAGGED_CHAT_PATTERNS.filter(({ pattern }) => pattern.test(message));

  if (reviewFlags.length > 0) {
    return {
      flags: reviewFlags.map(({ flag }) => flag),
      reason: reviewFlags[0].reason,
      reviewedAt: null,
      status: 'pending-review',
    };
  }

  return createAcceptedModeration();
}

function getChatRateRetrySeconds(retryAfterMs) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function registerChatRateLimitHit(bucketMap, key, now, limit, windowMs) {
  const previousHits = bucketMap.get(key) ?? [];
  const hits = previousHits.filter((timestamp) => now - timestamp < windowMs);

  if (hits.length >= limit) {
    return {
      allowed: false,
      retryAfterMs: windowMs - (now - hits[0]),
    };
  }

  hits.push(now);
  bucketMap.set(key, hits);
  return { allowed: true, retryAfterMs: 0 };
}

function enforceTableChatRateLimit(roomId, playerId) {
  const now = Date.now();
  const userLimit = registerChatRateLimitHit(
    chatUserRateBuckets,
    `${roomId}:${playerId}`,
    now,
    TABLE_CHAT_USER_RATE_LIMIT,
    TABLE_CHAT_USER_RATE_WINDOW_MS,
  );

  if (!userLimit.allowed) {
    throw new Error(
      `You are sending table chat messages too quickly. Please wait ${getChatRateRetrySeconds(
        userLimit.retryAfterMs,
      )} second(s) before sending another message.`,
    );
  }

  const tableLimit = registerChatRateLimitHit(
    chatTableRateBuckets,
    roomId,
    now,
    TABLE_CHAT_TABLE_RATE_LIMIT,
    TABLE_CHAT_TABLE_RATE_WINDOW_MS,
  );

  if (!tableLimit.allowed) {
    throw new Error(
      `This table is sending too many chat messages. Please wait ${getChatRateRetrySeconds(
        tableLimit.retryAfterMs,
      )} second(s) and try again.`,
    );
  }
}

function recordModerationLog(room, chatMessage, eventType) {
  const moderation = chatMessage.moderation ?? createAcceptedModeration();
  const entry = {
    chatMessageId: chatMessage.id,
    createdAt: Date.now(),
    eventType,
    flags: moderation.flags,
    moderationStatus: moderation.status,
    playerId: chatMessage.playerId,
    playerName: chatMessage.playerName,
    reason: moderation.reason,
    roomId: room?.id ?? null,
    text: chatMessage.text,
  };

  if (room) {
    room.chatModerationLog = [entry, ...(room.chatModerationLog ?? [])].slice(
      0,
      TABLE_CHAT_MODERATION_LOG_LIMIT,
    );
  }

  console.warn('Table chat moderation event', entry);
  return entry;
}

function appendTableChatMessage(room, input) {
  const text = normalizeTableChatText(input?.message ?? input?.text);
  if (!text) {
    throw new Error('Chat message cannot be empty.');
  }

  const playerId = input?.playerId ?? null;
  enforceTableChatRateLimit(room?.id ?? 'unknown-room', playerId ?? 'system');

  const createdAt = Date.now();
  const moderation = moderateTableChatMessage({
    playerId,
    roomId: room?.id ?? null,
    text,
  });
  const nextMessage = {
    createdAt,
    id: `chat-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    moderation,
    playerId,
    playerName: String(input?.playerName ?? 'Player').trim().slice(0, 24) || 'Player',
    text,
    tone: playerId ? 'player' : 'system',
  };

  if (moderation.status === 'blocked') {
    recordModerationLog(room, nextMessage, 'CHAT_MESSAGE_BLOCKED');
    throw new Error(
      moderation.reason || 'Your table chat message was blocked because it violates chat safety rules.',
    );
  }

  room.chatMessages = [...(room.chatMessages ?? []), nextMessage].slice(
    -TABLE_CHAT_HISTORY_LIMIT,
  );

  if (moderation.status === 'pending-review') {
    recordModerationLog(room, nextMessage, 'CHAT_MESSAGE_FLAGGED');
  }

  return nextMessage;
}

module.exports = {
  appendTableChatMessage,
  createAcceptedModeration,
  enforceTableChatRateLimit,
  moderateTableChatMessage,
  normalizeTableChatText,
  recordModerationLog,
  TABLE_CHAT_HISTORY_LIMIT,
  TABLE_CHAT_MESSAGE_CHAR_LIMIT,
};
