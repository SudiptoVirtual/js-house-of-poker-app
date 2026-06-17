export { authenticateWithGoogle, fetchCurrentUser, loginUser, registerUser } from './api/auth';
export type { AuthResponse, AuthUser } from './api/auth';
export { ApiError, apiRequest, getApiErrorDetails } from './api/client';
export {
  createFeedComment,
  createFeedPost,
  createFeedPromotion,
  createFeedShare,
  deleteFeedPost,
  deleteFeedComment,
  fetchFeedComments,
  fetchFeedPosts,
  fetchFeedReactionSummaries,
  sendFeedGiftClip,
  sendFeedTableInvite,
  toggleFeedSupport,
  uploadFeedMedia,
  updateFeedComment,
  updateFeedPost,
} from './api/feed';
export type {
  CreateFeedPostInput,
  CreateFeedPostResponse,
  DeleteFeedCommentResponse,
  DeleteFeedPostResponse,
  CreateFeedPromotionInput,
  CreateFeedShareInput,
  FeedCommentResponse,
  FeedCommentsResponse,
  FeedGiftClip,
  FeedPromotion,
  FeedPromotionResponse,
  FeedGiftClipResponse,
  FeedPostsResponse,
  FeedReactionSummariesResponse,
  FeedShare,
  FeedShareResponse,
  FeedSupportResponse,
  FeedTableInviteRecord,
  FeedTableInviteResponse,
  SendFeedGiftClipInput,
  SendFeedTableInviteInput,
  UpdateFeedPostInput,
} from './api/feed';

export {
  acceptFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOnlineFriends,
  fetchPublicUserProfile,
  rejectFriendRequest,
  removeFriend,
  searchPlayers,
  sendFriendRequest,
} from './api/friends';
export type { PublicUserProfile } from './api/friends';
