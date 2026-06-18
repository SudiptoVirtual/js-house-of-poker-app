import type { FriendsPlayer } from '../../types/friends';
import { FriendQuickActions } from './FriendQuickActions';
import { PlayerIdentityCard } from '../player/PlayerIdentityCard';
import { getActivityBadge } from '../player/PlayerMetaBadge';

type OnlineFriendCardProps = {
  hasActiveTable: boolean;
  onInviteToChatRoom: (player: FriendsPlayer) => void;
  onInviteToTable: (player: FriendsPlayer) => void;
  onStartDirectChat: (player: FriendsPlayer) => void;
  onViewProfile: (player: FriendsPlayer) => void;
  player: FriendsPlayer;
};

export function OnlineFriendCard({
  hasActiveTable,
  onInviteToChatRoom,
  onInviteToTable,
  onStartDirectChat,
  onViewProfile,
  player,
}: OnlineFriendCardProps) {
  const activityBadge = getActivityBadge(player.activityStatus);

  return (
    <PlayerIdentityCard
      avatar={player.avatar}
      badges={[activityBadge]}
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
        onSendFriendRequest={() => undefined}
        onStartDirectChat={onStartDirectChat}
        onViewProfile={onViewProfile}
        player={player}
      />
    </PlayerIdentityCard>
  );
}
