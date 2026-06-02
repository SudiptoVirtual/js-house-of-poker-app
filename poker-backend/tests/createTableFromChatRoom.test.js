const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoom = require('../src/models/ChatRoom');
const ChatRoomMessage = require('../src/models/ChatRoomMessage');
const Notification = require('../src/models/Notification');
const {
  ChatRoomRealtimeService,
  getChatRoomChannel,
} = require('../src/services/chatRoomRealtimeService');

const LAUNCHER_ID = '507f1f77bcf86cd799439011';
const ROOM_ID = '507f1f77bcf86cd799439012';
const INVITED_ID = '507f1f77bcf86cd799439013';
const TABLE_DB_ID = '507f1f77bcf86cd799439014';

function createIoMock() {
  const roomEmissions = [];
  return {
    roomEmissions,
    sockets: {
      sockets: new Map(),
    },
    to(roomId) {
      return {
        emit(event, payload) {
          roomEmissions.push({ event, payload, roomId });
        },
      };
    },
  };
}

function createSocketMock() {
  const emitted = [];
  const peerEmissions = [];
  return {
    data: { userId: LAUNCHER_ID },
    emitted,
    id: 'socket-launcher',
    rooms: new Set([getChatRoomChannel(ROOM_ID)]),
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    to(roomId) {
      return {
        emit(event, payload) {
          peerEmissions.push({ event, payload, roomId });
        },
      };
    },
  };
}

function createRecipientSocket() {
  const emitted = [];
  return {
    data: { userId: INVITED_ID },
    emitted,
    id: 'socket-invited',
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function createService(io) {
  const service = new ChatRoomRealtimeService(io, {
    authenticateSocketUser: async () => ({
      _id: LAUNCHER_ID,
      name: 'Launcher Player',
    }),
    presenceService: {
      getPresenceSnapshot: () => ({
        players: [{ id: INVITED_ID, userId: INVITED_ID }],
      }),
    },
  });

  service.findRoom = async () => ({
    _id: ROOM_ID,
    createdByUserId: LAUNCHER_ID,
    isPublic: false,
    name: 'Nightly Social',
    participantStates: [{ userId: LAUNCHER_ID }, { userId: INVITED_ID }],
  });
  return service;
}

test('User can create table from Chat Room', async (t) => {
  const originalUpdateOne = ChatRoom.updateOne;
  const originalFindById = ChatRoom.findById;
  const originalInsertMany = Notification.insertMany;
  const originalSave = ChatRoomMessage.prototype.save;
  const chatRoomUpdates = [];
  const notifications = [];
  const savedMessages = [];

  ChatRoom.updateOne = async function updateOneStub(query, update) {
    chatRoomUpdates.push({ query, update });
    return { acknowledged: true };
  };
  ChatRoom.findById = function findByIdStub() {
    return {
      select: async () => ({ participantStates: [{ userId: INVITED_ID }] }),
    };
  };
  Notification.insertMany = async function insertManyStub(docs) {
    notifications.push(...docs);
    return docs.map((doc, index) => ({
      _id: `launch-notification-${index}`,
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
      readAt: null,
      ...doc,
    }));
  };
  ChatRoomMessage.prototype.save = async function saveStub() {
    this._id = '507f1f77bcf86cd799439015';
    this.createdAt = new Date('2026-01-01T00:00:00.000Z');
    savedMessages.push(this);
    return this;
  };
  t.after(() => {
    ChatRoom.updateOne = originalUpdateOne;
    ChatRoom.findById = originalFindById;
    Notification.insertMany = originalInsertMany;
    ChatRoomMessage.prototype.save = originalSave;
  });

  const io = createIoMock();
  const recipientSocket = createRecipientSocket();
  io.sockets.sockets.set(recipientSocket.id, recipientSocket);
  const service = createService(io);
  const socket = createSocketMock();
  const pokerRealtimeService = {
    createRoomFromChatRoom: async (creatingSocket, payload, launchContext) => {
      assert.equal(creatingSocket, socket);
      assert.equal(payload.tableName, 'Nightly Table');
      assert.deepEqual(payload.gameSettings, { game: '357', mode: 'high-only' });
      assert.equal(String(launchContext.chatRoomId), ROOM_ID);
      assert.deepEqual(launchContext.invitedPlayerIds, [INVITED_ID]);
      return {
        id: 'TABLE42',
        tableDbId: TABLE_DB_ID,
        tableName: payload.tableName,
      };
    },
  };

  const response = await service.createTableFromChatRoom(
    socket,
    {
      invitedPlayerIds: [INVITED_ID],
      gameSettings: { game: '357', mode: 'high-only' },
      roomId: ROOM_ID,
      tableName: 'Nightly Table',
      visibility: 'room',
    },
    pokerRealtimeService,
  );

  assert.equal(response.ok, true);
  assert.equal(response.tableCode, 'TABLE42');
  assert.equal(response.tableDbId, TABLE_DB_ID);
  assert.deepEqual(response.deliveredPlayerIds, [INVITED_ID]);
  assert.equal(savedMessages.length, 1);
  assert.equal(savedMessages[0].tone, 'system');
  assert.equal(chatRoomUpdates.some((entry) => entry.update.$push?.tableLaunches), true);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'table_launched_from_chat');

  assert.equal(
    recipientSocket.emitted.some((entry) => entry.event === 'table:launchFromChatRoom' && entry.payload.recipient),
    true,
  );
  assert.equal(
    socket.emitted.some((entry) => entry.event === 'table:launchFromChatRoom' && entry.payload.sender),
    true,
  );
  assert.equal(
    io.roomEmissions.some((entry) => entry.event === 'chat:newMessage' && entry.payload.message.tone === 'system'),
    true,
  );
});
