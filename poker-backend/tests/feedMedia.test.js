const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const FeedPost = require('../src/models/FeedPost');
const { MAX_ATTACHMENT_COUNT, MAX_MEDIA_BYTES, MAX_MEDIA_SIZE_LABEL, mediaTypeForMime, uploadFeedMedia, validateUploadedMedia } = require('../src/services/feedMediaService');
const validMedia = (overrides = {}) => ({ metadata: { size: 1024 }, mimeType: 'image/jpeg', type: 'image', url: 'https://cdn.example.com/feed/a.jpg', ...overrides });

test('validates durable uploaded media metadata', () => assert.deepEqual(validateUploadedMedia([validMedia()])[0].metadata, { size: 1024 }));
test('rejects invalid MIME, oversized, non-HTTPS, mismatched type, and excessive attachments', () => {
  for (const media of [validMedia({ mimeType: 'application/pdf' }), validMedia({ metadata: { size: 30 * 1024 * 1024 } }), validMedia({ url: 'file:///local.jpg' }), validMedia({ type: 'video' })]) assert.throws(() => validateUploadedMedia([media]));
  assert.equal(MAX_ATTACHMENT_COUNT, 5);
  assert.equal(validateUploadedMedia(Array.from({ length: 5 }, validMedia)).length, 5);
  assert.throws(() => validateUploadedMedia(Array.from({ length: 6 }, validMedia)), (error) => error.code === 'TOO_MANY_ATTACHMENTS');
});
test('supports application video MIME types and rejects oversized video buffers consistently', async () => {
  for (const mimeType of ['video/mp4', 'video/quicktime', 'video/webm']) assert.equal(mediaTypeForMime(mimeType), 'video');
  await assert.rejects(
    uploadFeedMedia({ buffer: Buffer.alloc(MAX_MEDIA_BYTES + 1), mimeType: 'video/mp4', originalName: 'clip.mp4', userId: 'player' }),
    (error) => error.statusCode === 413 && error.code === 'INVALID_MEDIA_SIZE' && error.message === 'Attachments must be no larger than 25 MB.',
  );
  assert.equal(MAX_MEDIA_SIZE_LABEL, '25 MB');
});
test('upload errors return stable JSON codes and readable messages', async () => {
  const previousBucket = process.env.FIREBASE_STORAGE_BUCKET;
  delete process.env.FIREBASE_STORAGE_BUCKET;
  const { uploadMedia } = require('../src/controllers/feedController');
  const response = { payload: null, statusCode: 200, json(value) { this.payload = value; return this; }, status(value) { this.statusCode = value; return this; } };
  await uploadMedia({ body: Buffer.from('video'), headers: { 'content-type': 'video/mp4', 'x-file-name': 'clip.mp4' }, user: { _id: 'player' } }, response);
  if (previousBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET; else process.env.FIREBASE_STORAGE_BUCKET = previousBucket;
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.payload, { code: 'MEDIA_STORAGE_NOT_CONFIGURED', message: 'Media storage is not configured.' });
});
test('FeedPost serializes media for clients', () => {
  const post = new FeedPost({ _id: new mongoose.Types.ObjectId(), authorSnapshot: { handle: '@a', name: 'A' }, authorUserId: new mongoose.Types.ObjectId(), body: '', media: [validMedia()] });
  assert.equal(post.toClient().media[0].url, validMedia().url);
  assert.equal(post.toClient().media[0].type, 'image');
  assert.equal(post.toClient().postType, 'text');
});
test('createPost accepts media-only posts and rejects empty or invalid attachments', async (t) => {
  const FeedPostModel = require('../src/models/FeedPost');
  const originalCreate = FeedPostModel.create;
  let createdInput;
  FeedPostModel.create = async (input) => { createdInput = input; return { _id: new mongoose.Types.ObjectId(), authorUserId: input.authorUserId, toClient: () => ({ content: input.body, media: input.media }) }; };
  t.after(() => { FeedPostModel.create = originalCreate; });
  delete require.cache[require.resolve('../src/controllers/feedController')];
  const { createPost } = require('../src/controllers/feedController');
  const invoke = async (body) => {
    const response = { payload: null, statusCode: 200, json(value) { this.payload = value; return this; }, status(value) { this.statusCode = value; return this; } };
    await createPost({ body, user: { _id: new mongoose.Types.ObjectId(), name: 'Media Player', username: 'media' } }, response);
    return response;
  };
  const mediaOnly = await invoke({ content: '', media: [validMedia()] });
  assert.equal(mediaOnly.statusCode, 201); assert.equal(createdInput.body, ''); assert.equal(createdInput.media.length, 1);
  assert.equal((await invoke({ content: '', media: [] })).statusCode, 400);
  assert.equal((await invoke({ content: '', media: [validMedia({ url: 'file:///bad.jpg' })] })).statusCode, 400);
});
