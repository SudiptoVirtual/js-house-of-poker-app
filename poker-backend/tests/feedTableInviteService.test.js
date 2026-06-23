const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../src/models/User');
const { buildFeedInviteRecipients } = require('../src/services/feedTableInviteService');

const SENDER_ID = '507f1f77bcf86cd799439001';
const FRIEND_ONE_ID = '507f1f77bcf86cd799439002';
const FRIEND_TWO_ID = '507f1f77bcf86cd799439003';
const NON_FRIEND_ID = '507f1f77bcf86cd799439004';
const BLOCKED_FRIEND_ID = '507f1f77bcf86cd799439005';
const AUTHOR_ID = '507f1f77bcf86cd799439006';

function selectable(value) {
  return { select: async () => value };
}

async function withUserMocks(t, { findById, find }) {
  const originals = {
    find: User.find,
    findById: User.findById,
  };

  User.findById = findById || (() => { throw new Error('User.findById should not be called'); });
  User.find = find;

  t.after(() => {
    User.find = originals.find;
    User.findById = originals.findById;
  });
}

function buildRecipient(id, extra = {}) {
  return { _id: id, name: `User ${id.slice(-4)}`, ...extra };
}

test('buildFeedInviteRecipients returns explicitly requested friends from a populated sender friend list', async (t) => {
  let userFindQuery;
  await withUserMocks(t, {
    find(query) {
      userFindQuery = query;
      return query._id.$in.map((id) => buildRecipient(id));
    },
  });

  const recipients = await buildFeedInviteRecipients({
    payload: { recipientUserIds: [FRIEND_ONE_ID, FRIEND_TWO_ID] },
    post: { authorUserId: AUTHOR_ID },
    sender: { _id: SENDER_ID, friends: [{ _id: FRIEND_ONE_ID }, FRIEND_TWO_ID] },
  });

  assert.deepEqual(recipients.map((recipient) => String(recipient._id)), [FRIEND_ONE_ID, FRIEND_TWO_ID]);
  assert.deepEqual(userFindQuery, {
    _id: { $in: [FRIEND_ONE_ID, FRIEND_TWO_ID] },
    isBlocked: { $ne: true },
    status: { $ne: 'blocked' },
  });
});

test('buildFeedInviteRecipients loads the sender friend list when it is not already populated', async (t) => {
  let loadedSenderId;
  await withUserMocks(t, {
    findById(id) {
      loadedSenderId = String(id);
      return selectable({ friends: [FRIEND_ONE_ID] });
    },
    find(query) {
      assert.deepEqual(query._id.$in, [FRIEND_ONE_ID]);
      return [buildRecipient(FRIEND_ONE_ID)];
    },
  });

  const recipients = await buildFeedInviteRecipients({
    payload: { recipientUserId: FRIEND_ONE_ID },
    post: { authorUserId: AUTHOR_ID },
    sender: { _id: SENDER_ID },
  });

  assert.equal(loadedSenderId, SENDER_ID);
  assert.deepEqual(recipients.map((recipient) => String(recipient._id)), [FRIEND_ONE_ID]);
});

test('buildFeedInviteRecipients rejects non-friend recipients and does not auto-include the post author', async (t) => {
  let userFindCalled = false;
  await withUserMocks(t, {
    find() {
      userFindCalled = true;
      return [];
    },
  });

  await assert.rejects(
    buildFeedInviteRecipients({
      payload: { recipientUserIds: [NON_FRIEND_ID] },
      post: { authorUserId: AUTHOR_ID },
      sender: { _id: SENDER_ID, friends: [FRIEND_ONE_ID, AUTHOR_ID] },
    }),
    /Only friends can receive feed table invites\./,
  );
  assert.equal(userFindCalled, false);
});

test('buildFeedInviteRecipients rejects blocked friend recipients', async (t) => {
  let userFindQuery;
  await withUserMocks(t, {
    find(query) {
      userFindQuery = query;
      return [];
    },
  });

  await assert.rejects(
    buildFeedInviteRecipients({
      payload: { recipientUserIds: [BLOCKED_FRIEND_ID] },
      post: { authorUserId: AUTHOR_ID },
      sender: { _id: SENDER_ID, friends: [BLOCKED_FRIEND_ID] },
    }),
    /Select at least one friend to invite\./,
  );
  assert.deepEqual(userFindQuery, {
    _id: { $in: [BLOCKED_FRIEND_ID] },
    isBlocked: { $ne: true },
    status: { $ne: 'blocked' },
  });
});

test('buildFeedInviteRecipients rejects self-invites', async (t) => {
  let userFindCalled = false;
  await withUserMocks(t, {
    find() {
      userFindCalled = true;
      return [];
    },
  });

  await assert.rejects(
    buildFeedInviteRecipients({
      payload: { recipientUserIds: [SENDER_ID] },
      post: { authorUserId: AUTHOR_ID },
      sender: { _id: SENDER_ID, friends: [SENDER_ID] },
    }),
    /You cannot invite yourself to a feed table\./,
  );
  assert.equal(userFindCalled, false);
});

test('buildFeedInviteRecipients preserves eligible friends when other requested friends are blocked', async (t) => {
  let userFindQuery;
  await withUserMocks(t, {
    find(query) {
      userFindQuery = query;
      return [buildRecipient(FRIEND_ONE_ID)];
    },
  });

  const recipients = await buildFeedInviteRecipients({
    payload: { recipientUserIds: [FRIEND_ONE_ID, BLOCKED_FRIEND_ID] },
    post: { authorUserId: AUTHOR_ID },
    sender: { _id: SENDER_ID, friends: [FRIEND_ONE_ID, BLOCKED_FRIEND_ID] },
  });

  assert.deepEqual(userFindQuery, {
    _id: { $in: [FRIEND_ONE_ID, BLOCKED_FRIEND_ID] },
    isBlocked: { $ne: true },
    status: { $ne: 'blocked' },
  });
  assert.deepEqual(recipients.map((recipient) => String(recipient._id)), [FRIEND_ONE_ID]);
});

test('buildFeedInviteRecipients caps eligible friend recipients at ten', async (t) => {
  const friendIds = Array.from({ length: 12 }, (_, index) => `507f1f77bcf86cd7994390${String(index + 10).padStart(2, '0')}`);
  let queriedIds;
  await withUserMocks(t, {
    find(query) {
      queriedIds = query._id.$in;
      return queriedIds.map((id) => buildRecipient(id));
    },
  });

  const recipients = await buildFeedInviteRecipients({
    payload: { recipientUserIds: friendIds },
    post: { authorUserId: AUTHOR_ID },
    sender: { _id: SENDER_ID, friends: friendIds },
  });

  assert.equal(recipients.length, 10);
  assert.deepEqual(queriedIds, friendIds.slice(0, 10));
});
