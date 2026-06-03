import type { BackendShareDestinationId, FeedComment, FeedPost, FeedReactionSummary } from '../../types/feed';
import { apiRequest } from './client';


export type FeedShare = {
  channel: BackendShareDestinationId;
  createdAt: string | null;
  destination: BackendShareDestinationId;
  id: string;
  metadata: Record<string, unknown>;
  postId: string;
  targetId: string | null;
  targetIdentifiers: {
    roomId?: string;
    tableId?: string;
    userId?: string;
  };
  targetType: string | null;
  userId: string;
};

export type FeedShareResponse = {
  post: FeedPost;
  share: FeedShare;
};

export type FeedGiftClip = {
  amount: number;
  createdAt: string | null;
  id: string;
  message: string;
  postId: string;
  recipientTransactionId: string | null;
  recipientUserId: string;
  senderTransactionId: string | null;
  senderUserId: string;
  transactionId: string | null;
  transactionIds: {
    recipient: string | null;
    sender: string | null;
  };
};

export type FeedGiftClipResponse = {
  balances?: {
    recipientChips: number | null;
    senderChips: number | null;
  };
  giftClip: FeedGiftClip;
  post: FeedPost;
  transactionIds: {
    recipient: string | null;
    sender: string | null;
  };
  transactions?: {
    recipient: string | null;
    sender: string | null;
  };
};

export type SendFeedGiftClipInput = {
  amount: number;
  message?: string;
  recipientUserId?: string;
};

export type CreateFeedShareInput = {
  destination: BackendShareDestinationId;
  metadata?: Record<string, string | number | boolean | null>;
  roomId?: string;
  tableId?: string;
  targetId?: string;
  targetType?: string;
  targetUserId?: string;
};

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


export async function createFeedShare(postId: string, input: CreateFeedShareInput, token: string) {
  return apiRequest<FeedShareResponse>(`/api/feed/${encodeURIComponent(postId)}/shares`, {
    body: input,
    method: 'POST',
    token,
  });
}


export async function sendFeedGiftClip(postId: string, input: SendFeedGiftClipInput, token: string) {
  return apiRequest<FeedGiftClipResponse>(`/api/feed/${encodeURIComponent(postId)}/gift-clips`, {
    body: input,
    method: 'POST',
    token,
  });
}
