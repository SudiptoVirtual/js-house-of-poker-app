const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const mongoose = require('mongoose');

const controllerPath = require.resolve('../src/controllers/feedController');
const notificationServicePath = require.resolve('../src/services/feedNotificationService');
const realtimeServicePath = require.resolve('../src/services/feedRealtimeService');
const FeedPost = require('../src/models/FeedPost');
const FeedReaction = require('../src/models/FeedReaction');
const FeedShare = require('../src/models/FeedShare');

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, '0'));
}

function installMockModule(resolvedPath, exports) {
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    path: path.dirname(resolvedPath),
    exports,
  };
}

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function selectable(value) {
  return {
    select() {
      return Promise.resolve(value);
    },
  };
}

function queryResult(value) {
  return {
    select() {
      return Promise.resolve(value);
    },
    sort() {
      return selectable(value);
    },
  };
}

function sessionSelectable(value) {
  return {
    session() {
      return Promise.resolve(value);
    },
  };
}

test('createShare records facebook feed-post shares with metadata payload', async (t) => {
  const originals = {
    feedFindOne: FeedPost.findOne,
    findByIdAndUpdate: FeedPost.findByIdAndUpdate,
    reactionFind: FeedReaction.find,
    shareCreate: FeedShare.create,
    shareFindOne: FeedShare.findOne,
  };

  const postId = objectId('100');
  const userId = objectId('101');
  const createdInputs = [];
  const post = {
    _id: postId,
    authorUserId: objectId('102'),
    populate: async () => {},
    toClient: () => ({ id: String(postId), shareCount: 1 }),
  };

  installMockModule(notificationServicePath, {
    createFeedCommentNotification: async () => [],
    createFeedGiftClipNotification: async () => [],
    createFeedShareNotification: async () => [],
    createFeedSupportNotification: async () => [],
    createFeedTableInviteNotifications: async () => [],
    emitFeedNotificationRecords: () => {},
  });
  installMockModule(realtimeServicePath, { getFeedRealtimeService: () => null });
  delete require.cache[controllerPath];

  FeedPost.findOne = () => sessionSelectable(post);
  FeedPost.findByIdAndUpdate = async () => post;
  FeedReaction.find = () => ({ session: () => ({ select: async () => [] }) });
  FeedShare.findOne = () => queryResult(null);
  FeedShare.create = async (input) => {
    createdInputs.push(input);
    return {
      _id: objectId('103'),
      ...input,
      createdAt: new Date('2026-06-22T12:00:00.000Z'),
      toClient: FeedShare.schema.methods.toClient,
    };
  };

  t.after(() => {
    Object.assign(FeedPost, { findOne: originals.feedFindOne, findByIdAndUpdate: originals.findByIdAndUpdate });
    Object.assign(FeedReaction, { find: originals.reactionFind });
    Object.assign(FeedShare, { create: originals.shareCreate, findOne: originals.shareFindOne });
    delete require.cache[controllerPath];
    delete require.cache[notificationServicePath];
    delete require.cache[realtimeServicePath];
  });

  const { createShare } = require('../src/controllers/feedController');
  const res = createResponse();

  await createShare(
    {
      body: {
        destination: 'facebook',
        metadata: {
          deepLink: 'houseofpoker://feed/posts/abc',
          postUrl: 'https://api.example.test/feed/posts/abc',
          sharedVia: 'facebook',
        },
        targetId: String(postId),
        targetType: 'feed-post',
      },
      params: { postId: String(postId) },
      user: { _id: userId },
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(createdInputs.length, 1);
  assert.equal(createdInputs[0].destination, 'facebook');
  assert.equal(createdInputs[0].targetType, 'feed-post');
  assert.deepEqual(createdInputs[0].metadata, {
    deepLink: 'houseofpoker://feed/posts/abc',
    postUrl: 'https://api.example.test/feed/posts/abc',
    sharedVia: 'facebook',
  });
  assert.equal(res.body.share.destination, 'facebook');
  assert.equal(res.body.share.targetType, 'feed-post');
});

test('createShare returns clear conflict and rate-limit responses for facebook shares', async (t) => {
  const originals = {
    feedFindOne: FeedPost.findOne,
    reactionFind: FeedReaction.find,
    shareFindOne: FeedShare.findOne,
  };

  const postId = objectId('200');
  const userId = objectId('201');
  const post = {
    _id: postId,
    populate: async () => {},
    toClient: () => ({ id: String(postId) }),
  };

  installMockModule(notificationServicePath, {
    createFeedCommentNotification: async () => [],
    createFeedGiftClipNotification: async () => [],
    createFeedShareNotification: async () => [],
    createFeedSupportNotification: async () => [],
    createFeedTableInviteNotifications: async () => [],
    emitFeedNotificationRecords: () => {},
  });
  installMockModule(realtimeServicePath, { getFeedRealtimeService: () => null });
  delete require.cache[controllerPath];

  FeedPost.findOne = () => sessionSelectable(post);
  FeedReaction.find = () => ({ session: () => ({ select: async () => [] }) });

  t.after(() => {
    Object.assign(FeedPost, { findOne: originals.feedFindOne });
    Object.assign(FeedReaction, { find: originals.reactionFind });
    Object.assign(FeedShare, { findOne: originals.shareFindOne });
    delete require.cache[controllerPath];
    delete require.cache[notificationServicePath];
    delete require.cache[realtimeServicePath];
  });

  const { createShare } = require('../src/controllers/feedController');
  const req = {
    body: { destination: 'facebook', targetId: String(postId), targetType: 'feed-post' },
    params: { postId: String(postId) },
    user: { _id: userId },
  };

  FeedShare.findOne = () => selectable({ _id: objectId('202') });
  const duplicateRes = createResponse();
  await createShare(req, duplicateRes);
  assert.equal(duplicateRes.statusCode, 409);
  assert.equal(duplicateRes.body.code, 'DUPLICATE_FEED_SHARE');

  let findCall = 0;
  FeedShare.findOne = () => {
    findCall += 1;
    return findCall === 1 ? selectable(null) : queryResult({ _id: objectId('203'), createdAt: new Date() });
  };
  const rateLimitRes = createResponse();
  await createShare(req, rateLimitRes);
  assert.equal(rateLimitRes.statusCode, 429);
  assert.equal(rateLimitRes.body.code, 'FEED_SHARE_RATE_LIMITED');
});
