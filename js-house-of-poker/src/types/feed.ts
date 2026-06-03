import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { PlayerStatusTier } from '../constants/playerStatus';

export type FeedPlayerStatus = 'Online' | 'In Lobby' | 'In Chat Room' | 'Playing 357' | 'At Table' | 'Away';

export type FeedNavigationRoute = {
  action?: string;
  deepLink: string;
  params: Record<string, string>;
  route: string;
  screen: string;
};

export type FeedFriendStatus = {
  action: string;
  available: boolean;
  canAddFriend?: boolean;
  canInviteToTable?: boolean;
  isFriend: boolean;
  isSelf?: boolean;
  route: FeedNavigationRoute;
  targetUserId?: string;
};

export type FeedPlayer = {
  actorProfileLink?: FeedNavigationRoute;
  avatarUrl?: string;
  handle: string;
  id: string;
  name: string;
  profileDeepLink?: string;
  profileRoute?: FeedNavigationRoute;
  status: FeedPlayerStatus;
  statusTier?: PlayerStatusTier;
};

export type FeedTableContext = {
  activeTableNavigation?: FeedNavigationRoute;
  gameLabel: string;
  seatsOpen?: number;
  tableCode?: string;
  tableId?: string;
  tableName: string;
};

export type FeedGameContext = {
  headline: string;
  resultLabel?: string;
  stakesLabel?: string;
  tableName?: string;
};

export type FeedPostPromotion = {
  amount: number;
  budgetClips: number;
  durationDays: number;
  endsAt: string | null;
  id: string | null;
  paymentStatus: string | null;
  startsAt: string | null;
  state: string;
};

export type FeedChatRoomContext = {
  activePlayerCount?: number;
  id: string;
  isMember?: boolean;
  isPublic?: boolean;
  name?: string;
  route: FeedNavigationRoute;
  slug?: string;
  topic?: string;
  visibility?: string;
};

export type FeedPost = {
  actorProfileLink?: FeedNavigationRoute;
  chatRoomContext?: FeedChatRoomContext;
  commentCount: number;
  content: string;
  gameContext?: FeedGameContext;
  giftClipsCount?: number;
  giftClipsTotal?: number;
  id: string;
  friendStatus?: FeedFriendStatus;
  isPromoted: boolean;
  isTableRelated: boolean;
  player: FeedPlayer;
  promotion?: FeedPostPromotion;
  promotedCount?: number;
  reactionCounts?: Record<string, number>;
  shareCount: number;
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
  tableContext?: FeedTableContext;
  timestamp: string;
};

export type FeedComment = {
  authorUserId: string;
  body: string | null;
  createdAt: string | null;
  deletedAt: string | null;
  id: string;
  isDeleted?: boolean;
  moderationStatus: string;
  parentCommentId: string | null;
  player: FeedPlayer;
  postId: string;
};

export type FeedReactionSummary = {
  count: number;
  reactionType: string;
  supportedByCurrentPlayer?: boolean;
  type: string;
};

export type FeedCommentSubmitResult = {
  comment: FeedComment;
  post?: FeedPost;
};

export type BackendShareDestinationId = 'copy-link' | 'profile' | 'feed' | 'chat-room' | 'table' | 'facebook' | 'external';
export type ShareMenuActionId = 'promote';
export type ShareDestinationId = BackendShareDestinationId | ShareMenuActionId;

export type ShareDestination = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: ShareDestinationId;
  label: string;
};

export const backendShareDestinations: readonly BackendShareDestinationId[] = [
  'copy-link',
  'profile',
  'feed',
  'chat-room',
  'table',
  'facebook',
  'external',
] as const;

export function isBackendShareDestination(destinationId: ShareDestinationId | string): destinationId is BackendShareDestinationId {
  return backendShareDestinations.includes(destinationId as BackendShareDestinationId);
}
