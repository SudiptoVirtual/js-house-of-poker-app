import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthProvider';
import { fetchNotifications, markAllNotificationsRead, mergeNotifications, subscribeNotificationCenter, type NotificationRecord } from '../services/notifications/notificationCenterService';

type NotificationCenterContextValue = {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
};

const NotificationCenterContext = createContext<NotificationCenterContextValue | null>(null);

export function NotificationCenterProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetchNotifications(token);
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markAllAsRead = useCallback(async () => {
    if (!token) return;
    const response = await markAllNotificationsRead(token);
    const readAt = response.readAt ?? new Date().toISOString();
    setUnreadCount(0);
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })));
  }, [token]);

  useEffect(() => { void refreshNotifications(); }, [refreshNotifications]);

  useEffect(() => {
    if (!token) return undefined;
    return subscribeNotificationCenter({
      token,
      onNotification: (notification, payloadUnreadCount) => {
        setNotifications((current) => mergeNotifications(current, [notification]));
        setUnreadCount((current) => typeof payloadUnreadCount === 'number' ? Math.max(current + payloadUnreadCount, payloadUnreadCount) : current + 1);
      },
      onError: (message) => console.warn(message),
    });
  }, [token]);

  const value = useMemo(() => ({ notifications, unreadCount, isLoading, markAllAsRead, refreshNotifications }), [notifications, unreadCount, isLoading, markAllAsRead, refreshNotifications]);

  return <NotificationCenterContext.Provider value={value}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error('useNotificationCenter must be used inside NotificationCenterProvider.');
  return context;
}
