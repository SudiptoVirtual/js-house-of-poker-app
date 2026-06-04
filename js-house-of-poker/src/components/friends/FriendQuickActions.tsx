import { StyleSheet, View } from 'react-native';

import type { FriendsPlayer } from '../../types/friends';
import { ActionButton } from '../ActionButton';
import { InviteToChatButton } from './InviteToChatButton';
import { InviteToTableButton } from './InviteToTableButton';
import { SendFriendRequestButton } from './SendFriendRequestButton';

type FriendQuickActionsProps = {
  hasActiveTable: boolean;
  onInviteToChat: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onRespondToRequest?: (player: FriendsPlayer, response: 'accept' | 'reject') => void;
  onSendFriendRequest: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  player: FriendsPlayer;
  showFriendRequestAction?: boolean;
};

export function FriendQuickActions({
  hasActiveTable,
  onInviteToChat,
  onInviteToTable,
  onRespondToRequest,
  onSendFriendRequest,
  onViewProfile,
  player,
  showFriendRequestAction = false,
}: FriendQuickActionsProps) {
  const canInviteOnlinePlayer = player.isOnline;

  return (
    <View style={styles.actionStack}>
      <ActionButton
        compact
        fullWidth
        icon="account-eye-outline"
        label="View Profile"
        onPress={() => onViewProfile(player)}
        variant="secondary"
      />
      {canInviteOnlinePlayer ? (
        <View style={styles.actionRow}>
          <InviteToChatButton fullWidth={false} onPress={() => onInviteToChat(player)} />
          <InviteToTableButton fullWidth={false} hasActiveTable={hasActiveTable} onPress={() => onInviteToTable(player)} />
        </View>
      ) : null}
      {showFriendRequestAction && player.relationshipStatus === 'not_friends' ? (
        <SendFriendRequestButton onPress={() => onSendFriendRequest(player)} />
      ) : null}
      {showFriendRequestAction && player.relationshipStatus === 'request_received' && onRespondToRequest ? (
        <View style={styles.actionRow}>
          <ActionButton
            compact
            fullWidth
            icon="account-check-outline"
            label="Accept"
            onPress={() => onRespondToRequest(player, 'accept')}
            tone="success"
          />
          <ActionButton
            compact
            fullWidth
            icon="account-cancel-outline"
            label="Reject"
            onPress={() => onRespondToRequest(player, 'reject')}
            tone="danger"
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionStack: {
    gap: 8,
  },
});
