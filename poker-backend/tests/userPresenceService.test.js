const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const userModelPath = require.resolve("../src/models/User");
const socketRegistryPath = require.resolve("../src/sockets/socketRegistry");
const presenceServicePath = require.resolve("../src/services/userPresenceService");

function installMockModule(resolvedPath, exports) {
  require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, path: path.dirname(resolvedPath), exports };
}

test("user presence tracks first connection, simultaneous sockets, final disconnect, and friend events", async (t) => {
  const userId = "507f1f77bcf86cd799439041";
  const friendIds = ["507f1f77bcf86cd799439042", "507f1f77bcf86cd799439043"];
  const updates = [];
  const emitted = [];
  let persistedOnline = false;

  installMockModule(userModelPath, {
    findOneAndUpdate(filter, update) {
      updates.push({ filter, update });
      const changed = persistedOnline !== update.$set.isOnline;
      persistedOnline = update.$set.isOnline;
      return {
        async select(selection) {
          assert.equal(selection, "friends");
          return changed ? { _id: userId, friends: friendIds } : null;
        },
      };
    },
  });
  installMockModule(socketRegistryPath, {
    getIO: () => ({
      to(room) {
        return { emit: (event, payload) => emitted.push({ event, payload, room }) };
      },
    }),
  });
  delete require.cache[presenceServicePath];
  t.after(() => {
    delete require.cache[presenceServicePath];
    delete require.cache[userModelPath];
    delete require.cache[socketRegistryPath];
  });

  const presence = require("../src/services/userPresenceService");

  assert.equal(await presence.registerAuthenticatedSocket(userId, "socket-1"), true);
  assert.equal(presence.getAuthenticatedSocketCount(userId), 1);
  assert.equal(persistedOnline, true);
  assert.equal(updates.length, 1);

  assert.equal(await presence.registerAuthenticatedSocket(userId, "socket-2"), false);
  assert.equal(presence.getAuthenticatedSocketCount(userId), 2);
  assert.equal(updates.length, 1, "a second socket must not repeat the online transition");

  assert.equal(await presence.setOfflineIfNoAuthenticatedSockets(userId), false);
  assert.equal(persistedOnline, true, "logout must not mark a user offline while authenticated sockets remain");

  assert.equal(await presence.unregisterAuthenticatedSocket("socket-1"), false);
  assert.equal(presence.getAuthenticatedSocketCount(userId), 1);
  assert.equal(persistedOnline, true);
  assert.equal(updates.length, 1, "disconnecting one active device must not mark the user offline");

  assert.equal(await presence.unregisterAuthenticatedSocket("socket-2"), true);
  assert.equal(presence.getAuthenticatedSocketCount(userId), 0);
  assert.equal(persistedOnline, false);
  assert.equal(updates.length, 2);

  assert.deepEqual(emitted, [
    ...friendIds.map((friendId) => ({
      event: presence.USER_PRESENCE_EVENT,
      payload: { isOnline: true, userId },
      room: `user:${friendId}`,
    })),
    ...friendIds.map((friendId) => ({
      event: presence.USER_PRESENCE_EVENT,
      payload: { isOnline: false, userId },
      room: `user:${friendId}`,
    })),
  ]);
});
