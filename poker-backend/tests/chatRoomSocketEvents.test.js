const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const chatRoomSocketPath = require.resolve('../src/sockets/chatRoomSocket');
const chatRoomServicePath = require.resolve('../src/services/chatRoomRealtimeService');
const playerGameSocketPath = require.resolve('../src/sockets/playerGameSocket');

function clearChatRoomSocketModules() {
  delete require.cache[chatRoomSocketPath];
  delete require.cache[chatRoomServicePath];
  delete require.cache[playerGameSocketPath];
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

function createSocketMock() {
  const handlers = new Map();
  const emitted = [];
  return {
    data: {},
    emitted,
    handlers,
    id: 'socket-1',
    on(event, handler) {
      handlers.set(event, handler);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
}

function createIoMock(socket) {
  return {
    connectionHandler: null,
    on(event, handler) {
      assert.equal(event, 'connection');
      this.connectionHandler = handler;
      handler(socket);
    },
  };
}

test('Chat Room socket events are registered and delegate to realtime services', async (t) => {
  clearChatRoomSocketModules();

  const calls = [];
  const pokerRealtimeService = {
    authenticateSocketUser: async () => ({ _id: '507f1f77bcf86cd799439011' }),
  };
  const chatRoomRealtimeService = {
    createTableFromChatRoom: async (socket, payload, realtimeService) => {
      calls.push({ method: 'createTableFromChatRoom', payload, realtimeService });
      return { ok: true, event: 'create' };
    },
    inviteRoomPlayers: async (socket, payload, realtimeService) => {
      calls.push({ method: 'inviteRoomPlayers', payload, realtimeService });
      return { ok: true, event: 'invite' };
    },
    joinRoom: async (socket, payload) => {
      calls.push({ method: 'joinRoom', payload });
      return { ok: true, event: 'join' };
    },
    leaveAllRooms: (socket) => {
      calls.push({ method: 'leaveAllRooms', socketId: socket.id });
    },
    leaveRoom: async (socket, payload) => {
      calls.push({ method: 'leaveRoom', payload });
      return { ok: true, event: 'leave' };
    },
    sendMessage: async (socket, payload) => {
      calls.push({ method: 'sendMessage', payload });
      return { ok: true, event: 'message' };
    },
    sendGiftClip: async (socket, payload) => {
      calls.push({ method: 'sendGiftClip', payload });
      return { ok: true, event: 'gift-new' };
    },
    sendGiftClips: async (socket, payload) => {
      calls.push({ method: 'sendGiftClips', payload });
      return { ok: true, event: 'gift-legacy' };
    },
    sendTyping: async (socket, payload) => {
      calls.push({ method: 'sendTyping', payload });
      return { ok: true, event: 'typing' };
    },
  };

  installMockModule(playerGameSocketPath, {
    getPlayerRealtimeService: () => pokerRealtimeService,
  });
  installMockModule(chatRoomServicePath, {
    createChatRoomRealtimeService: () => chatRoomRealtimeService,
  });
  t.after(clearChatRoomSocketModules);

  const { initChatRoomSocket } = require('../src/sockets/chatRoomSocket');
  const socket = createSocketMock();
  const io = createIoMock(socket);
  initChatRoomSocket(io);

  assert.deepEqual([...socket.handlers.keys()].sort(), [
    'chat:joinRoom',
    'chat:leaveRoom',
    'chat:sendMessage',
    'chat:sendGiftClip',
    'chat:giftClips:send',
    'chat:typing',
    'disconnect',
    'table:createFromChatRoom',
    'table:inviteRoomPlayers',
  ].sort());

  const ackPayloads = [];
  const ack = (payload) => ackPayloads.push(payload);
  socket.handlers.get('chat:joinRoom')({ roomId: 'room-a' }, ack);
  socket.handlers.get('chat:leaveRoom')({ roomId: 'room-a' }, ack);
  socket.handlers.get('chat:sendMessage')({ roomId: 'room-a', text: 'hello' }, ack);
  socket.handlers.get('chat:sendGiftClip')({ amount: 25, recipientUserId: 'player-2', roomId: 'room-a' }, ack);
  socket.handlers.get('chat:giftClips:send')({ amount: 30, recipientUserId: 'player-3', roomId: 'room-a' }, ack);
  socket.handlers.get('chat:typing')({ roomId: 'room-a' }, ack);
  socket.handlers.get('table:createFromChatRoom')({ roomId: 'room-a' }, ack);
  socket.handlers.get('table:inviteRoomPlayers')({ roomId: 'room-a', playerIds: [] }, ack);

  await new Promise((resolve) => setImmediate(resolve));
  socket.handlers.get('disconnect')();

  assert.deepEqual(calls.map((call) => call.method), [
    'joinRoom',
    'leaveRoom',
    'sendMessage',
    'sendGiftClip',
    'sendGiftClips',
    'sendTyping',
    'createTableFromChatRoom',
    'inviteRoomPlayers',
    'leaveAllRooms',
  ]);
  assert.equal(calls[6].realtimeService, pokerRealtimeService);
  assert.equal(calls[7].realtimeService, pokerRealtimeService);
  assert.deepEqual(ackPayloads.map((payload) => payload.event), [
    'join',
    'leave',
    'message',
    'gift-new',
    'gift-legacy',
    'typing',
    'create',
    'invite',
  ]);
});

test('Chat Room socket event errors emit mapped room and chat errors and negative ack', async (t) => {
  clearChatRoomSocketModules();

  const chatRoomRealtimeService = {
    createTableFromChatRoom: async () => ({ ok: true }),
    inviteRoomPlayers: async () => ({ ok: true }),
    joinRoom: async () => {
      throw new Error('Chat room not found.');
    },
    leaveAllRooms: () => undefined,
    leaveRoom: async () => ({ ok: true }),
    sendMessage: async () => ({ ok: true }),
    sendGiftClip: async () => ({ ok: true }),
    sendGiftClips: async () => ({ ok: true }),
    sendTyping: async () => ({ ok: true }),
  };

  installMockModule(playerGameSocketPath, {
    getPlayerRealtimeService: () => ({ authenticateSocketUser: async () => ({}) }),
  });
  installMockModule(chatRoomServicePath, {
    createChatRoomRealtimeService: () => chatRoomRealtimeService,
  });
  t.after(clearChatRoomSocketModules);

  const { initChatRoomSocket } = require('../src/sockets/chatRoomSocket');
  const socket = createSocketMock();
  initChatRoomSocket(createIoMock(socket));

  let ackPayload;
  socket.handlers.get('chat:joinRoom')({ roomId: 'missing' }, (payload) => {
    ackPayload = payload;
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(ackPayload.ok, false);
  assert.equal(socket.emitted.some((entry) => entry.event === 'table:error'), true);
  assert.equal(socket.emitted.some((entry) => entry.event === 'room:error'), true);
  assert.equal(socket.emitted.some((entry) => entry.event === 'chat:error'), true);
});
