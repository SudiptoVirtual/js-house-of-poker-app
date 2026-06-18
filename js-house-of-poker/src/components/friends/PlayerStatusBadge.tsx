import type { PlayerActivityStatus } from '../../types/friends';
import { getActivityBadge, PlayerMetaBadge } from '../player/PlayerMetaBadge';

type PlayerStatusBadgeProps = {
  status: PlayerActivityStatus;
};

export function PlayerStatusBadge({ status }: PlayerStatusBadgeProps) {
  const badge = getActivityBadge(status);

  return <PlayerMetaBadge label={badge.label} tone={badge.tone} />;
}
