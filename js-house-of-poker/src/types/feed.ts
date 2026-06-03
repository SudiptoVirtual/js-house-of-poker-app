import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { PlayerStatusTier } from '../constants/playerStatus';

export type FeedPlayerStatus = 'Online' | 'In Lobby' | 'In Chat Room' | 'Playing 357' | 'At Table' | 'Away';

export type FeedPlayer = {
  avatarUrl?: string;
  handle: string;
  id: string;
  name: string;
  status: FeedPlayerStatus;
  statusTier?: PlayerStatusTier;
};

export type FeedTableContext = {
  gameLabel: string;
  seatsOpen?: number;
  tableCode?: string;
  tableName: string;
};

export type FeedGameContext = {
  headline: string;
  resultLabel?: string;
  stakesLabel?: string;
  tableName?: string;
};

export type FeedPost = {
  commentCount: number;
  content: string;
  gameContext?: FeedGameContext;
  giftClipsCount?: number;
  giftClipsTotal?: number;
  id: string;
  isPromoted: boolean;
  isTableRelated: boolean;
  player: FeedPlayer;
  promotedCount?: number;
  shareCount: number;
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
  tableContext?: FeedTableContext;
  timestamp: string;
};

export type ShareDestination = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: string;
  label: string;
};
