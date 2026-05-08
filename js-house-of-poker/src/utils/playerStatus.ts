import type { PlayerStatusTier, PokerPlayerStatus } from '../types/poker';

export const DEFAULT_PLAYER_STATUS_TIER: PlayerStatusTier = 'none';

const LEGACY_STATUS_BY_TIER: Record<PlayerStatusTier, PokerPlayerStatus> = {
  high_roller: 'HIGH_ROLLER',
  low_roller: 'LOW_ROLLER',
  mid_roller: 'MID_ROLLER',
  none: 'NO_STATUS',
  shark: 'SHARK',
  up_and_coming: 'UP_AND_COMING',
};

export function normalizePlayerStatusTier(value: unknown): PlayerStatusTier {
  if (typeof value !== 'string') {
    return DEFAULT_PLAYER_STATUS_TIER;
  }

  switch (value.trim()) {
    case 'low_roller':
    case 'LOW_ROLLER':
      return 'low_roller';
    case 'mid_roller':
    case 'MID_ROLLER':
      return 'mid_roller';
    case 'up_and_coming':
    case 'UP_AND_COMING':
      return 'up_and_coming';
    case 'high_roller':
    case 'HIGH_ROLLER':
      return 'high_roller';
    case 'shark':
    case 'SHARK':
      return 'shark';
    case 'none':
    case 'NO_STATUS':
    default:
      return DEFAULT_PLAYER_STATUS_TIER;
  }
}

export function playerStatusTierToPokerPlayerStatus(
  tier: PlayerStatusTier,
): PokerPlayerStatus {
  return LEGACY_STATUS_BY_TIER[tier];
}

export function normalizePokerPlayerStatus(value: unknown): PokerPlayerStatus {
  return playerStatusTierToPokerPlayerStatus(normalizePlayerStatusTier(value));
}
