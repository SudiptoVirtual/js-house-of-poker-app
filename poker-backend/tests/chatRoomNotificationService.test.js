const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoom = require('../src/models/ChatRoom');
const Notification = require('../src/models/Notification');
const {
  createChatRoomGiftClipNotifications,
  serializeNotification,
} = require('../src/services/chatRoomNotificationService');

const SENDER_ID = '507f1f77bcf86cd799439011';
const ROOM_ID = '507f1f77bcf86cd799439012';
const RECIPIENT_ID = '507f1f77bcf86cd799439013';
const MESSAGE_ID = '507f1f77bcf86cd799439014';
const SENDER_TRANSACTION_ID = '507f1f77bcf86cd799439015';
const RECIPIENT_TRANSACTION_ID = '507f1f77bcf86cd799439016';

test('Notification model supports chat room Gift Clip notifications', () => {
  assert.ok(Notification.NOTIFICATION_TYPES.includes('chat_room_gift_clip'));
});

test('createChatRoomGiftClipNotifications creates recipient notification payload without sender notification', async (t) => {
  const originalInsertMany = Notification.insertMany;
  const originalUpdateOne = ChatRoom.updateOne;
  const originalFindById = ChatRoom.findById;
  const insertedDocs = [];
  const unreadUpdates = [];

  Notification.insertMany = async function insertManyStub(docs) {
    insertedDocs.push(...docs);
    return docs.map((doc, index) => ({ _id: `notification-${index}`, ...doc }));
  };
  ChatRoom.updateOne = async function updateOneStub(query, update, options) {
    unreadUpdates.push({ options, query, update });
    return { acknowledged: true };
  };
  ChatRoom.findById = function findByIdStub() {
    return {
      select: async () => ({ participantStates: [{ userId: RECIPIENT_ID }] }),
    };
  };

  t.after(() => {
    Notification.insertMany = originalInsertMany;
    ChatRoom.updateOne = originalUpdateOne;
    ChatRoom.findById = originalFindById;
  });

  const records = await createChatRoomGiftClipNotifications({
    message: {
      _id: MESSAGE_ID,
      giftClip: {
        amount: 25,
        message: 'Thanks for the hand',
        recipientTransactionId: RECIPIENT_TRANSACTION_ID,
        recipientUserId: RECIPIENT_ID,
        senderTransactionId: SENDER_TRANSACTION_ID,
      },
      roomId: ROOM_ID,
      senderDisplayName: 'Sender Player',
      senderUserId: SENDER_ID,
    },
    recipientUserId: RECIPIENT_ID,
    room: {
      _id: ROOM_ID,
      name: 'Social Lounge',
    },
    sender: {
      _id: SENDER_ID,
      name: 'Sender Player',
    },
  });

  assert.equal(records.length, 1);
  assert.equal(insertedDocs.length, 1);
  assert.equal(String(insertedDocs[0].actorUserId), SENDER_ID);
  assert.equal(String(insertedDocs[0].chatRoomId), ROOM_ID);
  assert.equal(String(insertedDocs[0].messageId), MESSAGE_ID);
  assert.equal(String(insertedDocs[0].userId), RECIPIENT_ID);
  assert.equal(insertedDocs[0].type, 'chat_room_gift_clip');
  assert.deepEqual(insertedDocs[0].data, {
    amount: 25,
    chatRoomId: ROOM_ID,
    message: 'Thanks for the hand',
    messageId: MESSAGE_ID,
    recipientUserId: RECIPIENT_ID,
    roomName: 'Social Lounge',
    senderDisplayName: 'Sender Player',
    senderUserId: SENDER_ID,
    transactionIds: {
      recipient: RECIPIENT_TRANSACTION_ID,
      sender: SENDER_TRANSACTION_ID,
    },
    type: 'chat_room_gift_clip',
  });
  assert.equal(unreadUpdates.length, 1);

  const serialized = serializeNotification(records[0]);
  assert.equal(serialized.userId, RECIPIENT_ID);
  assert.equal(serialized.type, 'chat_room_gift_clip');
  assert.equal(serialized.data.amount, 25);
});

test('createChatRoomGiftClipNotifications skips sender self-notifications', async (t) => {
  const originalInsertMany = Notification.insertMany;
  let insertManyCalled = false;

  Notification.insertMany = async function insertManyStub() {
    insertManyCalled = true;
    return [];
  };

  t.after(() => {
    Notification.insertMany = originalInsertMany;
  });

  const records = await createChatRoomGiftClipNotifications({
    amount: 10,
    message: {
      _id: MESSAGE_ID,
      roomId: ROOM_ID,
      senderUserId: SENDER_ID,
    },
    recipientUserId: SENDER_ID,
    room: {
      _id: ROOM_ID,
      name: 'Social Lounge',
    },
    sender: {
      _id: SENDER_ID,
      name: 'Sender Player',
    },
  });

  assert.deepEqual(records, []);
  assert.equal(insertManyCalled, false);
});

test('markRoomNotificationsRead marks only unread chat messages and resets room state', async (t) => {
  const { markRoomNotificationsRead } = require('../src/services/chatRoomNotificationService');
  const originalUpdateMany = Notification.updateMany;
  const originalUpdateOne = ChatRoom.updateOne;
  const notificationUpdates = [];
  const roomUpdates = [];
  Notification.updateMany = async (filter, update) => { notificationUpdates.push({ filter, update }); return { matchedCount: 2, modifiedCount: 2 }; };
  ChatRoom.updateOne = async (filter, update) => { roomUpdates.push({ filter, update }); return { acknowledged: true }; };
  t.after(() => { Notification.updateMany = originalUpdateMany; ChatRoom.updateOne = originalUpdateOne; });

  const result = await markRoomNotificationsRead({ chatRoomId: ROOM_ID, userId: RECIPIENT_ID });

  assert.equal(result.modifiedCount, 2);
  assert.equal(notificationUpdates[0].filter.type, 'chat_message');
  assert.equal(notificationUpdates[0].filter.readAt, null);
  assert.equal(String(notificationUpdates[0].filter.chatRoomId), ROOM_ID);
  assert.equal(String(notificationUpdates[0].filter.userId), RECIPIENT_ID);
  assert.equal(roomUpdates[0].update.$set['participantStates.$.unreadCount'], 0);
});
