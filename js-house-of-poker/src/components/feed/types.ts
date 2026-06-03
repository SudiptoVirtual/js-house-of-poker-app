import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type FeedPlayerStatus =
  | 'Online'
  | 'In Lobby'
  | 'In Chat Room'
  | 'Playing 357'
  | 'At Table'
  | 'Away';

export type FeedPlayer = {
  avatarInitials: string;
  avatarUri?: string;
  handle: string;
  id: string;
  name: string;
  status: FeedPlayerStatus;
};

export type FeedTableContext = {
  gameLabel: string;
  seatsOpen?: number;
  tableCode?: string;
  tableName: string;
};

export type FeedPost = {
  commentCount: number;
  content: string;
  giftClipsCount?: number;
  giftClipsTotal?: number;
  id: string;
  isPromoted?: boolean;
  isTableRelated?: boolean;
  player: FeedPlayer;
  promotedCount?: number;
  shareCount: number;
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
  tableContext?: FeedTableContext;
  timestampLabel: string;
};

export type ShareDestination = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: string;
  label: string;
};
