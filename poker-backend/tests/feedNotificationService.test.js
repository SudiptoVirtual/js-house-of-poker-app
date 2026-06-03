const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Notification = require('../src/models/Notification');
const {
  createFeedCommentNotification,
  createFeedTableInviteNotifications,
  emitFeedNotificationRecords,
  serializeNotification,
} = require('../src/services/feedNotificationService');

const ACTOR_ID = '507f1f77bcf86cd799439011';
const OWNER_ID = '507f1f77bcf86cd799439012';
const RECIPIENT_ID = '507f1f77bcf86cd799439013';
const POST_ID = '507f1f77bcf86cd799439014';
const TABLE_ID = '507f1f77bcf86cd799439015';

function createPost(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(POST_ID),
    authorUserId: new mongoose.Types.ObjectId(OWNER_ID),
    tableCode: 'ROYAL9',
    tableContext: {
      gameLabel: 'Hold’em',
      seatsOpen: 2,
      tableCode: 'ROYAL9',
      tableName: 'Royal Flush',
    },
    tableId: new mongoose.Types.ObjectId(TABLE_ID),
    ...overrides,
  };
}

function createActor(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(ACTOR_ID),
    avatar: 'https://example.test/avatar.png',
    email: 'raiser@example.test',
    handle: 'raiser',
    name: 'River Raiser',
    ...overrides,
  };
}

test('createFeedCommentNotification creates a post owner notification with feed deep-link data', async (t) => {
  const originalInsertMany = Notification.insertMany;
  const insertedDocs = [];

  Notification.insertMany = async function insertManyStub(docs) {
    insertedDocs.push(...docs);
    return docs.map((doc, index) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(`507f1f77bcf86cd7994390${20 + index}`),
      createdAt: new Date('2026-06-03T12:00:00.000Z'),
      readAt: null,
    }));
  };
  t.after(() => {
    Notification.insertMany = originalInsertMany;
  });

  const records = await createFeedCommentNotification({
    actor: createActor(),
    data: { commentId: 'comment-123', commentPreview: 'Nice hand!' },
    post: createPost(),
  });

  assert.equal(records.length, 1);
  assert.equal(insertedDocs.length, 1);
  assert.equal(insertedDocs[0].type, 'feed_comment');
  assert.equal(String(insertedDocs[0].userId), OWNER_ID);
  assert.equal(String(insertedDocs[0].actorUserId), ACTOR_ID);
  assert.equal(String(insertedDocs[0].postId), POST_ID);
  assert.equal(String(insertedDocs[0].tableId), TABLE_ID);
  assert.equal(insertedDocs[0].data.postId, POST_ID);
  assert.equal(insertedDocs[0].data.actor.displayName, 'River Raiser');
  assert.equal(insertedDocs[0].data.actor.handle, '@raiser');
  assert.equal(insertedDocs[0].data.table.tableCode, 'ROYAL9');
  assert.equal(insertedDocs[0].data.route.path, `/feed/${POST_ID}`);
  assert.equal(insertedDocs[0].data.route.deepLink, `houseofpoker://feed/posts/${POST_ID}`);
});

test('feed table invite notifications include invite details and skip the actor recipient', async (t) => {
  const originalInsertMany = Notification.insertMany;
  let insertedDocs = [];

  Notification.insertMany = async function insertManyStub(docs) {
    insertedDocs = docs;
    return docs;
  };
  t.after(() => {
    Notification.insertMany = originalInsertMany;
  });

  await createFeedTableInviteNotifications({
    actor: createActor(),
    inviteRecords: [
      { id: 'invite-a', message: 'Join this table', recipientAccountId: RECIPIENT_ID, status: 'pending' },
      { id: 'invite-self', message: 'Self invite', recipientAccountId: ACTOR_ID, status: 'pending' },
    ],
    post: createPost(),
    recipientUserIds: [RECIPIENT_ID, ACTOR_ID],
    table: {
      _id: new mongoose.Types.ObjectId(TABLE_ID),
      tableCode: 'royal9',
      tableName: 'Royal Flush',
    },
  });

  assert.deepEqual(insertedDocs.map((doc) => String(doc.userId)).sort(), [OWNER_ID, RECIPIENT_ID].sort());
  assert.equal(insertedDocs[0].type, 'feed_table_invite');
  assert.equal(insertedDocs[0].data.invites.length, 2);
  assert.equal(insertedDocs[0].data.invites[0].id, 'invite-a');
  assert.equal(insertedDocs[0].data.table.tableCode, 'ROYAL9');
});

test('serializeNotification and emitFeedNotificationRecords expose postId and emit to matching online users', () => {
  const notification = new Notification({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439016'),
    actorUserId: ACTOR_ID,
    body: 'River Raiser shared your feed post.',
    data: { postId: POST_ID, route: { path: `/feed/${POST_ID}` } },
    postId: POST_ID,
    title: 'Feed post shared',
    type: 'feed_share',
    userId: OWNER_ID,
  });
  notification.createdAt = new Date('2026-06-03T12:00:00.000Z');

  const serialized = serializeNotification(notification);
  assert.equal(serialized.postId, POST_ID);
  assert.equal(serialized.data.postId, POST_ID);

  const recipientEmits = [];
  const otherEmits = [];
  const io = {
    sockets: {
      sockets: new Map([
        ['recipient', { data: { userId: OWNER_ID }, emit: (event, payload) => recipientEmits.push({ event, payload }) }],
        ['other', { data: { userId: RECIPIENT_ID }, emit: (event, payload) => otherEmits.push({ event, payload }) }],
      ]),
    },
  };

  emitFeedNotificationRecords(io, [notification]);

  assert.deepEqual(recipientEmits.map((entry) => entry.event), ['feed:notification', 'notification:new']);
  assert.equal(recipientEmits[0].payload.notification.postId, POST_ID);
  assert.equal(recipientEmits[0].payload.postId, POST_ID);
  assert.equal(otherEmits.length, 0);
});

test('emitFeedTableInviteRecipientEvents emits table invite socket payloads for feed recipients', () => {
  const { emitFeedTableInviteRecipientEvents } = require('../src/services/feedTableInviteService');
  const recipientEmits = [];
  const otherEmits = [];
  const io = {
    sockets: {
      sockets: new Map([
        ['recipient', { data: { userId: RECIPIENT_ID }, emit: (event, payload) => recipientEmits.push({ event, payload }) }],
        ['other', { data: { userId: OWNER_ID }, emit: (event, payload) => otherEmits.push({ event, payload }) }],
      ]),
    },
  };

  const deliveredPlayerIds = emitFeedTableInviteRecipientEvents(io, {
    invites: [
      { id: 'invite-feed', recipientAccountId: RECIPIENT_ID, status: 'pending', source: 'feed' },
    ],
    post: createPost(),
    sender: createActor(),
    tablePayload: {
      tableCode: 'ROYAL9',
      tableDbId: TABLE_ID,
      tableId: 'ROYAL9',
      tableName: 'Royal Flush',
    },
  });

  assert.deepEqual(deliveredPlayerIds, [RECIPIENT_ID]);
  assert.equal(recipientEmits.length, 1);
  assert.equal(recipientEmits[0].event, 'table:playerInvited');
  assert.equal(recipientEmits[0].payload.source, 'feed');
  assert.equal(recipientEmits[0].payload.tableCode, 'ROYAL9');
  assert.deepEqual(recipientEmits[0].payload.invitedPlayerIds, [RECIPIENT_ID]);
  assert.equal(otherEmits.length, 0);
});
