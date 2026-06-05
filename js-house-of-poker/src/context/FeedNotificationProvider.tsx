import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './AuthProvider';
import {
  subscribeFeedNotifications,
  type FeedNotification,
} from '../services/notifications/feedNotificationService';

type FeedNotificationContextValue = {
  bannerNotification: FeedNotification | null;
  clearBannerNotification: () => void;
  markFeedNotificationsRead: () => void;
  notifications: FeedNotification[];
  unreadCount: number;
};

const FeedNotificationContext = createContext<FeedNotificationContextValue | null>(null);

const MAX_NOTIFICATIONS = 20;

export function FeedNotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [bannerNotification, setBannerNotification] = useState<FeedNotification | null>(null);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const deliveredIdsRef = useRef<Set<string>>(new Set());

  const handleNotification = useCallback((notification: FeedNotification) => {
    if (deliveredIdsRef.current.has(notification.id)) {
      return;
    }

    deliveredIdsRef.current.add(notification.id);
    setNotifications((currentNotifications) => [notification, ...currentNotifications].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((currentUnreadCount) => currentUnreadCount + notification.unreadCount);
    setBannerNotification(notification);
  }, []);

  const clearBannerNotification = useCallback(() => {
    setBannerNotification(null);
  }, []);

  const markFeedNotificationsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!token) {
      deliveredIdsRef.current.clear();
      setBannerNotification(null);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    return subscribeFeedNotifications({
      onNotification: handleNotification,
      token,
    });
  }, [handleNotification, token]);

  const value = useMemo(
    () => ({
      bannerNotification,
      clearBannerNotification,
      markFeedNotificationsRead,
      notifications,
      unreadCount,
    }),
    [bannerNotification, clearBannerNotification, markFeedNotificationsRead, notifications, unreadCount],
  );

  return <FeedNotificationContext.Provider value={value}>{children}</FeedNotificationContext.Provider>;
}

export function useFeedNotifications() {
  const context = useContext(FeedNotificationContext);

  if (!context) {
    throw new Error('useFeedNotifications must be used inside FeedNotificationProvider.');
  }

  return context;
}
