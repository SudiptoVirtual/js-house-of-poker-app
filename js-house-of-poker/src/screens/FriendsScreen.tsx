import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FriendsHeader } from '../components/friends/FriendsHeader';
import { OnlineFriendsList } from '../components/friends/OnlineFriendsList';
import { PlayerSearchInput } from '../components/friends/PlayerSearchInput';
import { PlayerSearchResultsList } from '../components/friends/PlayerSearchResultsList';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { useAuth } from '../context/AuthProvider';
import { useFriendNotifications } from '../context/FriendNotificationProvider';
import { usePoker } from '../context/PokerProvider';
import {
  acceptFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  getApiErrorDetails,
  rejectFriendRequest,
  searchPlayers,
  sendChatInvite,
  sendFriendRequest,
} from '../services/api';
import { friendRealtimeEvents } from '../services/friends/friendRealtimeService';
import {
  mergeFriendPresenceUpdate,
  mergeIncomingFriendRequest,
  mergeIncomingFriendRequests,
  removeIncomingFriendRequest,
} from '../services/friends/mergeFriendRealtimeEvent';
import { colors } from '../theme/colors';
import type { FriendsPlayer, RelationshipStatus } from '../types/friends';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

function updatePlayerRelationship(
  playerId: string,
  relationshipStatus: RelationshipStatus,
  setPlayers: Dispatch<SetStateAction<FriendsPlayer[]>>,
  setSearchResults: Dispatch<SetStateAction<FriendsPlayer[]>>,
) {
  const updatePlayer = (player: FriendsPlayer) =>
    player.id === playerId ? { ...player, relationshipStatus } : player;

  setPlayers((currentPlayers) => currentPlayers.map(updatePlayer));
  setSearchResults((currentResults) => currentResults.map(updatePlayer));
}

