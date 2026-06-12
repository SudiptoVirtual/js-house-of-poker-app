import type { FeedMedia } from '../../types/feed';
import type { UploadFeedMediaInput } from '../../services/api/feed';

export type PendingFeedAttachment = UploadFeedMediaInput & { id: string; type: 'image' | 'video' };
export function appendFeedAttachments(current: PendingFeedAttachment[], selected: PendingFeedAttachment[], limit = 4) { return [...current, ...selected].slice(0, limit); }
export function removeFeedAttachment(current: PendingFeedAttachment[], id: string) { return current.filter((item) => item.id !== id); }
export async function uploadAttachmentsAndCreatePost(
  attachments: PendingFeedAttachment[], content: string,
  upload: (attachment: UploadFeedMediaInput) => Promise<FeedMedia>,
  create: (input: { content: string; media: FeedMedia[] }) => Promise<unknown>,
) {
  const media = await Promise.all(attachments.map(upload));
  return create({ content: content.trim(), media });
}
