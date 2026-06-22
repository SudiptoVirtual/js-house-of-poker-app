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
  gameType?: string;
  handId?: string;
  handNumber?: number;
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

export type FeedMediaMetadata = {
  size?: number;
  [key: string]: unknown;
};

type FeedMediaBase = {
  altText: string;
  height: number | null;
  metadata: FeedMediaMetadata;
  mimeType: string;
  url: string;
  width: number | null;
};

export type FeedImageMedia = FeedMediaBase & {
  durationMs: null;
  thumbnailUrl?: string;
  type: 'image';
};

export type FeedVideoMedia = FeedMediaBase & {
  durationMs: number | null;
  thumbnailUrl: string;
  type: 'video';
};

export type FeedMedia = FeedImageMedia | FeedVideoMedia;

export type FeedPostKind = 'standard' | 'table-invite' | 'share-win';
export type FeedPostType = 'text' | 'media' | 'table_invite' | 'win_share';

type FeedPostBase = {
  actorProfileLink?: FeedNavigationRoute;
  authorUserId?: string;
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
  media: FeedMedia[];
  player: FeedPlayer;
  postKind: FeedPostKind;
  postType: FeedPostType;
  promotion?: FeedPostPromotion;
  promotedCount?: number;
  reactionCounts?: Record<string, number>;
  shareCount: number;
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
  tableContext?: FeedTableContext;
  timestamp: string;
};

export type FeedPost = FeedPostBase & (
  | { postType: 'text'; content: string }
  | { postType: 'media'; media: FeedMedia[] }
  | { postType: 'table_invite'; tableContext: FeedTableContext }
  | { postType: 'win_share'; gameContext: FeedGameContext }
);

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
  postKind: FeedPostKind;
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

export type BackendShareDestinationId = 'copy-link' | 'profile' | 'feed' | 'chat-room' | 'table' | 'friend' | 'friends' | 'facebook' | 'external';
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
  'friend',
  'friends',
  'facebook',
  'external',
] as const;

export function isBackendShareDestination(destinationId: ShareDestinationId | string): destinationId is BackendShareDestinationId {
  return backendShareDestinations.includes(destinationId as BackendShareDestinationId);
}
