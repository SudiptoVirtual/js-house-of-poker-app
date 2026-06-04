import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { FriendsPlayer } from '../../types/friends';
import { FriendQuickActions } from './FriendQuickActions';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerStatusBadge } from './PlayerStatusBadge';

type OnlineFriendCardProps = {
  hasActiveTable: boolean;
  onInviteToChat: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  player: FriendsPlayer;
};

export function OnlineFriendCard({
  hasActiveTable,
  onInviteToChat,
  onInviteToTable,
  onViewProfile,
  player,
}: OnlineFriendCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.identityRow}>
        <Pressable accessibilityRole="button" onPress={() => onViewProfile(player)}>
          <PlayerAvatar
            avatar={player.avatar}
            displayName={player.displayName}
            isOnline={player.isOnline}
            playerId={player.id}
          />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onViewProfile(player)} style={styles.identityText}>
          <Text style={styles.name}>{player.displayName}</Text>
          <Text style={styles.username}>@{player.username}</Text>
          <PlayerStatusBadge status={player.activityStatus} />
        </Pressable>
      </View>
      <FriendQuickActions
        hasActiveTable={hasActiveTable}
        onInviteToChat={onInviteToChat}
        onInviteToTable={onInviteToTable}
        onSendFriendRequest={() => undefined}
        onViewProfile={onViewProfile}
        player={player}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  identityText: {
    flex: 1,
    gap: 5,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  username: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
});
