import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './AuthProvider';
import {
  friendRealtimeEvents,
  subscribeFriendRealtime,
  type FriendRealtimeEventName,
  type FriendRealtimePayload,
} from '../services/friends/friendRealtimeService';
import { buildFriendRequestBanner } from '../services/friends/mergeFriendRealtimeEvent';

type FriendRealtimeEvent = {
  eventName: FriendRealtimeEventName;
  payload: FriendRealtimePayload;
};

type FriendRequestBanner = {
  id: string;
  senderName: string;
};

type FriendNotificationContextValue = {
  banner: FriendRequestBanner | null;
  clearBanner: () => void;
  events: FriendRealtimeEvent[];
};

const FriendNotificationContext = createContext<FriendNotificationContextValue | null>(null);
const MAX_EVENTS = 50;

export function FriendNotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [banner, setBanner] = useState<FriendRequestBanner | null>(null);
  const [events, setEvents] = useState<FriendRealtimeEvent[]>([]);
  const receivedRequestIdsRef = useRef<Set<string>>(new Set());

  const clearBanner = useCallback(() => setBanner(null), []);
  const handleEvent = useCallback((payload: FriendRealtimePayload, eventName: FriendRealtimeEventName) => {
    const requestId = payload.requestId ?? payload.request?.id ?? null;

    if (eventName === friendRealtimeEvents.requestReceived && requestId) {
      if (receivedRequestIdsRef.current.has(requestId)) {
        return;
      }

      receivedRequestIdsRef.current.add(requestId);
      setBanner(buildFriendRequestBanner(payload));
    }

    setEvents((currentEvents) => [{ eventName, payload }, ...currentEvents].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    if (!token) {
      receivedRequestIdsRef.current.clear();
      setBanner(null);
      setEvents([]);
      return undefined;
    }

    return subscribeFriendRealtime({ onEvent: handleEvent, token });
  }, [handleEvent, token]);

  const value = useMemo(() => ({ banner, clearBanner, events }), [banner, clearBanner, events]);

  return <FriendNotificationContext.Provider value={value}>{children}</FriendNotificationContext.Provider>;
}

export function useFriendNotifications() {
  const context = useContext(FriendNotificationContext);

  if (!context) {
    throw new Error('useFriendNotifications must be used inside FriendNotificationProvider.');
  }

  return context;
}
