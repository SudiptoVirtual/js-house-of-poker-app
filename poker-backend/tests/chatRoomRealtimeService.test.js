const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoom = require('../src/models/ChatRoom');
const ChatRoomMessage = require('../src/models/ChatRoomMessage');
const Notification = require('../src/models/Notification');
const {
  ChatRoomRealtimeService,
  getChatRoomChannel,
  serializeChatRoomMessage,
} = require('../src/services/chatRoomRealtimeService');

const SENDER_ID = '507f1f77bcf86cd799439011';
const ROOM_ID = '507f1f77bcf86cd799439012';
const RECIPIENT_ID = '507f1f77bcf86cd799439013';

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

function createSocketMock({ id = 'socket-sender', userId = SENDER_ID } = {}) {
  const emitted = [];
  const joinedRooms = [];
  const leftRooms = [];
  const peerEmissions = [];
  const socket = {
    data: userId ? { userId } : {},
    emitted,
    id,
    joinedRooms,
    leftRooms,
    peerEmissions,
    rooms: new Set(),
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    join(roomId) {
      joinedRooms.push(roomId);
      socket.rooms.add(roomId);
    },
    leave(roomId) {
      leftRooms.push(roomId);
      socket.rooms.delete(roomId);
    },
    to(roomId) {
      return {
        emit(event, payload) {
          peerEmissions.push({ event, payload, roomId });
        },
      };
    },
  };

  return socket;
}

