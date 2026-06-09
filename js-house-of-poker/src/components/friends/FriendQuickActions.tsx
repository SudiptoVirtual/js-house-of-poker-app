import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FriendsPlayer } from '../../types/friends';
import { ActionButton } from '../ActionButton';
import { InviteToChatButton } from './InviteToChatButton';
import { InviteToTableButton } from './InviteToTableButton';
import { SendFriendRequestButton } from './SendFriendRequestButton';

type FriendQuickActionsProps = {
  hasActiveTable: boolean;
  onInviteToChat: (player: FriendsPlayer) => void | Promise<void>;
  onInviteToTable: (player: FriendsPlayer) => void | Promise<void>;
  onRespondToRequest?: (player: FriendsPlayer, response: 'accept' | 'reject') => void | Promise<void>;
  onSendFriendRequest: (player: FriendsPlayer) => void | Promise<void>;
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
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function runAction(actionId: string, action: () => void | Promise<void>) {
    if (pendingAction) {
      return;
    }

    setPendingAction(actionId);

    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  }

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
          <InviteToChatButton
            disabled={Boolean(pendingAction)}
            fullWidth={false}
            loading={pendingAction === 'invite-chat'}
            onPress={() => { void runAction('invite-chat', () => onInviteToChat(player)); }}
          />
          <InviteToTableButton
            disabled={Boolean(pendingAction)}
            fullWidth={false}
            hasActiveTable={hasActiveTable}
            loading={pendingAction === 'invite-table'}
            onPress={() => { void runAction('invite-table', () => onInviteToTable(player)); }}
          />
        </View>
      ) : null}
      {showFriendRequestAction && player.relationshipStatus === 'not_friends' ? (
        <SendFriendRequestButton
          disabled={Boolean(pendingAction)}
          loading={pendingAction === 'send-request'}
          onPress={() => { void runAction('send-request', () => onSendFriendRequest(player)); }}
        />
      ) : null}
      {showFriendRequestAction && player.relationshipStatus === 'request_received' && onRespondToRequest ? (
        <View style={styles.actionRow}>
          <ActionButton
            compact
            disabled={Boolean(pendingAction)}
            fullWidth
            icon="account-check-outline"
            label="Accept"
            loading={pendingAction === 'accept-request'}
            onPress={() => { void runAction('accept-request', () => onRespondToRequest(player, 'accept')); }}
            tone="success"
          />
          <ActionButton
            compact
            disabled={Boolean(pendingAction)}
            fullWidth
            icon="account-cancel-outline"
            label="Reject"
            loading={pendingAction === 'reject-request'}
            onPress={() => { void runAction('reject-request', () => onRespondToRequest(player, 'reject')); }}
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
