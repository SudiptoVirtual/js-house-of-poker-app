const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Notification = require('../src/models/Notification');
const {
  createTablePlayerJoinedNotification,
  emitTableNotificationRecords,
} = require('../src/services/tableNotificationService');

const ACTOR_ID = '507f1f77bcf86cd799439041';
const HOST_ID = '507f1f77bcf86cd799439042';
const TABLE_ID = '507f1f77bcf86cd799439043';

test('Notification model supports table player joined notifications', () => {
  assert.ok(Notification.NOTIFICATION_TYPES.includes('table_player_joined'));
});

test('createTablePlayerJoinedNotification creates host notification and skips self', async (t) => {
  const originalCreate = Notification.create;
  const createdDocs = [];

  Notification.create = async function createStub(doc) {
    createdDocs.push(doc);
    return {
      ...doc,
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
      createdAt: new Date('2026-06-23T12:00:00.000Z'),
      readAt: null,
    };
  };
  t.after(() => {
    Notification.create = originalCreate;
  });

  const notification = await createTablePlayerJoinedNotification({
    actor: { _id: ACTOR_ID, avatar: 'https://example.test/a.png', name: 'Joiner' },
    recipientUserId: HOST_ID,
    table: { tableCode: 'feed7', tableDbId: TABLE_ID, tableName: 'Feed Table' },
  });
  const skipped = await createTablePlayerJoinedNotification({
    actor: { _id: ACTOR_ID, name: 'Joiner' },
    recipientUserId: ACTOR_ID,
    table: { tableCode: 'feed7', tableDbId: TABLE_ID, tableName: 'Feed Table' },
  });

  assert.equal(createdDocs.length, 1);
  assert.equal(createdDocs[0].type, 'table_player_joined');
  assert.equal(String(createdDocs[0].userId), HOST_ID);
  assert.equal(String(createdDocs[0].actorUserId), ACTOR_ID);
  assert.equal(String(createdDocs[0].tableId), TABLE_ID);
  assert.equal(createdDocs[0].body, 'Joiner joined Feed Table.');
  assert.equal(createdDocs[0].data.tableCode, 'FEED7');
  assert.equal(createdDocs[0].data.table.tableDbId, TABLE_ID);
  assert.equal(notification.type, 'table_player_joined');
  assert.equal(skipped, null);
});

test('emitTableNotificationRecords emits generic notification event to matching user only', () => {
  const recipientEmits = [];
  const otherEmits = [];
  const notification = new Notification({
    _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439045'),
    actorUserId: ACTOR_ID,
    body: 'Joiner joined Feed Table.',
    data: { tableCode: 'FEED7', tableId: 'FEED7' },
    tableId: TABLE_ID,
    title: 'Player joined your table',
    type: 'table_player_joined',
    userId: HOST_ID,
  });
  notification.createdAt = new Date('2026-06-23T12:00:00.000Z');

  emitTableNotificationRecords({
    sockets: {
      sockets: new Map([
        ['recipient', { data: { userId: HOST_ID }, emit: (event, payload) => recipientEmits.push({ event, payload }) }],
        ['other', { data: { userId: ACTOR_ID }, emit: (event, payload) => otherEmits.push({ event, payload }) }],
      ]),
    },
  }, [notification]);

  assert.deepEqual(recipientEmits.map((entry) => entry.event), ['table:notification', 'notification:new']);
  assert.equal(recipientEmits[0].payload.notification.type, 'table_player_joined');
  assert.equal(recipientEmits[0].payload.notification.data.tableCode, 'FEED7');
  assert.equal(otherEmits.length, 0);
});
