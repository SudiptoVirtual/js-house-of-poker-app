const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { getStorage } = require("firebase-admin/storage");

const { getFirebaseAdminApp } = require("../utils/firebaseAdmin");

const MAX_ATTACHMENT_COUNT = 5;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_MEDIA_SIZE_LABEL = "50 MB";
const DURABLE_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
const PROCESSING_STATUSES = ["pending", "processing", "ready", "failed"];
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
  constructor(message, code = "INVALID_FEED_MEDIA", statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

function mediaSizeError(actualBytes) {
  return new FeedMediaValidationError(`Attachments must be no larger than ${MAX_MEDIA_SIZE_LABEL}.`, "INVALID_MEDIA_SIZE", 413, {
    actualBytes: Number.isFinite(actualBytes) ? actualBytes : undefined,
    limitLabel: MAX_MEDIA_SIZE_LABEL,
    maxBytes: MAX_MEDIA_BYTES,
  });
}

function mediaErrorPayload(error) {
  const payload = { code: error.code, message: error.message };
  for (const field of ["limitLabel", "maxBytes", "actualBytes"]) {
    if (error[field] !== undefined) payload[field] = error[field];
  }
  return payload;
}

function mediaTypeForMime(mimeType) {
  return SUPPORTED_MIME_TYPES.get(String(mimeType || "").toLowerCase()) || null;
}

function normalizeProcessingStatus(status, type) {
  if (PROCESSING_STATUSES.includes(status)) return status;
  return type === "video" ? "ready" : null;
}

function normalizeVariants(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const variants = {};
  for (const [key, item] of Object.entries(value).slice(0, 10)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const url = String(item.url || "").trim();
    if (!url.startsWith("https://")) continue;
    variants[String(key).slice(0, 40)] = {
      ...(Number.isFinite(item.height) ? { height: Math.max(0, item.height) } : {}),
      ...(item.mimeType ? { mimeType: String(item.mimeType).toLowerCase().slice(0, 120) } : {}),
      ...(Number.isFinite(item.width) ? { width: Math.max(0, item.width) } : {}),
      url,
    };
  }
  return variants;
}

function validateUploadedMedia(media) {
  if (!Array.isArray(media)) throw new FeedMediaValidationError("Media attachments must be an array.");
  if (media.length > MAX_ATTACHMENT_COUNT) throw new FeedMediaValidationError(`Posts support up to ${MAX_ATTACHMENT_COUNT} attachments.`, "TOO_MANY_ATTACHMENTS");

  return media.map((item) => {
    const mimeType = String(item?.mimeType || "").toLowerCase();
    const type = mediaTypeForMime(mimeType);
    const processingStatus = normalizeProcessingStatus(item?.processingStatus, type);
    const url = String(item?.url || "").trim();
    const playableUrl = String(item?.playableUrl || url).trim();
    const size = Number(item?.size ?? item?.metadata?.size);
    if (!type || item?.type !== type) throw new FeedMediaValidationError("Attachment media type is not supported.", "UNSUPPORTED_MEDIA_TYPE");
    if (!url.startsWith("https://")) throw new FeedMediaValidationError("Attachment must use a durable HTTPS URL.", "INVALID_MEDIA_URL");
    if (type === "video" && processingStatus === "ready" && !playableUrl.startsWith("https://")) throw new FeedMediaValidationError("Processed videos must include a playable HTTPS URL.", "INVALID_MEDIA_URL");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_MEDIA_BYTES) throw mediaSizeError(Number.isFinite(size) ? size : undefined);
    return {
      altText: String(item?.altText || "").trim().slice(0, 500),
      durationMs: Number.isFinite(item?.durationMs) ? Math.max(0, item.durationMs) : null,
      height: Number.isFinite(item?.height) ? Math.max(0, item.height) : null,
      metadata: { size, ...(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}) },
      mimeType,
      playableUrl: type === "video" ? playableUrl : undefined,
      processingStatus,
      thumbnailUrl: String(item?.thumbnailUrl || "").trim(),
      type,
      url,
      variants: normalizeVariants(item?.variants),
      width: Number.isFinite(item?.width) ? Math.max(0, item.width) : null,
    };
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} exited with ${code}: ${stderr}`))));
  });
}

async function probeVideo(filePath) {
  const { stdout } = await runCommand("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration:format=duration", "-of", "json", filePath]);
  const data = JSON.parse(stdout || "{}");
  const stream = data.streams?.[0] || {};
  const durationSeconds = Number(stream.duration ?? data.format?.duration);
  return {
    durationMs: Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 1000) : null,
    height: Number.isFinite(Number(stream.height)) ? Number(stream.height) : null,
    width: Number.isFinite(Number(stream.width)) ? Number(stream.width) : null,
  };
}

function storageUrl(bucketName, objectName, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectName)}?alt=media&token=${token}`;
}

