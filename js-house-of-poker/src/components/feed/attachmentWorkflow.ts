import type { FeedMedia } from '../../types/feed';
import type { UploadFeedMediaInput } from '../../services/api/feed';

export type PendingFeedAttachment = UploadFeedMediaInput & { id: string; type: 'image' | 'video' };
export const MAX_FEED_ATTACHMENTS = 5;
export const MAX_FEED_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const MAX_FEED_ATTACHMENT_SIZE_LABEL = '50 MB';
export function isFeedAttachmentOversized(attachment: Pick<PendingFeedAttachment, 'fileSize'>) {
  return typeof attachment.fileSize === 'number' && attachment.fileSize > MAX_FEED_ATTACHMENT_BYTES;
}
export function appendFeedAttachments(current: PendingFeedAttachment[], selected: PendingFeedAttachment[], limit = MAX_FEED_ATTACHMENTS) { return [...current, ...selected].slice(0, limit); }
export function removeFeedAttachment(current: PendingFeedAttachment[], id: string) { return current.filter((item) => item.id !== id); }
export async function uploadAttachmentsAndCreatePost(
  attachments: PendingFeedAttachment[], content: string,
  upload: (attachment: UploadFeedMediaInput) => Promise<FeedMedia>,
  create: (input: { content: string; media: FeedMedia[] }) => Promise<unknown>,
) {
  if (attachments.some(isFeedAttachmentOversized)) throw new Error(`Attachments must be no larger than ${MAX_FEED_ATTACHMENT_SIZE_LABEL}.`);
  const media = await Promise.all(attachments.map(upload));
  return create({ content: content.trim(), media });
}
