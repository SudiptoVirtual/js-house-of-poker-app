const MAX_CHAT_ATTACHMENTS = 4;
const MAX_CHAT_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const SUPPORTED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const VALID_MODERATION_STATUSES = new Set(["accepted", "blocked", "pending-review"]);

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeAttachment(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Chat media attachment must be an object.");
  const url = String(input.url || input.uri || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Chat media attachment must include a valid URL.");
  const mimeType = String(input.mimeType || input.contentType || "").toLowerCase().split(";")[0].trim();
  const type = input.type === "video" || mimeType.startsWith("video/") ? "video" : "image";
  const supported = type === "video" ? SUPPORTED_VIDEO_MIME_TYPES : SUPPORTED_IMAGE_MIME_TYPES;
  if (!supported.has(mimeType)) throw new Error(`Unsupported chat ${type} attachment type.`);
  const size = normalizePositiveNumber(input.size ?? input.fileSize);
  if (size && size > MAX_CHAT_ATTACHMENT_BYTES) throw new Error("Chat media attachment exceeds the 50 MB size limit.");
  const moderationStatus = String(input.moderationStatus || input.moderation?.status || "accepted").trim();
  if (!VALID_MODERATION_STATUSES.has(moderationStatus)) throw new Error("Invalid chat media moderation status.");
  if (moderationStatus === "blocked") throw new Error("This chat media attachment was blocked by moderation.");
  return {
    durationMs: type === "video" ? normalizePositiveNumber(input.durationMs ?? input.duration) : null,
    height: normalizePositiveNumber(input.height),
    mimeType,
    moderation: { flags: input.moderation?.flags || [], reason: input.moderation?.reason || null, reviewedAt: input.moderation?.reviewedAt || null, status: moderationStatus },
    size,
    thumbnailUrl: input.thumbnailUrl || null,
    type,
    url,
    width: normalizePositiveNumber(input.width),
  };
}

function normalizeChatMediaAttachments(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  if (raw.length > MAX_CHAT_ATTACHMENTS) throw new Error(`Chat messages can include up to ${MAX_CHAT_ATTACHMENTS} media attachments.`);
  return raw.map(normalizeAttachment);
}

module.exports = { MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS, normalizeChatMediaAttachments };
