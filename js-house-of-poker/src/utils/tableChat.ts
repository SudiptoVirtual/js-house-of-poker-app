import type {
  PokerTableChatMessage,
  PokerTableChatModerationState,
} from '../types/poker';

export const TABLE_CHAT_HISTORY_LIMIT = 30;
export const TABLE_CHAT_MESSAGE_CHAR_LIMIT = 160;
export const TABLE_CHAT_EMOJI_OPTIONS = ['🔥', '😂', '👏', '🃏', '😈', '🎉', '💸', '😅'] as const;

type CreateLocalTableChatMessageInput = {
  createdAt?: number;
  id?: string;
  playerId: string | null;
  playerName: string;
  text: string;
  tone?: PokerTableChatMessage['tone'];
};

function trimPlayerName(value: string) {
  return value.trim().slice(0, 24);
}

export function createAcceptedTableChatModerationState(): PokerTableChatModerationState {
  return {
    flags: [],
    reason: null,
    reviewedAt: null,
    status: 'accepted',
  };
}

export function normalizeTableChatText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, TABLE_CHAT_MESSAGE_CHAR_LIMIT);
}

export function getVisibleTableChatMessages(
  messages: PokerTableChatMessage[],
  limit = 3,
) {
  return messages.slice(-limit);
}

export function appendTableChatMessage(
  messages: PokerTableChatMessage[],
  nextMessage: PokerTableChatMessage,
) {
  return [...messages, nextMessage].slice(-TABLE_CHAT_HISTORY_LIMIT);
}

export function createLocalTableChatMessage(
  input: CreateLocalTableChatMessageInput,
): PokerTableChatMessage {
  const text = normalizeTableChatText(input.text);
  if (!text) {
    throw new Error('Chat message cannot be empty.');
  }

  const createdAt = input.createdAt ?? Date.now();
  const playerName = trimPlayerName(input.playerName) || 'Player';

  return {
    createdAt,
    id:
      input.id ??
      `chat-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    moderation: createAcceptedTableChatModerationState(),
    playerId: input.playerId,
    playerName,
    text,
    tone: input.tone ?? (input.playerId ? 'player' : 'system'),
  };
}
