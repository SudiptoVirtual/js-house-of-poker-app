import type { FeedPost } from '../../types/feed';

export function mergeRealtimePostList(
  currentPosts: FeedPost[],
  incomingPost: FeedPost,
  options: { currentUserId?: string | null; eventUserId?: string | null },
) {
  const existingIndex = currentPosts.findIndex(
    (post) => post.id === incomingPost.id,
  );
  const existingPost = existingIndex >= 0 ? currentPosts[existingIndex] : null;
  const shouldUseIncomingCurrentUserState = Boolean(
    options.eventUserId &&
      options.currentUserId &&
      options.eventUserId === options.currentUserId,
  );
  const mergedPost =
    existingPost && !shouldUseIncomingCurrentUserState
      ? {
          ...incomingPost,
          supportedByCurrentPlayer: existingPost.supportedByCurrentPlayer,
        }
      : incomingPost;

  if (existingIndex < 0) {
    return [mergedPost, ...currentPosts];
  }

  const nextPosts = [...currentPosts];
  nextPosts[existingIndex] = mergedPost;
  return nextPosts;
}
