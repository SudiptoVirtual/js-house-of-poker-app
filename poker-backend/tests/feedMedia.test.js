const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const FeedPost = require('../src/models/FeedPost');
const { MAX_ATTACHMENT_COUNT, validateUploadedMedia } = require('../src/services/feedMediaService');
const validMedia = (overrides = {}) => ({ metadata: { size: 1024 }, mimeType: 'image/jpeg', type: 'image', url: 'https://cdn.example.com/feed/a.jpg', ...overrides });

test('validates durable uploaded media metadata', () => assert.deepEqual(validateUploadedMedia([validMedia()])[0].metadata, { size: 1024 }));
test('rejects invalid MIME, oversized, non-HTTPS, mismatched type, and excessive attachments', () => {
  for (const media of [validMedia({ mimeType: 'application/pdf' }), validMedia({ metadata: { size: 30 * 1024 * 1024 } }), validMedia({ url: 'file:///local.jpg' }), validMedia({ type: 'video' })]) assert.throws(() => validateUploadedMedia([media]));
  assert.throws(() => validateUploadedMedia(Array.from({ length: MAX_ATTACHMENT_COUNT + 1 }, validMedia)));
});
test('FeedPost serializes media for clients', () => {
  const post = new FeedPost({ _id: new mongoose.Types.ObjectId(), authorSnapshot: { handle: '@a', name: 'A' }, authorUserId: new mongoose.Types.ObjectId(), body: '', media: [validMedia()] });
  assert.equal(post.toClient().media[0].url, validMedia().url);
  assert.equal(post.toClient().media[0].type, 'image');
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
