export type ViewableFeedPost = {
  hasVideo: boolean;
  isViewable: boolean;
  postId: string;
};

/** Selects at most one visible video nearest the upper-middle position among currently viewable posts. */
export function selectActiveVideoPostId(viewablePosts: readonly ViewableFeedPost[]) {
  const visiblePosts = viewablePosts.filter((post) => post.isViewable);
  if (visiblePosts.length === 0) return null;

  const targetPosition = (visiblePosts.length - 1) * 0.4;
  let closest: { distance: number; postId: string } | null = null;

  for (const [position, post] of visiblePosts.entries()) {
    if (!post.hasVideo) continue;
    const distance = Math.abs(position - targetPosition);
    if (!closest || distance < closest.distance) closest = { distance, postId: post.postId };
  }

  return closest ? closest.postId : null;
}
