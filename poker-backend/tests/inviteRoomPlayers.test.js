const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoom = require('../src/models/ChatRoom');
const ChatRoomMessage = require('../src/models/ChatRoomMessage');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const { ChatRoomRealtimeService } = require('../src/services/chatRoomRealtimeService');

const SENDER_ID = '507f1f77bcf86cd799439011';
const ROOM_ID = '507f1f77bcf86cd799439012';
const RECIPIENT_ONE_ID = '507f1f77bcf86cd799439013';
const RECIPIENT_TWO_ID = '507f1f77bcf86cd799439014';
const TABLE_DB_ID = '507f1f77bcf86cd799439015';

function createIoMock() {
  return {
    sockets: {
      sockets: new Map(),
    },
    to() {
      return { emit: () => undefined };
    },
  };
}

function createSocketMock() {
  const emitted = [];
  return {
    data: { userId: SENDER_ID },
    emitted,
    id: 'socket-sender',
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function createRecipientSocket(userId) {
  const emitted = [];
  return {
    data: { userId },
    emitted,
    id: `socket-${userId}`,
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function createService(io) {
  const eligiblePlayerIds = [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID];
  const service = new ChatRoomRealtimeService(io, {
    authenticateSocketUser: async () => ({
      _id: SENDER_ID,
      name: 'Inviter Player',
    }),
    presenceService: {
      getPresenceSnapshot: () => ({
        inviteEligibility: {
          eligiblePlayerIds,
          ineligiblePlayerIds: [],
          invitedPlayerIds: [],
          reasonByPlayerId: {},
        },
        players: eligiblePlayerIds.map((userId) => ({ id: userId, userId })),
      }),
    },
  });

  service.findRoom = async () => ({
    _id: ROOM_ID,
    createdByUserId: SENDER_ID,
    isPublic: false,
    name: 'Invite Lounge',
    participantStates: [
      { userId: SENDER_ID },
      { userId: RECIPIENT_ONE_ID },
      { userId: RECIPIENT_TWO_ID },
    ],
  });
  return service;
}

test('User can invite multiple room players and recipients receive table:playerInvited', async (t) => {
  const originalFind = User.find;
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const originalUpdateOne = ChatRoom.updateOne;
  const originalMessageSave = ChatRoomMessage.prototype.save;
  const originalFindById = ChatRoom.findById;
  const originalInsertMany = Notification.insertMany;
  const updates = [];
  const savedSystemMessages = [];
  const notifications = [];

  User.find = async function findStub(query) {
    assert.deepEqual(query._id.$in, [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID]);
    return [
      { _id: RECIPIENT_ONE_ID, name: 'Recipient One' },
      { _id: RECIPIENT_TWO_ID, name: 'Recipient Two' },
    ];
  };
  User.findByIdAndUpdate = async function findByIdAndUpdateStub(userId, update) {
    assert.equal(String(userId), SENDER_ID);
    assert.equal(update.$inc['referralStats.invitesSent'], 2);
    return { acknowledged: true };
  };
  ChatRoom.updateOne = async function updateOneStub(query, update) {
    updates.push({ query, update });
    return { acknowledged: true };
  };
  ChatRoomMessage.prototype.save = async function saveStub() {
    this._id = this._id || 'invite-system-message';
    savedSystemMessages.push(this);
    return this;
  };
  ChatRoom.findById = function findByIdStub() {
    return {
      select: async () => ({
        participantStates: [{ userId: RECIPIENT_ONE_ID }, { userId: RECIPIENT_TWO_ID }],
      }),
    };
  };
  Notification.insertMany = async function insertManyStub(docs) {
    notifications.push(...docs);
    return docs.map((doc, index) => ({
      _id: `invite-notification-${index}`,
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
      readAt: null,
      ...doc,
    }));
  };
  t.after(() => {
    User.find = originalFind;
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
    ChatRoom.updateOne = originalUpdateOne;
    ChatRoomMessage.prototype.save = originalMessageSave;
    ChatRoom.findById = originalFindById;
    Notification.insertMany = originalInsertMany;
  });

  const io = createIoMock();
  const recipientOneSocket = createRecipientSocket(RECIPIENT_ONE_ID);
  const recipientTwoSocket = createRecipientSocket(RECIPIENT_TWO_ID);
  io.sockets.sockets.set(recipientOneSocket.id, recipientOneSocket);
  io.sockets.sockets.set(recipientTwoSocket.id, recipientTwoSocket);
  const service = createService(io);
  const socket = createSocketMock();
  const pokerRealtimeService = {
    appendTableInviteRecords: async ({ message, recipients, sender, source, tableId }) => {
      assert.equal(message, 'Join my table');
      assert.deepEqual(recipients.map((recipient) => String(recipient._id)), [
        RECIPIENT_ONE_ID,
        RECIPIENT_TWO_ID,
      ]);
      assert.equal(String(sender._id), SENDER_ID);
      assert.equal(source, 'chat-room');
      assert.equal(tableId, 'TABLE42');
      return {
        invites: recipients.map((recipient, index) => ({
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          id: `invite-${index + 1}`,
          message,
          recipientAccountId: String(recipient._id),
          recipientHandle: recipient.name,
          recipientLabel: recipient.name,
          senderPlayerId: SENDER_ID,
          senderPlayerName: 'Inviter Player',
          source: 'chat-room',
          status: 'pending',
        })),
        table: {
          tableCode: 'TABLE42',
          tableDbId: TABLE_DB_ID,
          tableId: 'TABLE42',
          tableName: 'Invite Table',
        },
      };
    },
  };

  const response = await service.inviteRoomPlayers(
    socket,
    {
      message: 'Join my table',
      playerIds: [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID],
      roomId: ROOM_ID,
      tableId: 'TABLE42',
    },
    pokerRealtimeService,
  );

  assert.equal(response.ok, true);
  assert.deepEqual(response.invitedPlayerIds, [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID]);
  assert.deepEqual(response.deliveredPlayerIds, [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID]);
  assert.equal(updates.some((entry) => entry.update.$push?.tableInviteHistory), true);
  assert.equal(notifications.length, 2);
  assert.equal(notifications.every((notification) => notification.type === 'table_invite'), true);
  assert.equal(savedSystemMessages.length, 1);
  assert.equal(savedSystemMessages[0].tone, 'system');

  for (const recipientSocket of [recipientOneSocket, recipientTwoSocket]) {
    const inviteEvent = recipientSocket.emitted.find((entry) => entry.event === 'table:playerInvited');
    assert.ok(inviteEvent);
    assert.equal(inviteEvent.payload.tableCode, 'TABLE42');
    assert.equal(inviteEvent.payload.playerId, recipientSocket.data.userId);
  }

  const senderEvent = socket.emitted.find((entry) => entry.event === 'table:playerInvited');
  assert.ok(senderEvent);
  assert.equal(senderEvent.payload.sender, true);
  assert.deepEqual(senderEvent.payload.invitedPlayerIds, [RECIPIENT_ONE_ID, RECIPIENT_TWO_ID]);
});
