import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { env } from '../config/env';
import { useAuth } from './AuthProvider';
import {
  enqueueChatNotification,
  getNextChatUnreadCount,
  normalizeChatNotification,
  shouldShowChatNotification,
  type ChatNotificationBanner,
  type ChatNotificationPayload,
} from '../services/chatRooms/chatNotifications';
import { chatRoomSocketEvents } from '../services/chatRooms/events';
import { createSocketManager } from '../services/socket/socketManager';

type ChatNotificationContextValue = {
  activeRoomId: string | null;
  banner: ChatNotificationBanner | null;
  clearBanner: () => void;
  queueLength: number;
  setActiveRoomId: (roomId: string | null) => void;
  unreadByRoom: Record<string, number>;
};

const ChatNotificationContext = createContext<ChatNotificationContextValue | null>(null);

export function ChatNotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [activeRoomId, setActiveRoomIdState] = useState<string | null>(null);
  const [bannerQueue, setBannerQueue] = useState<ChatNotificationBanner[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const activeRoomIdRef = useRef<string | null>(null);
  const receivedKeysRef = useRef(new Set<string>());

  const setActiveRoomId = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
    setActiveRoomIdState(roomId);

    if (roomId) {
      setUnreadByRoom((current) => ({ ...current, [roomId]: 0 }));
    }
  }, []);

  const clearBanner = useCallback(() => {
    setBannerQueue((current) => current.slice(1));
  }, []);

  const handleNotification = useCallback((payload: ChatNotificationPayload) => {
    const notification = normalizeChatNotification(payload);

    if (!notification || receivedKeysRef.current.has(notification.dedupeKey)) {
      return;
    }

    receivedKeysRef.current.add(notification.dedupeKey);
    const isViewingRoom = activeRoomIdRef.current === notification.roomId;
    setUnreadByRoom((current) => ({
      ...current,
      [notification.roomId]: getNextChatUnreadCount(
        current[notification.roomId] ?? 0,
        payload.unreadCount,
        isViewingRoom,
      ),
    }));

    if (shouldShowChatNotification(notification, activeRoomIdRef.current)) {
      setBannerQueue((current) => enqueueChatNotification(current, notification));
    }
  }, []);

  useEffect(() => {
    if (!token || !env.poker.socketUrl) {
      receivedKeysRef.current.clear();
      activeRoomIdRef.current = null;
      setActiveRoomIdState(null);
      setBannerQueue([]);
      setUnreadByRoom({});
      return undefined;
    }

    const socketManager = createSocketManager({
      kind: 'socket',
      label: 'Chat notification Socket.IO backend',
      url: env.poker.socketUrl,
    });
    socketManager.setAuth({ token });
    const unsubscribeMessage = socketManager.on<ChatNotificationPayload>(
      chatRoomSocketEvents.messageNotification,
      handleNotification,
    );
    const unsubscribeInvite = socketManager.on<ChatNotificationPayload>(
      chatRoomSocketEvents.roomInvited,
      handleNotification,
    );

    void socketManager.connect().catch((error) => {
      console.warn('Chat notifications are unavailable.', error);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeInvite();
      socketManager.destroy();
    };
  }, [handleNotification, token]);

  const value = useMemo(() => ({
    activeRoomId,
    banner: bannerQueue[0] ?? null,
    clearBanner,
    queueLength: bannerQueue.length,
    setActiveRoomId,
    unreadByRoom,
  }), [activeRoomId, bannerQueue, clearBanner, setActiveRoomId, unreadByRoom]);

  return <ChatNotificationContext.Provider value={value}>{children}</ChatNotificationContext.Provider>;
}

export function useChatNotifications() {
  const context = useContext(ChatNotificationContext);

  if (!context) {
    throw new Error('useChatNotifications must be used inside ChatNotificationProvider.');
  }

  return context;
}
