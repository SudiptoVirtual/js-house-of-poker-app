import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './AuthProvider';
import { fetchIncomingFriendRequests } from '../services/api/friends';
import {
  friendRealtimeEvents,
  subscribeFriendRealtime,
  type FriendRealtimeEventName,
  type FriendRealtimePayload,
} from '../services/friends/friendRealtimeService';
import {
  buildFriendRequestBanner,
  mergeIncomingFriendRequest,
  removeIncomingFriendRequest,
} from '../services/friends/mergeFriendRealtimeEvent';
import type { FriendsPlayer } from '../types/friends';

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
  pendingRequestCount: number;
  pendingRequests: FriendsPlayer[];
  reconcilePendingRequests: (requests: FriendsPlayer[]) => void;
};

const FriendNotificationContext = createContext<FriendNotificationContextValue | null>(null);
const MAX_EVENTS = 50;

export function FriendNotificationProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [banner, setBanner] = useState<FriendRequestBanner | null>(null);
  const [events, setEvents] = useState<FriendRealtimeEvent[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendsPlayer[]>([]);
  const receivedRequestIdsRef = useRef<Set<string>>(new Set());
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const clearBanner = useCallback(() => setBanner(null), []);
  const reconcilePendingRequests = useCallback((requests: FriendsPlayer[]) => {
    const requestsById = new Map(requests.map((request) => [request.requestId ?? request.id, request]));
    setPendingRequests([...requestsById.values()]);
  }, []);
  const refreshPendingRequests = useCallback(async (activeToken: string) => {
    const requests = await fetchIncomingFriendRequests(activeToken);

    if (tokenRef.current === activeToken) {
      reconcilePendingRequests(requests);
    }
  }, [reconcilePendingRequests]);
  const handleEvent = useCallback((payload: FriendRealtimePayload, eventName: FriendRealtimeEventName) => {
    const requestId = payload.requestId ?? payload.request?.id ?? null;

    if (eventName === friendRealtimeEvents.requestReceived && requestId) {
      if (receivedRequestIdsRef.current.has(requestId)) {
        return;
      }

      receivedRequestIdsRef.current.add(requestId);
      setBanner(buildFriendRequestBanner(payload));
      setPendingRequests((currentRequests) => mergeIncomingFriendRequest(currentRequests, payload));
    } else if (eventName === friendRealtimeEvents.requestAccepted || eventName === friendRealtimeEvents.requestDeclined) {
      const playerId = payload.userId ?? payload.otherUser?.id ?? payload.otherUser?.userId ?? payload.otherUserId ?? '';
      setPendingRequests((currentRequests) =>
        removeIncomingFriendRequest(currentRequests, requestId || undefined, playerId),
      );
    }

    setEvents((currentEvents) => [{ eventName, payload }, ...currentEvents].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    if (!token) {
      receivedRequestIdsRef.current.clear();
      setBanner(null);
      setEvents([]);
      setPendingRequests([]);
      return undefined;
    }

    void refreshPendingRequests(token).catch(() => undefined);

    return subscribeFriendRealtime({
      onEvent: handleEvent,
      onReconnect: () => { void refreshPendingRequests(token).catch(() => undefined); },
      token,
    });
  }, [handleEvent, refreshPendingRequests, token]);

  const value = useMemo(() => ({
    banner,
    clearBanner,
    events,
    pendingRequestCount: pendingRequests.length,
    pendingRequests,
    reconcilePendingRequests,
  }), [banner, clearBanner, events, pendingRequests, reconcilePendingRequests]);

  return <FriendNotificationContext.Provider value={value}>{children}</FriendNotificationContext.Provider>;
}

export function useFriendNotifications() {
  const context = useContext(FriendNotificationContext);

  if (!context) {
    throw new Error('useFriendNotifications must be used inside FriendNotificationProvider.');
  }

  return context;
}
