const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const friendSocketPath = require.resolve('../src/sockets/friendSocket');
const playerGameSocketPath = require.resolve('../src/sockets/playerGameSocket');
const userPresenceServicePath = require.resolve('../src/services/userPresenceService');

function installMockModule(resolvedPath, exports) {
  require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, path: path.dirname(resolvedPath), exports };
}

test('initFriendSocket authenticates with the feed token strategy and joins the authenticated user room', async (t) => {
  const authenticatedUser = { _id: '507f1f77bcf86cd799439042' };
  const calls = [];
  installMockModule(userPresenceServicePath, {
    registerAuthenticatedSocket: async (userId, socketId) => calls.push({ registered: [String(userId), socketId] }),
    unregisterAuthenticatedSocket: async (socketId) => calls.push({ unregistered: socketId }),
  });
  installMockModule(playerGameSocketPath, {
    getPlayerRealtimeService: () => ({
      authenticateSocketUser: async (socket) => {
        calls.push({ auth: socket.handshake.auth });
        return authenticatedUser;
      },
    }),
  });
  delete require.cache[friendSocketPath];
  t.after(() => {
    delete require.cache[friendSocketPath];
    delete require.cache[playerGameSocketPath];
    delete require.cache[userPresenceServicePath];
  });

  let disconnectHandler;
  const socket = {
    id: 'socket-1',
    data: {},
    handshake: { auth: { token: 'receiver-token' }, headers: {} },
    emit() {},
    join(room) { calls.push({ room }); },
    on(event, handler) { assert.equal(event, 'disconnect'); disconnectHandler = handler; },
  };
  const io = { on(event, handler) { assert.equal(event, 'connection'); handler(socket); } };
  const { initFriendSocket } = require('../src/sockets/friendSocket');

  initFriendSocket(io);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(socket.data.userId, authenticatedUser._id);
  assert.equal(socket.data.userRoom, `user:${authenticatedUser._id}`);
  assert.deepEqual(calls, [
    { auth: { token: 'receiver-token' } },
    { room: `user:${authenticatedUser._id}` },
    { registered: [authenticatedUser._id, 'socket-1'] },
  ]);

  disconnectHandler();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.at(-1), { unregistered: 'socket-1' });
});