function createRecipientSocket(userId = RECIPIENT_ID) {
  const emitted = [];
  return {
    data: { userId },
    emitted,
    id: `socket-${userId}`,
    rooms: new Set(),
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function createPresenceService(players = []) {
  return {
    added: [],
    removed: [],
    addPresence(roomId, user, socket) {
      this.added.push({ roomId, user, socketId: socket.id });
    },
    removePresence(roomId, socket) {
      this.removed.push({ roomId, socketId: socket.id });
    },
    getPresenceSnapshot(roomId) {
      return {
        count: players.length,
        players,
        roomId,
      };
    },
  };
}

function createRoom(overrides = {}) {
  return {
    _id: ROOM_ID,
    createdByUserId: SENDER_ID,
    isPublic: true,
    name: 'Social Lounge',
    participantStates: [
      { userId: SENDER_ID },
      { userId: RECIPIENT_ID },
    ],
    slug: 'social-lounge',
    ...overrides,
  };
}

function createService({ io = createIoMock(), presenceService = createPresenceService(), room = createRoom() } = {}) {
  const service = new ChatRoomRealtimeService(io, {
    authenticateSocketUser: async () => ({
      _id: SENDER_ID,
      email: 'sender@example.test',
      name: 'Sender Player',
    }),
    presenceService,
  });

  service.findRoom = async () => room;
  service.getRecentMessages = async () => [];
  service.syncActivePlayerCount = async () => undefined;
  return service;
}

test('User can join Chat Room', async (t) => {
  const originalUpdateOne = ChatRoom.updateOne;
  const originalUpdateMany = Notification.updateMany;
  ChatRoom.updateOne = async () => ({ acknowledged: true });
  Notification.updateMany = async () => ({ matchedCount: 0, modifiedCount: 0 });
  t.after(() => {
    ChatRoom.updateOne = originalUpdateOne;
    Notification.updateMany = originalUpdateMany;
  });

  const presenceService = createPresenceService([
    { id: SENDER_ID, userId: SENDER_ID, displayName: 'Sender Player' },
  ]);
  const service = createService({ presenceService });
  const socket = createSocketMock();

  const response = await service.joinRoom(socket, { roomId: ROOM_ID });

  assert.equal(response.ok, true);
  assert.equal(response.roomId, ROOM_ID);
  assert.deepEqual(socket.joinedRooms, [getChatRoomChannel(ROOM_ID)]);
  assert.deepEqual(socket.data.chatRoomIds, [ROOM_ID]);
  assert.equal(presenceService.added.length, 1);
  assert.equal(socket.emitted.some((entry) => entry.event === 'chat:joinedRoom'), true);
});

test('User can leave Chat Room', async () => {
  const presenceService = createPresenceService([]);
  const service = createService({ presenceService });
  const socket = createSocketMock();
  socket.data.chatRoomIds = [ROOM_ID];
  socket.rooms.add(getChatRoomChannel(ROOM_ID));

  const response = await service.leaveRoom(socket, { roomId: ROOM_ID });

  assert.equal(response.ok, true);
  assert.equal(response.roomId, ROOM_ID);
  assert.deepEqual(socket.leftRooms, [getChatRoomChannel(ROOM_ID)]);
  assert.deepEqual(socket.data.chatRoomIds, []);
  assert.equal(presenceService.removed.length, 1);
  assert.equal(socket.emitted.some((entry) => entry.event === 'chat:leftRoom'), true);
});

test('User can send valid message, which emits chat:newMessage and chat:messageNotification', async (t) => {
  const originalSave = ChatRoomMessage.prototype.save;
  const originalInsertMany = Notification.insertMany;
  ChatRoomMessage.prototype.save = async function saveStub() {
    this._id = '507f1f77bcf86cd799439014';
    this.createdAt = new Date('2026-01-01T00:00:00.000Z');
    return this;
  };
  Notification.insertMany = async function insertManyStub(docs) {
    return docs.map((doc, index) => ({
      _id: `notification-${index}`,
      createdAt: new Date('2026-01-01T00:00:01.000Z'),
      readAt: null,
      ...doc,
    }));
  };
  t.after(() => {
    ChatRoomMessage.prototype.save = originalSave;
    Notification.insertMany = originalInsertMany;
  });

  const io = createIoMock();
  const recipientSocket = createRecipientSocket();
  io.sockets.sockets.set(recipientSocket.id, recipientSocket);
  const service = createService({ io });

  const response = await service.sendMessage(createSocketMock(), {
    roomId: ROOM_ID,
    text: '  Hello    room  ',
  });

  assert.equal(response.ok, true);
  assert.equal(response.message.text, 'Hello room');
  assert.equal(io.roomEmissions.length, 1);
  assert.equal(io.roomEmissions[0].event, 'chat:newMessage');
  assert.equal(io.roomEmissions[0].roomId, getChatRoomChannel(ROOM_ID));
  assert.equal(io.roomEmissions[0].payload.message.text, 'Hello room');

  const notification = recipientSocket.emitted.find(
    (entry) => entry.event === 'chat:messageNotification',
  );
  assert.ok(notification);
  assert.equal(notification.payload.type, 'chat_message');
  assert.equal(notification.payload.roomId, ROOM_ID);
  assert.equal(notification.payload.notification.userId, RECIPIENT_ID);
});

test('Empty message is rejected', async () => {
  const service = createService();

  await assert.rejects(
    service.sendMessage(createSocketMock(), { roomId: ROOM_ID, text: '   \n\t  ' }),
    /Chat message cannot be empty/,
  );
});

test('Rate-limited message is rejected', async () => {
  const service = createService();

  for (let index = 0; index < 5; index += 1) {
    service.enforceRateLimit(ROOM_ID, SENDER_ID);
  }

  await assert.rejects(
    service.sendMessage(createSocketMock(), { roomId: ROOM_ID, text: 'too soon' }),
    /sending chat room messages too quickly/,
  );
});

test('Typing event emits to other room members', async () => {
  const service = createService();
  const socket = createSocketMock();

  const response = await service.sendTyping(socket, { roomId: ROOM_ID, isTyping: true });

  assert.equal(response.ok, true);
  assert.deepEqual(socket.peerEmissions, [
    {
      event: 'chat:typing',
      payload: {
        isTyping: true,
        playerId: SENDER_ID,
        playerName: 'Sender Player',
        roomId: ROOM_ID,
        userId: SENDER_ID,
      },
      roomId: getChatRoomChannel(ROOM_ID),
    },
  ]);
});

test('ChatRoomMessage defaults legacy chat messages to text/player payloads', () => {
  const message = new ChatRoomMessage({
    roomId: ROOM_ID,
    senderDisplayName: 'Sender Player',
    senderUserId: SENDER_ID,
    text: 'Legacy hello',
  });

  assert.equal(message.kind, 'text');
  assert.equal(message.tone, 'player');
  assert.equal(message.validateSync(), undefined);

  const serialized = serializeChatRoomMessage(message);
  assert.equal(serialized.kind, 'text');
  assert.equal(serialized.messageType, 'text');
  assert.equal(serialized.text, 'Legacy hello');
  assert.equal(serialized.tone, 'player');
});

test('serializeChatRoomMessage includes Gift Clip payload details for card rendering', () => {
  const recipientTransactionId = '507f1f77bcf86cd799439016';
  const senderTransactionId = '507f1f77bcf86cd799439017';
  const legacyTransactionId = '507f1f77bcf86cd799439018';
  const message = new ChatRoomMessage({
    giftClip: {
      amount: 250,
      message: 'Enjoy this clip',
      recipientTransactionId,
      recipientUserId: RECIPIENT_ID,
      senderTransactionId,
      transactionId: legacyTransactionId,
    },
    kind: 'gift_clip',
    roomId: ROOM_ID,
    senderDisplayName: 'Sender Player',
    senderUserId: SENDER_ID,
  });
  message._id = '507f1f77bcf86cd799439019';
  message.createdAt = new Date('2026-01-01T00:00:00.000Z');

  assert.equal(message.validateSync(), undefined);

  const serialized = serializeChatRoomMessage(message);
  assert.equal(serialized.kind, 'gift_clip');
  assert.equal(serialized.messageType, 'gift_clip');
  assert.equal(serialized.text, 'Enjoy this clip');
  assert.equal(serialized.body, 'Enjoy this clip');
  assert.deepEqual(serialized.giftClip, {
    amount: 250,
    message: 'Enjoy this clip',
    recipientTransactionId,
    recipientUserId: RECIPIENT_ID,
    senderTransactionId,
    transactionId: legacyTransactionId,
    transactionIds: {
      recipient: recipientTransactionId,
      sender: senderTransactionId,
    },
  });
});
