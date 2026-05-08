import type { ImageSourcePropType } from 'react-native';

import type { PokerPlayerStatus } from '../types/poker';

export type PlayerStatusTier =
  | 'none'
  | 'low_roller'
  | 'mid_roller'
  | 'up_and_coming'
  | 'high_roller'
  | 'shark';

export type PlayerStatusAsset = {
  image: ImageSourcePropType;
  label: string;
};

export const PLAYER_STATUS_ASSETS: Record<PlayerStatusTier, PlayerStatusAsset> = {
  none: {
    image: require('../../assets/status-badges/no-status.png'),
    label: 'No Status',
  },
  low_roller: {
    image: require('../../assets/status-badges/low-roller.png'),
    label: 'Low Roller',
  },
  mid_roller: {
    image: require('../../assets/status-badges/mid-roller.png'),
    label: 'Mid Roller',
  },
  up_and_coming: {
    image: require('../../assets/status-badges/up-and-coming.png'),
    label: 'Up and Coming',
  },
  high_roller: {
    image: require('../../assets/status-badges/high-roller.png'),
    label: 'High Roller',
  },
  shark: {
    image: require('../../assets/status-badges/shark.png'),
    label: 'Shark',
  },
};

export function normalizePlayerStatusTier(
  status?: PokerPlayerStatus | PlayerStatusTier | null,
): PlayerStatusTier {
  switch (status) {
    case 'LOW_ROLLER':
    case 'low_roller':
      return 'low_roller';
    case 'MID_ROLLER':
    case 'mid_roller':
      return 'mid_roller';
    case 'UP_AND_COMING':
    case 'up_and_coming':
      return 'up_and_coming';
    case 'HIGH_ROLLER':
    case 'high_roller':
      return 'high_roller';
    case 'SHARK':
    case 'shark':
      return 'shark';
    case 'NO_STATUS':
    case 'none':
    default:
      return 'none';
  }
}
