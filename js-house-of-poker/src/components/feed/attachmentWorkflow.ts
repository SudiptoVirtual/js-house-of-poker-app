import type { FeedMedia } from '../../types/feed';
import type { CreateFeedPostInput, UploadFeedMediaInput } from '../../services/api/feed';

export type PendingFeedAttachment = UploadFeedMediaInput & { id: string; type: 'image' | 'video' };
export function appendFeedAttachments(current: PendingFeedAttachment[], selected: PendingFeedAttachment[], limit = 4) { return [...current, ...selected].slice(0, limit); }
export function removeFeedAttachment(current: PendingFeedAttachment[], id: string) { return current.filter((item) => item.id !== id); }
export async function uploadAttachmentsAndCreatePost(
  attachments: PendingFeedAttachment[], content: string,
  upload: (attachment: UploadFeedMediaInput) => Promise<FeedMedia>,
  create: (input: Pick<CreateFeedPostInput, 'content' | 'media'>) => Promise<unknown>,
) {
  const media = await Promise.all(attachments.map(upload));
  return create({ content: content.trim(), media });
}
