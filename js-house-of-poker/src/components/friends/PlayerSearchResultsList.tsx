import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { FriendsPlayer } from '../../types/friends';
import { PlayerSearchResultCard } from './PlayerSearchResultCard';

import { colors } from '../../theme/colors';
type PlayerSearchResultsListProps = {
  emptyMessage?: string;
  hasActiveTable: boolean;
  isSearchActive: boolean;
  onInviteToChatRoom: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onRemoveFriend?: (player: FriendsPlayer) => void;
  onRespondToRequest: (player: FriendsPlayer, response: 'accept' | 'reject') => void;
  onSendFriendRequest: (player: FriendsPlayer) => void;
  onStartDirectChat: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  players: FriendsPlayer[];
};

export function PlayerSearchResultsList({
  emptyMessage = 'No players match that name or username.',
  hasActiveTable,
  isSearchActive,
  onInviteToChatRoom,
  onInviteToTable,
  onRemoveFriend,
  onRespondToRequest,
  onSendFriendRequest,
  onStartDirectChat,
  onViewProfile,
  players,
}: PlayerSearchResultsListProps) {
  if (!isSearchActive) {
    return null;
  }

  return (
    <FlatList
      data={players}
      keyExtractor={(player) => player.id}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <PlayerSearchResultCard
          hasActiveTable={hasActiveTable}
          onInviteToChatRoom={onInviteToChatRoom}
          onInviteToTable={onInviteToTable}
          onRemoveFriend={onRemoveFriend}
          onRespondToRequest={onRespondToRequest}
          onSendFriendRequest={onSendFriendRequest}
          onStartDirectChat={onStartDirectChat}
          onViewProfile={onViewProfile}
          player={item}
        />
      )}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  separator: {
    height: 12,
  },
});
