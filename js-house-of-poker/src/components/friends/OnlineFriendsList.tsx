import { FlatList, StyleSheet, View } from 'react-native';

import type { FriendsPlayer } from '../../types/friends';
import { EmptyOnlineFriendsState } from './EmptyOnlineFriendsState';
import { OnlineFriendCard } from './OnlineFriendCard';

type OnlineFriendsListProps = {
  hasActiveTable: boolean;
  onInviteToChat: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  players: FriendsPlayer[];
};

export function OnlineFriendsList({
  hasActiveTable,
  onInviteToChat,
  onInviteToTable,
  onViewProfile,
  players,
}: OnlineFriendsListProps) {
  return (
    <FlatList
      data={players}
      keyExtractor={(player) => player.id}
      ListEmptyComponent={<EmptyOnlineFriendsState />}
      renderItem={({ item }) => (
        <OnlineFriendCard
          hasActiveTable={hasActiveTable}
          onInviteToChat={onInviteToChat}
          onInviteToTable={onInviteToTable}
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
  separator: {
    height: 12,
  },
});
