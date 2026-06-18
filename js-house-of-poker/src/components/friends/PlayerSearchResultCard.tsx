import type { FriendsPlayer } from '../../types/friends';
import { FriendQuickActions } from './FriendQuickActions';
import { PlayerIdentityCard } from '../player/PlayerIdentityCard';
import { getActivityBadge, getRelationshipBadge } from '../player/PlayerMetaBadge';

type PlayerSearchResultCardProps = {
  hasActiveTable: boolean;
  onInviteToChatRoom: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onRemoveFriend?: (player: FriendsPlayer) => void;
  onRespondToRequest: (player: FriendsPlayer, response: 'accept' | 'reject') => void;
  onSendFriendRequest: (player: FriendsPlayer) => void;
  onStartDirectChat: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  player: FriendsPlayer;
};

export function PlayerSearchResultCard({
  hasActiveTable,
  onInviteToChatRoom,
  onInviteToTable,
  onRemoveFriend,
  onRespondToRequest,
  onSendFriendRequest,
  onStartDirectChat,
  onViewProfile,
  player,
}: PlayerSearchResultCardProps) {
  return (
    <PlayerIdentityCard
      avatar={player.avatar}
      badges={[getActivityBadge(player.activityStatus), getRelationshipBadge(player.relationshipStatus)]}
      connected={player.isOnline}
      displayName={player.displayName}
      onPress={() => onViewProfile(player)}
      seed={player.id}
      username={player.username}
    >
      <FriendQuickActions
        hasActiveTable={hasActiveTable}
        onInviteToChatRoom={onInviteToChatRoom}
        onInviteToTable={onInviteToTable}
        onRemoveFriend={onRemoveFriend}
        onRespondToRequest={onRespondToRequest}
        onSendFriendRequest={onSendFriendRequest}
        onStartDirectChat={onStartDirectChat}
        onViewProfile={onViewProfile}
        player={player}
        showFriendRequestAction
      />
    </PlayerIdentityCard>
  );
}