export function FriendsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { events: friendRealtimeEventsReceived } = useFriendNotifications();
  const { roomState, sendTableInvite } = usePoker();
  const [players, setPlayers] = useState<FriendsPlayer[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendsPlayer[]>([]);
  const [searchResults, setSearchResults] = useState<FriendsPlayer[]>([]);
  const [query, setQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isRefreshingFriends, setIsRefreshingFriends] = useState(false);
  const processedRealtimeEventsRef = useRef<Set<string>>(new Set());
  const activeTableCode = roomState?.roomId ?? null;
  const trimmedQuery = query.trim();
  const isSearchActive = trimmedQuery.length > 0;

  const onlineFriends = useMemo(
    () => players.filter((player) => player.relationshipStatus === 'friend' && player.isOnline === true),
    [players],
  );

  const loadFriends = useCallback(async (reconcileIncomingRequests = false) => {
    if (!token) {
      setPlayers([]);
      setIncomingRequests([]);
      setFeedbackMessage('Sign in to load your friends.');
      return;
    }

    try {
      const [friends, pendingRequests] = await Promise.all([
        fetchFriends(token),
        fetchIncomingFriendRequests(token),
      ]);
      setPlayers(friends);
      setIncomingRequests((currentRequests) =>
        reconcileIncomingRequests
          ? pendingRequests
          : mergeIncomingFriendRequests(currentRequests, pendingRequests),
      );
      setFeedbackMessage(null);
    } catch (error) {
      const { message } = getApiErrorDetails(error, 'Unable to load friends.');
      setFeedbackMessage(message);
    }
  }, [token]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    processedRealtimeEventsRef.current.clear();
  }, [token]);

  useEffect(() => {
    [...friendRealtimeEventsReceived].reverse().forEach((realtimeEvent) => {
      const { eventName, payload } = realtimeEvent;
      const requestId = payload.requestId ?? payload.request?.id ?? '';
      const playerId = payload.userId ?? payload.otherUser?.id ?? payload.otherUserId ?? '';
      const eventKey = `${eventName}:${requestId}:${playerId}:${payload.status ?? ''}:${payload.isOnline ?? ''}`;

      // Reapply the bounded presence-event history oldest-to-newest so repeated online/offline cycles remain valid.
      if (eventName === friendRealtimeEvents.presenceUpdated) {
        setPlayers((currentPlayers) => mergeFriendPresenceUpdate(currentPlayers, payload));
        setSearchResults((currentResults) => mergeFriendPresenceUpdate(currentResults, payload));
        return;
      }

      if (processedRealtimeEventsRef.current.has(eventKey)) {
        return;
      }
      processedRealtimeEventsRef.current.add(eventKey);

      if (eventName === friendRealtimeEvents.requestReceived) {
        setIncomingRequests((currentRequests) => mergeIncomingFriendRequest(currentRequests, payload));
        setSearchResults((currentResults) => mergeIncomingFriendRequest(currentResults, payload));
        return;
      }

      if (!playerId) {
        return;
      }

      if (eventName === friendRealtimeEvents.requestAccepted || payload.status === 'friends') {
        setIncomingRequests((currentRequests) =>
          removeIncomingFriendRequest(currentRequests, requestId || undefined, playerId),
        );
        updatePlayerRelationship(playerId, 'friend', setPlayers, setSearchResults);
      } else if (eventName === friendRealtimeEvents.requestDeclined || payload.status === 'none') {
        setIncomingRequests((currentRequests) =>
          removeIncomingFriendRequest(currentRequests, requestId || undefined, playerId),
        );
        updatePlayerRelationship(playerId, 'not_friends', setPlayers, setSearchResults);
      }
    });
  }, [friendRealtimeEventsReceived]);

  useEffect(() => {
    if (!isSearchActive) {
      setSearchResults([]);
      return undefined;
    }

    if (!token) {
      setSearchResults([]);
      setFeedbackMessage('Sign in to search for players.');
      return undefined;
    }

    let isCurrentSearch = true;
    const searchTimeout = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchPlayers(trimmedQuery, token);

          if (isCurrentSearch) {
            setSearchResults(results);
          }
        } catch (error) {
          if (isCurrentSearch) {
            const { message } = getApiErrorDetails(error, 'Unable to search players.');
            setSearchResults([]);
            setFeedbackMessage(message);
          }
        }
      })();
    }, 250);

    return () => {
      isCurrentSearch = false;
      clearTimeout(searchTimeout);
    };
  }, [isSearchActive, token, trimmedQuery]);

  const handleRefreshFriends = useCallback(async () => {
    setIsRefreshingFriends(true);

    try {
      await loadFriends(true);

      if (isSearchActive && token) {
        const results = await searchPlayers(trimmedQuery, token);
        setSearchResults(results);
      }
    } catch (error) {
      const { message } = getApiErrorDetails(error, 'Unable to refresh friends.');
      setFeedbackMessage(message);
    } finally {
      setIsRefreshingFriends(false);
    }
  }, [isSearchActive, loadFriends, token, trimmedQuery]);

  function handleViewProfile(player: FriendsPlayer) {
    // TODO(profile:openFromFriends): Deep-link to the selected player's public profile when profile routes accept player IDs.
    setFeedbackMessage(`Opening profile for ${player.displayName}.`);
    navigation.navigate(routes.Profile);
  }

  async function handleSendFriendRequest(player: FriendsPlayer) {
    if (!token) {
      setFeedbackMessage('Sign in to send friend requests.');
      return;
    }

    try {
      await sendFriendRequest(player.id, token);
      updatePlayerRelationship(player.id, 'request_sent', setPlayers, setSearchResults);
      setFeedbackMessage(`Friend request sent to ${player.displayName}.`);
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to send a friend request to ${player.displayName}.`);
      setFeedbackMessage(message);
    }
  }

  async function handleRespondToRequest(player: FriendsPlayer, response: 'accept' | 'reject') {
    if (!token) {
      setFeedbackMessage('Sign in to respond to friend requests.');
      return;
    }

    try {
      if (response === 'accept') {
        await acceptFriendRequest({ requestId: player.requestId, userId: player.id }, token);
        setIncomingRequests((currentRequests) =>
          removeIncomingFriendRequest(currentRequests, player.requestId, player.id),
        );
        updatePlayerRelationship(player.id, 'friend', setPlayers, setSearchResults);
        await loadFriends();
        setFeedbackMessage(`Friend request accepted for ${player.displayName}.`);
        return;
      }

      await rejectFriendRequest({ requestId: player.requestId, userId: player.id }, token);
      setIncomingRequests((currentRequests) =>
          removeIncomingFriendRequest(currentRequests, player.requestId, player.id),
        );
      updatePlayerRelationship(player.id, 'not_friends', setPlayers, setSearchResults);
      setFeedbackMessage(`Friend request rejected for ${player.displayName}.`);
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to ${response} ${player.displayName}'s friend request.`);
      setFeedbackMessage(message);
    }
  }

  async function handleInviteToChat(player: FriendsPlayer) {
    if (!token) {
      setFeedbackMessage('Sign in to send chat invites.');
      return;
    }

    try {
      await sendChatInvite(
        {
          message: `Join me in chat, ${player.displayName}.`,
          userId: player.id,
        },
        token,
      );
      setFeedbackMessage(`Chat invite sent to ${player.displayName}.`);
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to send a chat invite to ${player.displayName}.`);
      setFeedbackMessage(message);
    }
  }

  async function handleInviteToTable(player: FriendsPlayer) {
    if (!activeTableCode) {
      setFeedbackMessage(`Open or join a table before inviting ${player.displayName}.`);
      return;
    }

    try {
      await sendTableInvite({
        message: `Join my table ${activeTableCode}`,
        recipientAccountId: player.id,
        source: 'friend-list',
      });
      setFeedbackMessage(`Table invite sent to ${player.displayName} for ${activeTableCode}.`);
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to send a table invite to ${player.displayName}.`);
      setFeedbackMessage(message);
    }
  }

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Friends"
      onRefresh={() => { void handleRefreshFriends(); }}
      refreshing={isRefreshingFriends}
      title="Friends"
      subtitle="Online friends and player search"
    >
      <SectionCard title="Find players">
        <PlayerSearchInput onChangeText={setQuery} value={query} />
        <FriendsHeader
          activeTableCode={activeTableCode}
          feedbackMessage={feedbackMessage}
          isSearchActive={isSearchActive}
          onlineFriendCount={onlineFriends.length}
        />
      </SectionCard>

      <SectionCard title="Pending friend requests">
        <PlayerSearchResultsList
          emptyMessage="You have no pending friend requests."
          hasActiveTable={Boolean(activeTableCode)}
          isSearchActive
          onInviteToChat={handleInviteToChat}
          onInviteToTable={handleInviteToTable}
          onRespondToRequest={handleRespondToRequest}
          onSendFriendRequest={handleSendFriendRequest}
          onViewProfile={handleViewProfile}
          players={incomingRequests}
        />
      </SectionCard>

      {isSearchActive ? (
        <SectionCard title="Search results">
          <Text style={styles.helperText}>
            Results are loaded from the backend while search is active.
          </Text>
          <PlayerSearchResultsList
            hasActiveTable={Boolean(activeTableCode)}
            isSearchActive={isSearchActive}
            onInviteToChat={handleInviteToChat}
            onInviteToTable={handleInviteToTable}
            onRespondToRequest={handleRespondToRequest}
            onSendFriendRequest={handleSendFriendRequest}
            onViewProfile={handleViewProfile}
            players={searchResults}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Online friends">
          <OnlineFriendsList
            hasActiveTable={Boolean(activeTableCode)}
            onInviteToChat={handleInviteToChat}
            onInviteToTable={handleInviteToTable}
            onViewProfile={handleViewProfile}
            players={onlineFriends}
          />
        </SectionCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
});
