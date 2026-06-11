import type { ChatRoomMessage } from '../../types/chatRooms';

export type ChatNotificationType = 'chat_message' | 'chat_room_invite';

export type ChatNotificationPayload = {
  message?: ChatRoomMessage | null;
  notification?: {
    body?: string;
    chatRoomId?: string | null;
    data?: {
      roomName?: string | null;
      senderDisplayName?: string | null;
    } | null;
    id?: string | null;
    messageId?: string | null;
    type?: string | null;
  } | null;
  preview?: string | null;
  room?: { name?: string; title?: string } | null;
  roomId?: string | null;
  senderPlayerName?: string | null;
  type?: string | null;
  unreadCount?: number;
};

export type ChatNotificationBanner = {
  body: string;
  dedupeKey: string;
  id: string;
  roomId: string;
  roomName: string;
  senderName: string;
  type: ChatNotificationType;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeChatNotification(payload: ChatNotificationPayload): ChatNotificationBanner | null {
  const type = payload.type ?? payload.notification?.type;

  if (type !== 'chat_message' && type !== 'chat_room_invite') {
    return null;
  }

  const roomId = clean(payload.roomId ?? payload.notification?.chatRoomId ?? payload.message?.roomId);

  if (!roomId) {
    return null;
  }

  const notificationId = clean(payload.notification?.id);
  const messageId = clean(payload.notification?.messageId ?? payload.message?.id);
  const dedupeKey = notificationId
    ? `notification:${notificationId}`
    : messageId
      ? `message:${messageId}`
      : `room-type:${roomId}:${type}`;
  const senderName = clean(
    payload.notification?.data?.senderDisplayName
      ?? payload.senderPlayerName
      ?? payload.message?.authorName
      ?? payload.message?.playerName,
  ) || 'A player';
  const roomName = clean(
    payload.notification?.data?.roomName
      ?? payload.room?.title
      ?? payload.room?.name,
  ) || 'your chat room';
  const body = clean(payload.message?.body ?? payload.message?.text ?? payload.preview ?? payload.notification?.body)
    || (type === 'chat_room_invite' ? `Invited you to ${roomName}.` : 'Sent a new message.');

  return {
    body,
    dedupeKey,
    id: notificationId || messageId || dedupeKey,
    roomId,
    roomName,
    senderName,
    type,
  };
}

export function enqueueChatNotification(
  queue: ChatNotificationBanner[],
  notification: ChatNotificationBanner,
) {
  return queue.some(({ dedupeKey }) => dedupeKey === notification.dedupeKey)
    ? queue
    : [...queue, notification];
}

export function shouldShowChatNotification(notification: ChatNotificationBanner, activeRoomId: string | null) {
  return notification.type === 'chat_room_invite' || notification.roomId !== activeRoomId;
}

export function getNextChatUnreadCount(
  currentCount: number,
  payloadCount: number | undefined,
  isViewingRoom: boolean,
) {
  return isViewingRoom ? 0 : Math.max(payloadCount ?? 0, currentCount + 1);
}

export function getUnreadByRoom(rooms: Array<{ id: string; unreadCount?: number }>) {
  return Object.fromEntries(
    rooms.map((room) => [room.id, Math.max(0, room.unreadCount ?? 0)]),
  );
}

export function getTotalUnreadMessageCount(unreadByRoom: Record<string, number>) {
  return Object.values(unreadByRoom).reduce((total, count) => total + Math.max(0, count), 0);
}
