import { FlatList, StyleSheet, View } from 'react-native';

import type { FriendsPlayer } from '../../types/friends';
import { EmptyOnlineFriendsState } from './EmptyOnlineFriendsState';
import { OnlineFriendCard } from './OnlineFriendCard';

type OnlineFriendsListProps = {
  hasActiveTable: boolean;
  onInviteToChatRoom: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onStartDirectChat: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  players: FriendsPlayer[];
};

export function OnlineFriendsList({
  hasActiveTable,
  onInviteToChatRoom,
  onInviteToTable,
  onStartDirectChat,
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
          onInviteToChatRoom={onInviteToChatRoom}
          onInviteToTable={onInviteToTable}
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
  separator: {
    height: 12,
  },
});
