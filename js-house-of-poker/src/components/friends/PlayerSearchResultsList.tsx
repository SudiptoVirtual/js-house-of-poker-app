import { FlatList, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { FriendsPlayer } from '../../types/friends';
import { PlayerSearchResultCard } from './PlayerSearchResultCard';

type PlayerSearchResultsListProps = {
  emptyMessage?: string;
  hasActiveTable: boolean;
  isSearchActive: boolean;
  onInviteToChat: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onRemoveFriend?: (player: FriendsPlayer) => void;
  onRespondToRequest: (player: FriendsPlayer, response: 'accept' | 'reject') => void;
  onSendFriendRequest: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  players: FriendsPlayer[];
};

export function PlayerSearchResultsList({
  emptyMessage = 'No players match that name or username.',
  hasActiveTable,
  isSearchActive,
  onInviteToChat,
  onInviteToTable,
  onRemoveFriend,
  onRespondToRequest,
  onSendFriendRequest,
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
          onInviteToChat={onInviteToChat}
          onInviteToTable={onInviteToTable}
          onRemoveFriend={onRemoveFriend}
          onRespondToRequest={onRespondToRequest}
          onSendFriendRequest={onSendFriendRequest}
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
