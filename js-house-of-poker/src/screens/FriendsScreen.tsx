import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FriendsHeader } from '../components/friends/FriendsHeader';
import { OnlineFriendsList } from '../components/friends/OnlineFriendsList';
import { PlayerSearchInput } from '../components/friends/PlayerSearchInput';
import { PlayerSearchResultsList } from '../components/friends/PlayerSearchResultsList';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { friendsMockPlayers } from '../constants/friendsMockData';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { FriendsPlayer } from '../types/friends';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

export function FriendsScreen({ navigation }: Props) {
  const { roomState, sendTableInvite } = usePoker();
  const [players, setPlayers] = useState<FriendsPlayer[]>(friendsMockPlayers);
  const [query, setQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const activeTableCode = roomState?.roomId ?? null;
  const trimmedQuery = query.trim();
  const isSearchActive = trimmedQuery.length > 0;

  const onlineFriends = useMemo(
    () => players.filter((player) => player.relationshipStatus === 'friend' && player.isOnline === true),
    [players],
  );

  const searchResults = useMemo(() => {
    if (!isSearchActive) {
      return [];
    }

    const normalizedQuery = trimmedQuery.toLowerCase();

    return players.filter((player) =>
      [player.displayName, player.username].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [isSearchActive, players, trimmedQuery]);

  function handleViewProfile(player: FriendsPlayer) {
    // TODO(profile:openFromFriends): Deep-link to the selected player's public profile when profile routes accept player IDs.
    setFeedbackMessage(`Opening profile placeholder for ${player.displayName}.`);
    navigation.navigate(routes.Profile);
  }

  function handleSendFriendRequest(player: FriendsPlayer) {
    // TODO(friends:sendRequest): Persist outgoing friend requests through the friends API.
    // TODO(notification:friendRequest): Notify the recipient that a friend request was sent.
    setPlayers((currentPlayers) =>
      currentPlayers.map((currentPlayer) =>
        currentPlayer.id === player.id
          ? { ...currentPlayer, relationshipStatus: 'request_sent' }
          : currentPlayer,
      ),
    );
    setFeedbackMessage(`Friend request placeholder sent to ${player.displayName}.`);
  }

  function handleRespondToRequest(player: FriendsPlayer, response: 'accept' | 'reject') {
    if (response === 'accept') {
      // TODO(friends:acceptRequest): Accept inbound friend requests through the friends API.
      setPlayers((currentPlayers) =>
        currentPlayers.map((currentPlayer) =>
          currentPlayer.id === player.id
            ? { ...currentPlayer, relationshipStatus: 'friend' }
            : currentPlayer,
        ),
      );
      setFeedbackMessage(`Friend request placeholder accepted for ${player.displayName}.`);
      return;
    }

    // TODO(friends:rejectRequest): Reject inbound friend requests through the friends API.
    setPlayers((currentPlayers) =>
      currentPlayers.map((currentPlayer) =>
        currentPlayer.id === player.id
          ? { ...currentPlayer, relationshipStatus: 'not_friends' }
          : currentPlayer,
      ),
    );
    setFeedbackMessage(`Friend request placeholder rejected for ${player.displayName}.`);
  }

  function handleInviteToChat(player: FriendsPlayer) {
    // TODO(chat:invitePlayerToRoom): Replace this visible placeholder with chat room selection and invite delivery.
    // TODO(notification:chatInvite): Notify the player when a chat invite is delivered.
    setFeedbackMessage(`Chat invite placeholder queued for ${player.displayName}.`);
  }

  function handleInviteToTable(player: FriendsPlayer) {
    if (!activeTableCode) {
      // TODO(table:invitePlayerToTable): Connect table invite placeholders to active table selection when no table is open.
      // TODO(notification:tableInvite): Notify players when table invites are delivered.
      setFeedbackMessage(`Table invite placeholder needs an active table before inviting ${player.displayName}.`);
      return;
    }

    // TODO(table:invitePlayerToTable): Replace mock recipient IDs with backend account IDs for table invites.
    // TODO(notification:tableInvite): Notify players when table invites are delivered.
    void sendTableInvite({
      message: `Join my table ${activeTableCode}`,
      recipientAccountId: player.id,
      source: 'friend-list',
    });
    setFeedbackMessage(`Table invite placeholder sent to ${player.displayName} for ${activeTableCode}.`);
  }

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Friends"
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

      {isSearchActive ? (
        <SectionCard title="Search results">
          <Text style={styles.helperText}>
            Results appear only while search is active and match name or username case-insensitively.
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
