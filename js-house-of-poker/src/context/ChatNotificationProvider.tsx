import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { env } from '../config/env';
import { useAuth } from './AuthProvider';
import {
  enqueueChatNotification,
  getNextChatUnreadCount,
  getTotalUnreadMessageCount,
  getUnreadByRoom,
  normalizeChatNotification,
  shouldShowChatNotification,
  type ChatNotificationBanner,
  type ChatNotificationPayload,
} from '../services/chatRooms/chatNotifications';
import { chatRoomSocketEvents } from '../services/chatRooms/events';
import { fetchChatRooms, markChatRoomNotificationsRead } from '../services/api/chatRooms';
import { createSocketManager } from '../services/socket/socketManager';

type ChatNotificationContextValue = {
  activeRoomId: string | null;
  banner: ChatNotificationBanner | null;
  clearBanner: () => void;
  markRoomRead: (roomId: string) => Promise<void>;
  queueLength: number;
  setActiveRoomId: (roomId: string | null) => void;
  totalUnreadMessageCount: number;
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

  const reconcileUnreadCounts = useCallback(async () => {
    if (!token) return;
    const rooms = await fetchChatRooms(token);
    setUnreadByRoom(getUnreadByRoom(rooms));
  }, [token]);

  const setActiveRoomId = useCallback((roomId: string | null) => {
    activeRoomIdRef.current = roomId;
    setActiveRoomIdState(roomId);

    if (roomId) {
      setUnreadByRoom((current) => ({ ...current, [roomId]: 0 }));
    }
  }, []);

  const markRoomRead = useCallback(async (roomId: string) => {
    setUnreadByRoom((current) => ({ ...current, [roomId]: 0 }));
    if (!token) return;

    try {
      await markChatRoomNotificationsRead(roomId, token);
    } catch (error) {
      console.warn('Unable to mark chat room notifications read.', error);
      await reconcileUnreadCounts().catch((reconcileError) => {
        console.warn('Unable to reconcile chat notification counts.', reconcileError);
      });
    }
  }, [reconcileUnreadCounts, token]);

  const clearBanner = useCallback(() => {
    setBannerQueue((current) => current.slice(1));
  }, []);

  const handleNotification = useCallback((payload: ChatNotificationPayload) => {
    const notification = normalizeChatNotification(payload);

    if (!notification || receivedKeysRef.current.has(notification.dedupeKey)) return;

    receivedKeysRef.current.add(notification.dedupeKey);
    if (notification.type === 'chat_message') {
      const isViewingRoom = activeRoomIdRef.current === notification.roomId;
      setUnreadByRoom((current) => ({
        ...current,
        [notification.roomId]: getNextChatUnreadCount(
          current[notification.roomId] ?? 0,
          payload.unreadCount,
          isViewingRoom,
        ),
      }));
    }

    if (shouldShowChatNotification(notification, activeRoomIdRef.current)) {
      setBannerQueue((current) => enqueueChatNotification(current, notification));
    }
  }, []);

  useEffect(() => {
    if (!token) {
      receivedKeysRef.current.clear();
      activeRoomIdRef.current = null;
      setActiveRoomIdState(null);
      setBannerQueue([]);
      setUnreadByRoom({});
      return undefined;
    }

    void reconcileUnreadCounts().catch((error) => console.warn('Unable to load chat notification counts.', error));
    if (!env.poker.socketUrl) return undefined;

    const socketManager = createSocketManager({
      kind: 'socket', label: 'Chat notification Socket.IO backend', url: env.poker.socketUrl,
    });
    let previousStatus = socketManager.getConnectionState().status;
    socketManager.setAuth({ token });
    const unsubscribeMessage = socketManager.on<ChatNotificationPayload>(
      chatRoomSocketEvents.messageNotification, handleNotification,
    );
    const unsubscribeInvite = socketManager.on<ChatNotificationPayload>(
      chatRoomSocketEvents.roomInvited, handleNotification,
    );
    const unsubscribeConnection = socketManager.onConnection((state) => {
      if (state.status === 'connected' && previousStatus !== 'connected') {
        void reconcileUnreadCounts().catch((error) => console.warn('Unable to reconcile chat notification counts.', error));
      }
      previousStatus = state.status;
    });

    void socketManager.connect().catch((error) => console.warn('Chat notifications are unavailable.', error));

    return () => {
      unsubscribeMessage();
      unsubscribeInvite();
      unsubscribeConnection();
      socketManager.destroy();
    };
  }, [handleNotification, reconcileUnreadCounts, token]);

  const totalUnreadMessageCount = useMemo(() => getTotalUnreadMessageCount(unreadByRoom), [unreadByRoom]);
  const value = useMemo(() => ({
    activeRoomId, banner: bannerQueue[0] ?? null, clearBanner, markRoomRead, queueLength: bannerQueue.length,
    setActiveRoomId, totalUnreadMessageCount, unreadByRoom,
  }), [activeRoomId, bannerQueue, clearBanner, markRoomRead, setActiveRoomId, totalUnreadMessageCount, unreadByRoom]);

  return <ChatNotificationContext.Provider value={value}>{children}</ChatNotificationContext.Provider>;
}

export function useChatNotifications() {
  const context = useContext(ChatNotificationContext);
  if (!context) throw new Error('useChatNotifications must be used inside ChatNotificationProvider.');
  return context;
}
