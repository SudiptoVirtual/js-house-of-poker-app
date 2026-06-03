import type { FeedComment, FeedPost, FeedReactionSummary } from '../../types/feed';
import { apiRequest } from './client';

export type FeedCommentResponse = {
  comment: FeedComment;
  post: FeedPost;
};

export type DeleteFeedCommentResponse = {
  comment: FeedComment;
  deleted: boolean;
  post: FeedPost | null;
};

export type FeedSupportResponse = {
  post: FeedPost;
  reaction: {
    deletedAt: string | null;
    id: string;
    postId: string;
    reactionType: string;
    type: string;
    userId: string;
  } | null;
  reactionCounts: Record<string, number>;
  summaries: FeedReactionSummary[];
  supported: boolean;
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
};

export type FeedReactionSummariesResponse = {
  post: FeedPost;
  reactionCounts: Record<string, number>;
  summaries: FeedReactionSummary[];
  supportedByCurrentPlayer?: boolean;
  supportersCount: number;
};

export type FeedCommentsResponse = {
  comments: FeedComment[];
  pagination: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
  post: FeedPost;
};

export async function createFeedComment(postId: string, comment: string, token: string) {
  return apiRequest<FeedCommentResponse>(`/api/feed/${encodeURIComponent(postId)}/comments`, {
    body: { comment },
    method: 'POST',
    token,
  });
}

export async function fetchFeedComments(postId: string, token?: string | null) {
  return apiRequest<FeedCommentsResponse>(`/api/feed/${encodeURIComponent(postId)}/comments`, { token });
}

export async function updateFeedComment(postId: string, commentId: string, comment: string, token: string) {
  return apiRequest<FeedCommentResponse>(
    `/api/feed/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    {
      body: { comment },
      method: 'PATCH',
      token,
    },
  );
}

export async function deleteFeedComment(postId: string, commentId: string, token: string) {
  return apiRequest<DeleteFeedCommentResponse>(
    `/api/feed/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}


export async function toggleFeedSupport(postId: string, supported: boolean, token: string) {
  return apiRequest<FeedSupportResponse>(`/api/feed/${encodeURIComponent(postId)}/reactions`, {
    body: { reactionType: 'support', supported },
    method: 'POST',
    token,
  });
}

export async function fetchFeedReactionSummaries(postId: string, token?: string | null) {
  return apiRequest<FeedReactionSummariesResponse>(`/api/feed/${encodeURIComponent(postId)}/reactions`, { token });
}
