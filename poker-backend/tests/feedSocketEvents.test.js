const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const feedSocketPath = require.resolve('../src/sockets/feedSocket');
const feedServicePath = require.resolve('../src/services/feedRealtimeService');
const playerGameSocketPath = require.resolve('../src/sockets/playerGameSocket');

function clearFeedSocketModules() {
  delete require.cache[feedSocketPath];
  delete require.cache[feedServicePath];
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
    id: 'feed-socket-1',
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

test('Feed socket events are registered and delegate to realtime service handlers', async (t) => {
  clearFeedSocketModules();

  const calls = [];
  const pokerRealtimeService = {
    authenticateSocketUser: async () => ({ _id: '507f1f77bcf86cd799439011' }),
  };
  const feedRealtimeService = {
    createComment: async (socket, payload) => {
      calls.push({ method: 'createComment', payload });
      return { ok: true, event: 'comment' };
    },
    createPost: async (socket, payload) => {
      calls.push({ method: 'createPost', payload });
      return { ok: true, event: 'post' };
    },
    createPromotion: async (socket, payload) => {
      calls.push({ method: 'createPromotion', payload });
      return { ok: true, event: 'promotion' };
    },
    createShare: async (socket, payload) => {
      calls.push({ method: 'createShare', payload });
      return { ok: true, event: 'share' };
    },
    join: async (socket, payload) => {
      calls.push({ method: 'join', payload });
      return { ok: true, event: 'join' };
    },
    leave: async (socket, payload) => {
      calls.push({ method: 'leave', payload });
      return { ok: true, event: 'leave' };
    },
    leaveAll: (socket) => {
      calls.push({ method: 'leaveAll', socketId: socket.id });
    },
    sendGiftClips: async (socket, payload) => {
      calls.push({ method: 'sendGiftClips', payload });
      return { ok: true, event: 'giftClips' };
    },
    sendTableInvite: async (socket, payload) => {
      calls.push({ method: 'sendTableInvite', payload });
      return { ok: true, event: 'tableInvite' };
    },
    toggleSupport: async (socket, payload) => {
      calls.push({ method: 'toggleSupport', payload });
      return { ok: true, event: 'support' };
    },
  };

  installMockModule(playerGameSocketPath, {
    getPlayerRealtimeService: () => pokerRealtimeService,
  });
  installMockModule(feedServicePath, {
    createFeedRealtimeService: (io, options) => {
      assert.equal(typeof options.authenticateSocketUser, 'function');
      return feedRealtimeService;
    },
    emitAck: (ack, payload) => {
      if (typeof ack === 'function') ack(payload);
    },
  });
  t.after(clearFeedSocketModules);

  const { initFeedSocket } = require('../src/sockets/feedSocket');
  const socket = createSocketMock();
  initFeedSocket(createIoMock(socket));

  assert.deepEqual([...socket.handlers.keys()].sort(), [
    'disconnect',
    'feed:comment:create',
    'feed:giftClips:send',
    'feed:join',
    'feed:leave',
    'feed:post:create',
    'feed:promote:create',
    'feed:share:create',
    'feed:support:toggle',
    'feed:tableInvite:send',
  ].sort());

  const ackPayloads = [];
  const ack = (payload) => ackPayloads.push(payload);
  socket.handlers.get('feed:join')({ postId: 'post-1' }, ack);
  socket.handlers.get('feed:leave')({ postId: 'post-1' }, ack);
  socket.handlers.get('feed:post:create')({ content: 'post' }, ack);
  socket.handlers.get('feed:comment:create')({ postId: 'post-1', body: 'comment' }, ack);
  socket.handlers.get('feed:support:toggle')({ postId: 'post-1' }, ack);
  socket.handlers.get('feed:share:create')({ postId: 'post-1' }, ack);
  socket.handlers.get('feed:giftClips:send')({ postId: 'post-1', amount: 1 }, ack);
  socket.handlers.get('feed:promote:create')({ postId: 'post-1', budgetClips: 1 }, ack);
  socket.handlers.get('feed:tableInvite:send')({ postId: 'post-1', tableId: 'TABLE1' }, ack);

  await new Promise((resolve) => setImmediate(resolve));
  socket.handlers.get('disconnect')();

  assert.deepEqual(calls.map((call) => call.method), [
    'join',
    'leave',
    'createPost',
    'createComment',
    'toggleSupport',
    'createShare',
    'sendGiftClips',
    'createPromotion',
    'sendTableInvite',
    'leaveAll',
  ]);
  assert.deepEqual(ackPayloads.map((payload) => payload.event), [
    'join',
    'leave',
    'post',
    'comment',
    'support',
    'share',
    'giftClips',
    'promotion',
    'tableInvite',
  ]);
});

test('Feed socket event errors emit mapped feed errors and negative ack', async (t) => {
  clearFeedSocketModules();

  installMockModule(playerGameSocketPath, {
    getPlayerRealtimeService: () => ({ authenticateSocketUser: async () => ({}) }),
  });
  installMockModule(feedServicePath, {
    createFeedRealtimeService: () => ({
      createComment: async () => ({ ok: true }),
      createPost: async () => ({ ok: true }),
      createPromotion: async () => ({ ok: true }),
      createShare: async () => ({ ok: true }),
      join: async () => {
        throw new Error('Feed post not found.');
      },
      leave: async () => ({ ok: true }),
      leaveAll: () => undefined,
      sendGiftClips: async () => ({ ok: true }),
      sendTableInvite: async () => ({ ok: true }),
      toggleSupport: async () => ({ ok: true }),
    }),
    emitAck: (ack, payload) => {
      if (typeof ack === 'function') ack(payload);
    },
  });
  t.after(clearFeedSocketModules);

  const { initFeedSocket } = require('../src/sockets/feedSocket');
  const socket = createSocketMock();
  initFeedSocket(createIoMock(socket));

  let ackPayload;
  socket.handlers.get('feed:join')({ postId: 'missing' }, (payload) => {
    ackPayload = payload;
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(ackPayload.ok, false);
  assert.equal(ackPayload.error.code, 'REALTIME_ERROR');
  assert.equal(socket.emitted.some((entry) => entry.event === 'feed:error'), true);
});
