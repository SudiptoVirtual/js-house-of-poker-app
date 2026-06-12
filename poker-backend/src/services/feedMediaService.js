const crypto = require("crypto");
const { getStorage } = require("firebase-admin/storage");

const { getFirebaseAdminApp } = require("../utils/firebaseAdmin");

const MAX_ATTACHMENT_COUNT = 4;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["image/heic", "image"],
  ["image/heif", "image"],
  ["video/mp4", "video"],
  ["video/quicktime", "video"],
  ["video/webm", "video"],
]);

class FeedMediaValidationError extends Error {
  constructor(message, code = "INVALID_FEED_MEDIA", statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function mediaTypeForMime(mimeType) {
  return SUPPORTED_MIME_TYPES.get(String(mimeType || "").toLowerCase()) || null;
}

function validateUploadedMedia(media) {
  if (!Array.isArray(media)) throw new FeedMediaValidationError("Media attachments must be an array.");
  if (media.length > MAX_ATTACHMENT_COUNT) throw new FeedMediaValidationError(`Posts support up to ${MAX_ATTACHMENT_COUNT} attachments.`, "TOO_MANY_ATTACHMENTS");

  return media.map((item) => {
    const mimeType = String(item?.mimeType || "").toLowerCase();
    const type = mediaTypeForMime(mimeType);
    const url = String(item?.url || "").trim();
    const size = Number(item?.size ?? item?.metadata?.size);
    if (!type || item?.type !== type) throw new FeedMediaValidationError("Attachment media type is not supported.", "UNSUPPORTED_MEDIA_TYPE");
    if (!url.startsWith("https://")) throw new FeedMediaValidationError("Attachment must use a durable HTTPS URL.", "INVALID_MEDIA_URL");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_MEDIA_BYTES) throw new FeedMediaValidationError(`Attachments must be no larger than ${MAX_MEDIA_BYTES} bytes.`, "INVALID_MEDIA_SIZE");
    return {
      altText: String(item?.altText || "").trim().slice(0, 500),
      durationMs: Number.isFinite(item?.durationMs) ? Math.max(0, item.durationMs) : null,
      height: Number.isFinite(item?.height) ? Math.max(0, item.height) : null,
      metadata: { size },
      mimeType,
      thumbnailUrl: String(item?.thumbnailUrl || "").trim(),
      type,
      url,
      width: Number.isFinite(item?.width) ? Math.max(0, item.width) : null,
    };
  });
}

async function uploadFeedMedia({ buffer, mimeType, originalName, userId }) {
  const type = mediaTypeForMime(mimeType);
  if (!type) throw new FeedMediaValidationError("Attachment media type is not supported.", "UNSUPPORTED_MEDIA_TYPE", 415);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) throw new FeedMediaValidationError(`Attachments must be no larger than ${MAX_MEDIA_BYTES} bytes.`, "INVALID_MEDIA_SIZE", 413);
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) throw new FeedMediaValidationError("Media storage is not configured.", "MEDIA_STORAGE_NOT_CONFIGURED", 503);
  const safeExtension = String(originalName || "asset").split(".").pop().replace(/[^a-z0-9]/gi, "").slice(0, 8) || (type === "image" ? "jpg" : "mp4");
  const objectName = `feed/${userId}/${crypto.randomUUID()}.${safeExtension}`;
  const token = crypto.randomUUID();
  const bucket = getStorage(getFirebaseAdminApp()).bucket(bucketName);
  const file = bucket.file(objectName);
  await file.save(buffer, { metadata: { contentType: mimeType, metadata: { firebaseStorageDownloadTokens: token } }, resumable: false });
  return {
    metadata: { size: buffer.length },
    mimeType: String(mimeType).toLowerCase(),
    type,
    url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectName)}?alt=media&token=${token}`,
  };
}

module.exports = { FeedMediaValidationError, MAX_ATTACHMENT_COUNT, MAX_MEDIA_BYTES, SUPPORTED_MIME_TYPES, mediaTypeForMime, uploadFeedMedia, validateUploadedMedia };
