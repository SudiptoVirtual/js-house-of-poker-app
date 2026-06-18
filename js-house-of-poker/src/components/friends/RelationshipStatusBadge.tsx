import type { RelationshipStatus } from '../../types/friends';
import { getRelationshipBadge, PlayerMetaBadge } from '../player/PlayerMetaBadge';

type RelationshipStatusBadgeProps = {
  status: RelationshipStatus;
};

export function RelationshipStatusBadge({ status }: RelationshipStatusBadgeProps) {
  const badge = getRelationshipBadge(status);

  return <PlayerMetaBadge label={badge.label} tone={badge.tone} />;
}