async function saveObject(bucket, objectName, data, { contentType, token }) {
  await bucket.file(objectName).save(data, {
    metadata: { cacheControl: DURABLE_MEDIA_CACHE_CONTROL, contentType, metadata: { firebaseStorageDownloadTokens: token } },
    resumable: false,
  });
}

async function processVideoUpload({ bucket, bucketName, buffer, objectBase, originalExtension }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "feed-video-"));
  try {
    const inputPath = path.join(tempDir, `input.${originalExtension || "mp4"}`);
    const outputPath = path.join(tempDir, "playback.mp4");
    const thumbnailPath = path.join(tempDir, "thumbnail.jpg");
    await fs.writeFile(inputPath, buffer);
    await runCommand("ffmpeg", ["-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-vf", "scale='min(1280,iw)':-2", "-c:a", "aac", "-b:a", "128k", outputPath]);
    await runCommand("ffmpeg", ["-y", "-ss", "00:00:01", "-i", outputPath, "-frames:v", "1", "-vf", "scale='min(640,iw)':-2", thumbnailPath]);
    const [playbackBuffer, thumbnailBuffer, probe] = await Promise.all([fs.readFile(outputPath), fs.readFile(thumbnailPath), probeVideo(outputPath)]);
    const playbackToken = crypto.randomUUID();
    const thumbnailToken = crypto.randomUUID();
    const playbackObjectName = `${objectBase}/playback.mp4`;
    const thumbnailObjectName = `${objectBase}/thumbnail.jpg`;
    await Promise.all([
      saveObject(bucket, playbackObjectName, playbackBuffer, { contentType: "video/mp4", token: playbackToken }),
      saveObject(bucket, thumbnailObjectName, thumbnailBuffer, { contentType: "image/jpeg", token: thumbnailToken }),
    ]);
    return {
      ...probe,
      metadata: { processing: { completedAt: new Date().toISOString(), profile: "mp4-h264-aac-faststart" }, size: playbackBuffer.length, sourceSize: buffer.length },
      mimeType: "video/mp4",
      playableUrl: storageUrl(bucketName, playbackObjectName, playbackToken),
      processingStatus: "ready",
      thumbnailUrl: storageUrl(bucketName, thumbnailObjectName, thumbnailToken),
      url: storageUrl(bucketName, playbackObjectName, playbackToken),
      variants: { mp4: { height: probe.height, mimeType: "video/mp4", url: storageUrl(bucketName, playbackObjectName, playbackToken), width: probe.width } },
    };
  } catch (error) {
    throw new FeedMediaValidationError("Unable to process this video. Please upload a valid MP4, MOV, or WebM file.", "VIDEO_PROCESSING_FAILED", 422, { cause: error });
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function uploadFeedMedia({ buffer, mimeType, originalName, userId }) {
  const type = mediaTypeForMime(mimeType);
  if (!type) throw new FeedMediaValidationError("Attachment media type is not supported.", "UNSUPPORTED_MEDIA_TYPE", 415);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) throw mediaSizeError(Buffer.isBuffer(buffer) ? buffer.length : undefined);
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) throw new FeedMediaValidationError("Media storage is not configured.", "MEDIA_STORAGE_NOT_CONFIGURED", 503);
  const safeExtension = String(originalName || "asset").split(".").pop().replace(/[^a-z0-9]/gi, "").slice(0, 8) || (type === "image" ? "jpg" : "mp4");
  const objectBase = `feed/${userId}/${crypto.randomUUID()}`;
  const bucket = getStorage(getFirebaseAdminApp()).bucket(bucketName);

  if (type === "video") {
    return { metadata: { size: buffer.length }, type, ...(await processVideoUpload({ bucket, bucketName, buffer, objectBase, originalExtension: safeExtension })) };
  }

  const objectName = `${objectBase}.${safeExtension}`;
  const token = crypto.randomUUID();
  await saveObject(bucket, objectName, buffer, { contentType: mimeType, token });
  return {
    durationMs: null,
    height: null,
    metadata: { size: buffer.length },
    mimeType: String(mimeType).toLowerCase(),
    processingStatus: null,
    thumbnailUrl: "",
    type,
    url: storageUrl(bucketName, objectName, token),
    variants: {},
    width: null,
  };
}

module.exports = { DURABLE_MEDIA_CACHE_CONTROL, FeedMediaValidationError, MAX_ATTACHMENT_COUNT, MAX_MEDIA_BYTES, MAX_MEDIA_SIZE_LABEL, PROCESSING_STATUSES, SUPPORTED_MIME_TYPES, mediaErrorPayload, mediaSizeError, mediaTypeForMime, uploadFeedMedia, validateUploadedMedia };
