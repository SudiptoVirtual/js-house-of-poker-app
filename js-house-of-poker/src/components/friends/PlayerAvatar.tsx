import { PlayerAvatar as SharedPlayerAvatar } from '../PlayerAvatar';

type FriendsPlayerAvatarProps = {
  avatar?: string;
  displayName: string;
  isOnline: boolean;
  playerId: string;
  size?: 'lg' | 'md' | 'sm';
};

export function PlayerAvatar({
  avatar,
  displayName,
  isOnline,
  playerId,
  size = 'md',
}: FriendsPlayerAvatarProps) {
  return (
    <SharedPlayerAvatar
      avatar={avatar}
      connected={isOnline}
      name={displayName}
      seed={playerId}
      size={size}
    />
  );
}
