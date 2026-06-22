export type ViewableFeedPost = {
  hasVideo: boolean;
  isViewable: boolean;
  /** Optional 0-100 percentage of the item that is visible, when the caller can provide it. */
  visiblePercent?: number;
  postId: string;
};

const DEFAULT_VISIBLE_PERCENT = 100;

function prominenceScore(post: ViewableFeedPost) {
  if (!post.isViewable) return 0;
  return typeof post.visiblePercent === 'number'
    ? Math.max(0, Math.min(post.visiblePercent, 100))
    : DEFAULT_VISIBLE_PERCENT;
}

/** Selects at most one substantially visible video, preferring the most prominent item on screen. */
export function selectActiveVideoPostId(viewablePosts: readonly ViewableFeedPost[]) {
  const visiblePosts = viewablePosts.filter((post) => post.isViewable);
  if (visiblePosts.length === 0) return null;

  const targetPosition = (visiblePosts.length - 1) * 0.4;
  let mostProminent: { distance: number; postId: string; score: number } | null = null;

  for (const [position, post] of visiblePosts.entries()) {
    if (!post.hasVideo) continue;
    const score = prominenceScore(post);
    if (score <= 0) continue;
    const distance = Math.abs(position - targetPosition);
    if (
      !mostProminent ||
      score > mostProminent.score ||
      (score === mostProminent.score && distance < mostProminent.distance)
    ) {
      mostProminent = { distance, postId: post.postId, score };
    }
  }

  return mostProminent ? mostProminent.postId : null;
}
