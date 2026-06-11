import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { FriendsPlayer } from '../../types/friends';
import { FriendQuickActions } from './FriendQuickActions';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerStatusBadge } from './PlayerStatusBadge';
import { RelationshipStatusBadge } from './RelationshipStatusBadge';

type PlayerSearchResultCardProps = {
  hasActiveTable: boolean;
  onInviteToChat: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onRemoveFriend?: (player: FriendsPlayer) => void;
  onRespondToRequest: (player: FriendsPlayer, response: 'accept' | 'reject') => void;
  onSendFriendRequest: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  player: FriendsPlayer;
};

export function PlayerSearchResultCard({
  hasActiveTable,
  onInviteToChat,
  onInviteToTable,
  onRemoveFriend,
  onRespondToRequest,
  onSendFriendRequest,
  onViewProfile,
  player,
}: PlayerSearchResultCardProps) {
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
          <View style={styles.badgeRow}>
            <PlayerStatusBadge status={player.activityStatus} />
            <RelationshipStatusBadge status={player.relationshipStatus} />
          </View>
        </Pressable>
      </View>
      <FriendQuickActions
        hasActiveTable={hasActiveTable}
        onInviteToChat={onInviteToChat}
        onInviteToTable={onInviteToTable}
        onRemoveFriend={onRemoveFriend}
        onRespondToRequest={onRespondToRequest}
        onSendFriendRequest={onSendFriendRequest}
        onViewProfile={onViewProfile}
        player={player}
        showFriendRequestAction
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
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
