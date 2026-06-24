import type { FeedPost } from '../../types/feed';

export function mergeSupportResponsePost(
  currentPost: FeedPost,
  responsePost: FeedPost,
  nextSupportedState: boolean,
): FeedPost {
  const responseSupportCount = responsePost.reactionCounts?.support;

  return {
    ...currentPost,
    ...responsePost,
    reactionCounts: {
      ...(currentPost.reactionCounts ?? {}),
      ...(responsePost.reactionCounts ?? {}),
      ...(typeof responseSupportCount === 'number'
        ? { support: responseSupportCount }
        : {}),
    },
    supportedByCurrentPlayer: nextSupportedState,
    supportersCount: responsePost.supportersCount,
  };
}
