import { env } from '../../config/env';
import type { BackendShareDestinationId, FeedComment, FeedMedia, FeedPost, FeedReactionSummary } from '../../types/feed';
import { ApiError, apiRequest } from './client';


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

export type FeedPromotion = {
  amount: number;
  budgetClips: number;
  checkoutUrl: string | null;
  createdAt: string | null;
  creatorUserId: string;
  durationDays: number;
  endsAt: string | null;
  id: string;
  paymentProvider: string;
  paymentReference: string | null;
  paymentStatus: string;
  postId: string;
  sponsorUserId: string;
  startsAt: string | null;
  state: string;
  targeting?: Record<string, unknown>;
  transactionId: string | null;
  updatedAt: string | null;
};

export type FeedPromotionResponse = {
  checkoutUrl?: string | null;
  post: FeedPost;
  promotion: FeedPromotion;
  transactionId?: string | null;
};

export type CreateFeedPromotionInput = {
  amount: number;
  durationDays?: number;
  paymentProvider?: 'manual' | 'mock' | 'stripe';
  targeting?: {
    audience?: string[];
    gameTypes?: string[];
    locations?: string[];
    metadata?: Record<string, string | number | boolean | null>;
    tableCodes?: string[];
  };
};


export type FeedTableInviteRecord = {
  createdAt: number | string | null;
  id: string;
  message: string | null;
  recipientAccountId: string;
  recipientHandle?: string | null;
  recipientLabel?: string | null;
  senderPlayerId: string;
  senderPlayerName: string;
  source: 'feed' | string;
  status: string;
};

export type FeedTableInviteResponse = {
  deliveredPlayerIds?: string[];
  invitedPlayerIds?: string[];
  invites: FeedTableInviteRecord[];
  message?: string | null;
  ok?: boolean;
  post: FeedPost;
  table: {
    id: string;
    tableCode: string | null;
    tableDbId: string;
    tableId: string;
    tableName?: string | null;
  };
};

export type SendFeedTableInviteInput = {
  message?: string;
  recipientUserId?: string;
  recipientUserIds?: string[];
  tableCode?: string;
  tableId?: string;
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

export type CreateFeedPostInput = {
  content: string;
  gameContext?: Record<string, unknown> | null;
  media?: FeedMedia[];
  postKind?: 'standard' | 'table-invite';
  tableCode?: string;
  tableContext?: Record<string, unknown> | null;
  tableId?: string;
  visibility?: 'public' | 'friends' | 'private' | 'unlisted';
};

export type CreateFeedPostResponse = {
  post: FeedPost;
};

export type FeedPostsResponse = {
  pagination: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
  posts: FeedPost[];
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

type FeedApiRequestOptions = NonNullable<Parameters<typeof apiRequest>[1]>;

function normalizeFeedApiError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    const configuredHost = env.apiBaseUrl || 'the configured API host';

    return new Error(
      `Feed API route was not found on ${configuredHost}. Set EXPO_PUBLIC_BASE_URL to the poker-backend server.`,
    );
  }

  return error;
}

async function feedApiRequest<T>(path: string, options: FeedApiRequestOptions = {}) {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    throw normalizeFeedApiError(error);
  }
}

export async function fetchFeedPosts(token?: string | null) {
  return feedApiRequest<FeedPostsResponse>('/api/feed', { token });
}

export type UploadFeedMediaInput = {
  mimeType: string;
  name: string;
  uri: string;
};

export async function uploadFeedMedia(input: UploadFeedMediaInput, token: string): Promise<FeedMedia> {
  const localResponse = await fetch(input.uri);
  const body = await localResponse.blob();
  const baseUrl = env.apiBaseUrl;
  if (!baseUrl) throw new Error('The API host is not configured.');
  const response = await fetch(`${baseUrl}/api/feed/media`, {
    body,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': input.mimeType, 'X-File-Name': input.name },
    method: 'POST',
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(payload?.message || 'Unable to upload attachment.', response.status, payload);
  return payload.media as FeedMedia;
}

export async function createFeedPost(input: CreateFeedPostInput, token: string): Promise<CreateFeedPostResponse> {
  return feedApiRequest<CreateFeedPostResponse>('/api/feed', {
    body: input,
    method: 'POST',
    token,
  });
}

export async function createFeedComment(postId: string, comment: string, token: string) {
  return feedApiRequest<FeedCommentResponse>(`/api/feed/${encodeURIComponent(postId)}/comments`, {
    body: { comment },
    method: 'POST',
    token,
  });
}

export async function fetchFeedComments(postId: string, token?: string | null) {
  return feedApiRequest<FeedCommentsResponse>(`/api/feed/${encodeURIComponent(postId)}/comments`, { token });
}

export async function updateFeedComment(postId: string, commentId: string, comment: string, token: string) {
  return feedApiRequest<FeedCommentResponse>(
    `/api/feed/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    {
      body: { comment },
      method: 'PATCH',
      token,
    },
  );
}

export async function deleteFeedComment(postId: string, commentId: string, token: string) {
  return feedApiRequest<DeleteFeedCommentResponse>(
    `/api/feed/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      token,
    },
  );
}


export async function toggleFeedSupport(postId: string, supported: boolean, token: string) {
  return feedApiRequest<FeedSupportResponse>(`/api/feed/${encodeURIComponent(postId)}/reactions`, {
    body: { reactionType: 'support', supported },
    method: 'POST',
    token,
  });
}

export async function fetchFeedReactionSummaries(postId: string, token?: string | null) {
  return feedApiRequest<FeedReactionSummariesResponse>(`/api/feed/${encodeURIComponent(postId)}/reactions`, { token });
}


export async function createFeedShare(postId: string, input: CreateFeedShareInput, token: string) {
  return feedApiRequest<FeedShareResponse>(`/api/feed/${encodeURIComponent(postId)}/shares`, {
    body: input,
    method: 'POST',
    token,
  });
}


export async function sendFeedGiftClip(postId: string, input: SendFeedGiftClipInput, token: string) {
  return feedApiRequest<FeedGiftClipResponse>(`/api/feed/${encodeURIComponent(postId)}/gift-clips`, {
    body: input,
    method: 'POST',
    token,
  });
}

export async function sendFeedTableInvite(postId: string, input: SendFeedTableInviteInput, token: string) {
  return feedApiRequest<FeedTableInviteResponse>(`/api/feed/${encodeURIComponent(postId)}/table-invites`, {
    body: input,
    method: 'POST',
    token,
  });
}


export async function createFeedPromotion(postId: string, input: CreateFeedPromotionInput, token: string) {
  return feedApiRequest<FeedPromotionResponse>(`/api/feed/${encodeURIComponent(postId)}/promotions/checkout`, {
    body: input,
    method: 'POST',
    token,
  });
}
