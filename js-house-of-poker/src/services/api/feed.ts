import { env } from '../../config/env';
import type { BackendShareDestinationId, FeedComment, FeedGameContext, FeedMedia, FeedPost, FeedReactionSummary, FeedTableContext } from '../../types/feed';
import { ApiError, apiRequest, parseApiPayload } from './client';


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

type FeedPostTableReference = { tableCode: string; tableId?: string } | { tableCode?: string; tableId: string };

type CreateFeedPostCommon = {
  visibility?: 'public' | 'friends' | 'private' | 'unlisted';
};

export type CreateFeedPostInput = CreateFeedPostCommon & (
  | { postType: 'text'; content: string; media?: never }
  | { postType: 'media'; content?: string; media: FeedMedia[] }
  | ({ postType: 'table_invite'; content?: string; media?: FeedMedia[]; tableContext?: FeedTableContext } & FeedPostTableReference)
  | ({ postType: 'win_share'; content?: string; gameContext: FeedGameContext; media?: FeedMedia[]; tableContext?: FeedTableContext } & FeedPostTableReference)
);

export type CreateFeedPostResponse<TPost extends FeedPost = FeedPost> = {
  post: TPost;
};

export type UpdateFeedPostInput = {
  content: string;
  media?: FeedMedia[];
};

export type DeleteFeedPostResponse = {
  deleted: boolean;
  postId: string;
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
  fileSize?: number;
  mimeType: string;
  name: string;
  uri: string;
};

const SUPPORTED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function normalizeUpload(input: UploadFeedMediaInput) {
  const requestedMimeType = input.mimeType.toLowerCase().split(';')[0].trim();
  const extension = input.name.split('.').pop()?.toLowerCase();
  const mimeType =
    requestedMimeType === 'video/mov' || (requestedMimeType === 'application/octet-stream' && extension === 'mov')
      ? 'video/quicktime'
      : requestedMimeType;

  if (mimeType.startsWith('video/') && !SUPPORTED_VIDEO_MIME_TYPES.has(mimeType)) {
    throw new Error('This video format is not supported. Please upload an MP4, MOV, or WebM video.');
  }

  const fallbackExtension = mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/webm' ? 'webm' : mimeType.startsWith('video/') ? 'mp4' : 'jpg';
  return { mimeType, name: input.name.trim() || `feed-upload.${fallbackExtension}`, uri: input.uri };
}

export async function uploadFeedMedia(input: UploadFeedMediaInput, token: string): Promise<FeedMedia> {
  const upload = normalizeUpload(input);
  const localResponse = await fetch(upload.uri);
  const body = await localResponse.blob();
  const baseUrl = env.apiBaseUrl;
  if (!baseUrl) throw new Error('The API host is not configured.');
  const response = await fetch(`${baseUrl}/api/feed/media`, {
    body,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': upload.mimeType, 'X-File-Name': upload.name },
    method: 'POST',
  });
  const payload = parseApiPayload(await response.text());
  if (!response.ok || typeof payload !== 'object' || payload === null || !('media' in payload)) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : response.status === 413
          ? 'This video exceeds the 50 MB upload-size limit.'
          : `Unable to upload attachment (HTTP ${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }
  return payload.media as FeedMedia;
}

export async function createFeedPost(input: CreateFeedPostInput, token: string): Promise<CreateFeedPostResponse> {
  return feedApiRequest<CreateFeedPostResponse>('/api/feed', {
    body: input,
    method: 'POST',
    token,
  });
}

export async function updateFeedPost(postId: string, input: UpdateFeedPostInput, token: string) {
  return feedApiRequest<CreateFeedPostResponse>(`/api/feed/${encodeURIComponent(postId)}`, {
    body: input,
    method: 'PATCH',
    token,
  });
}

export async function deleteFeedPost(postId: string, token: string) {
  return feedApiRequest<DeleteFeedPostResponse>(`/api/feed/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
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
