import type { ChatRoom, ChatRoomMessage, ChatRoomPlayer } from '../../types/chatRooms';
import { apiRequest } from './client';

type BackendChatRoomListItem = {
  activePlayerCount?: number;
  description?: string;
  id?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  name?: string;
  roomId?: string;
  slug?: string;
  topic?: string;
  unreadCount?: number;
};

type BackendChatRoomDetail = BackendChatRoomListItem & {
  activePlayers?: ChatRoomPlayer[];
  messages?: ChatRoomMessage[];
  players?: ChatRoomPlayer[];
  recentMessages?: ChatRoomMessage[];
};

type ChatRoomsResponse = {
  rooms?: BackendChatRoomListItem[];
};

type ChatRoomResponse = {
  room?: BackendChatRoomDetail;
};

function getDefaultTableConfig(room: BackendChatRoomListItem) {
  const topic = `${room.name ?? ''} ${room.topic ?? ''}`.toLowerCase();
  const isThreeFiveSeven = topic.includes('3-5-7') || topic.includes('357');

  return {
    gameLabel: isThreeFiveSeven ? '3-5-7 Showdown' : 'Texas Hold’em',
    isPrivate: false,
    maxSeats: isThreeFiveSeven ? 3 : 6,
    seatsOpen: Math.max(0, (isThreeFiveSeven ? 3 : 6) - (room.activePlayerCount ?? 0)),
    stakesLabel: 'Room-configured play chips',
    tableCode: String(room.slug ?? room.roomId ?? room.id ?? '').toUpperCase(),
  };
}

function toChatRoomMessage(message: ChatRoomMessage): ChatRoomMessage {
  return {
    authorId: message.authorId ?? message.playerId ?? null,
    authorName: message.authorName ?? message.playerName ?? 'Player',
    body: message.body ?? message.text ?? '',
    createdAt: message.createdAt,
    id: String(message.id),
    roomId: String(message.roomId),
    tone: message.tone ?? 'player',
  };
}

function toChatRoom(room: BackendChatRoomDetail): ChatRoom {
  const id = String(room.id ?? room.roomId ?? room.slug ?? '');
  const players = (room.players ?? room.activePlayers ?? []).map((player) => ({
    avatarInitials: player.avatarInitials ?? 'P',
    chipStackLabel: player.chipStackLabel || 'Online now',
    displayName: player.displayName ?? 'Player',
    handle: player.handle ?? player.displayName ?? 'Player',
    id: String(player.id ?? player.userId ?? ''),
    isHost: player.isHost,
    status: player.status ?? 'available',
  }));
  const messages = (room.messages ?? room.recentMessages ?? []).map(toChatRoomMessage);
  const lastMessagePreview =
    room.lastMessagePreview ||
    messages.at(-1)?.body ||
    'No messages yet. Start the room conversation.';

  return {
    activePlayerCount: room.activePlayerCount ?? players.length,
    description: room.description ?? 'Live social chat room.',
    id,
    inviteState: {
      pendingInvites: [],
      roomId: id,
      shareLink: `houseofpoker://chat-rooms/${room.slug ?? id}`,
      suggestedHandles: [],
    },
    lastMessagePreview,
    messages,
    players,
    tableConfig: getDefaultTableConfig(room),
    title: room.name ?? 'Chat room',
    topic: room.topic ?? 'Live room chat',
    unreadCount: room.unreadCount ?? 0,
  };
}

export async function fetchChatRooms() {
  const response = await apiRequest<ChatRoomsResponse>('/api/chat-rooms');

  return (response.rooms ?? []).map(toChatRoom);
}

export async function fetchChatRoom(roomId: string) {
  const response = await apiRequest<ChatRoomResponse>(`/api/chat-rooms/${encodeURIComponent(roomId)}`);

  if (!response.room) {
    throw new Error('Chat room not found.');
  }

  return toChatRoom(response.room);
}
