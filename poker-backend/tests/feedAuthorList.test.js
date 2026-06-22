const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const FeedPost = require('../src/models/FeedPost');
const FeedReaction = require('../src/models/FeedReaction');
const User = require('../src/models/User');
const controllerPath = require.resolve('../src/controllers/feedController');

function response() {
  return {
    payload: null,
    statusCode: 200,
    json(value) { this.payload = value; return this; },
    status(value) { this.statusCode = value; return this; },
  };
}

function readPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

function matchesCondition(value, condition) {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    const hasOperator = Object.keys(condition).some((key) => key.startsWith('$'));
    if (!hasOperator) return String(value) === String(condition);
    if ('$ne' in condition && value === condition.$ne) return false;
    if ('$in' in condition && !condition.$in.includes(value)) return false;
    if ('$lt' in condition && !(value < condition.$lt)) return false;
    return true;
  }
  return String(value) === String(condition);
}

function matchesQuery(post, query) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$or') return condition.some((candidate) => matchesQuery(post, candidate));
    if (key === '$and') return condition.every((candidate) => matchesQuery(post, candidate));
    return matchesCondition(readPath(post, key), condition);
  });
}

function makePost({ authorUserId, body, moderationStatus = 'accepted', status = 'published', visibility }) {
  const _id = new mongoose.Types.ObjectId();
  return {
    _id,
    authorUserId,
    body,
    createdAt: new Date(),
    isPromoted: false,
    moderation: { status: moderationStatus },
    postKind: 'standard',
    postType: 'text',
    status,
    visibility,
    toClient(options = {}) {
      return {
        authorUserId: String(this.authorUserId),
        content: this.body,
        id: String(this._id),
        supportedByCurrentPlayer: Boolean(options.currentUserId && this.supportedByCurrentPlayer),
        visibility: this.visibility,
      };
    },
  };
}

function chain(value) {
  return {
    sort() { return this; },
    limit() { return Promise.resolve(value); },
  };
}

async function withMockedFeedPosts(t, posts, callback) {
  const originals = {
    feedFind: FeedPost.find,
    reactionFind: FeedReaction.find,
    userFindById: User.findById,
  };
  let lastQuery;
  FeedPost.find = (query) => {
    lastQuery = query;
    return chain(posts.filter((post) => matchesQuery(post, query)));
  };
  FeedReaction.find = () => ({ session() { return this; }, select: async () => [] });
  User.findById = () => ({ select: async () => ({ friends: [] }) });
  delete require.cache[controllerPath];
  t.after(() => {
    FeedPost.find = originals.feedFind;
    FeedReaction.find = originals.reactionFind;
    User.findById = originals.userFindById;
    delete require.cache[controllerPath];
  });
  const controller = require('../src/controllers/feedController');
  return callback(controller, () => lastQuery);
}

test('GET /api/feed?authorUserId=<current user> returns current author visible posts except blocked or unpublished', async (t) => {
  const currentUserId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const posts = [
    makePost({ authorUserId: currentUserId, body: 'public self', visibility: 'public' }),
    makePost({ authorUserId: currentUserId, body: 'private self', visibility: 'private' }),
    makePost({ authorUserId: currentUserId, body: 'friends self', visibility: 'friends' }),
    makePost({ authorUserId: currentUserId, body: 'unlisted self', visibility: 'unlisted' }),
    makePost({ authorUserId: currentUserId, body: 'blocked self', moderationStatus: 'blocked', visibility: 'public' }),
    makePost({ authorUserId: currentUserId, body: 'draft self', status: 'draft', visibility: 'public' }),
    makePost({ authorUserId: otherUserId, body: 'other public', visibility: 'public' }),
  ];

  await withMockedFeedPosts(t, posts, async ({ listPosts }, getLastQuery) => {
    const res = response();
    await listPosts({ query: { authorUserId: String(currentUserId) }, user: { _id: currentUserId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.posts.map((post) => post.content), ['public self', 'private self', 'friends self', 'unlisted self']);
    assert.deepEqual(getLastQuery().visibility, { $in: ['public', 'friends', 'private', 'unlisted'] });
    assert.equal(getLastQuery().authorUserId, String(currentUserId));
  });
});

test('GET /api/feed?authorUserId=<another user> returns only public posts for that author', async (t) => {
  const currentUserId = new mongoose.Types.ObjectId();
  const viewedAuthorId = new mongoose.Types.ObjectId();
  const posts = [
    makePost({ authorUserId: viewedAuthorId, body: 'public viewed', visibility: 'public' }),
    makePost({ authorUserId: viewedAuthorId, body: 'private viewed', visibility: 'private' }),
    makePost({ authorUserId: viewedAuthorId, body: 'friends viewed', visibility: 'friends' }),
    makePost({ authorUserId: currentUserId, body: 'current public', visibility: 'public' }),
    makePost({ authorUserId: viewedAuthorId, body: 'blocked viewed', moderationStatus: 'blocked', visibility: 'public' }),
  ];

  await withMockedFeedPosts(t, posts, async ({ listPosts }, getLastQuery) => {
    const res = response();
    await listPosts({ query: { authorUserId: String(viewedAuthorId) }, user: { _id: currentUserId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.posts.map((post) => post.content), ['public viewed']);
    assert.equal(getLastQuery().visibility, 'public');
    assert.equal(getLastQuery().authorUserId, String(viewedAuthorId));
    assert.equal('$or' in getLastQuery(), false);
  });
});

test('GET /api/feed preserves global feed visibility separately from author profile filtering', async (t) => {
  const currentUserId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  const posts = [
    makePost({ authorUserId: currentUserId, body: 'self private global', visibility: 'private' }),
    makePost({ authorUserId: otherUserId, body: 'other public global', visibility: 'public' }),
    makePost({ authorUserId: otherUserId, body: 'other private global', visibility: 'private' }),
    makePost({ authorUserId: otherUserId, body: 'other blocked global', moderationStatus: 'blocked', visibility: 'public' }),
  ];

  await withMockedFeedPosts(t, posts, async ({ listPosts }, getLastQuery) => {
    const res = response();
    await listPosts({ query: {}, user: { _id: currentUserId } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.posts.map((post) => post.content), ['self private global', 'other public global']);
    assert.deepEqual(getLastQuery().$or, [{ visibility: 'public' }, { authorUserId: currentUserId }]);
    assert.equal('authorUserId' in getLastQuery(), false);
  });
});
