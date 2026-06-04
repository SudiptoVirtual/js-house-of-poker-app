const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoom = require('../src/models/ChatRoom');
const {
  DEFAULT_CHAT_ROOMS,
  buildSeedOperation,
  seedChatRooms,
} = require('../src/scripts/seedChatRooms');

test('default chat room seed data defines public metadata and ordering', () => {
  assert.deepEqual(
    DEFAULT_CHAT_ROOMS.map((room) => room.name),
    ['The Rail', '3-5-7 Strategy', 'Low Stakes Lounge', 'High Rollers', 'New Players Room']
  );

  DEFAULT_CHAT_ROOMS.forEach((room, index) => {
    assert.equal(room.visibility, 'public');
    assert.equal(typeof room.topic, 'string');
    assert.ok(room.topic.length > 0);
    assert.equal(typeof room.description, 'string');
    assert.ok(room.description.length > 0);
    assert.equal(room.sortOrder, (index + 1) * 10);
  });
});

test('seed operations upsert by slug without creating duplicate chat rooms', () => {
  const operation = buildSeedOperation(DEFAULT_CHAT_ROOMS[0]);

  assert.deepEqual(operation.updateOne.filter, { slug: 'the-rail' });
  assert.equal(operation.updateOne.upsert, true);
  assert.equal(operation.updateOne.update.$set, undefined);
  assert.equal(operation.updateOne.update.$setOnInsert.name, 'The Rail');
  assert.equal(operation.updateOne.update.$setOnInsert.visibility, 'public');
  assert.equal(operation.updateOne.update.$setOnInsert.isPublic, true);
  assert.equal(operation.updateOne.update.$setOnInsert.sortOrder, 10);
  assert.equal(operation.updateOne.update.$setOnInsert.slug, 'the-rail');
  assert.deepEqual(operation.updateOne.update.$setOnInsert.participantStates, []);
});

test('seedChatRooms bulk upserts defaults and returns seeded rooms in sort order', async (t) => {
  const originalBulkWrite = ChatRoom.bulkWrite;
  const originalFind = ChatRoom.find;
  const calls = [];

  ChatRoom.bulkWrite = async function bulkWriteStub(operations, options) {
    calls.push({ operations, options });
    return { matchedCount: 5, modifiedCount: 5, upsertedCount: 0 };
  };
  ChatRoom.find = function findStub(filter) {
    calls.push({ filter });
    return {
      sort(sort) {
        calls.push({ sort });
        return {
          lean: async () => DEFAULT_CHAT_ROOMS.map((room) => ({ ...room, isPublic: true })),
        };
      },
    };
  };

  t.after(() => {
    ChatRoom.bulkWrite = originalBulkWrite;
    ChatRoom.find = originalFind;
  });

  const result = await seedChatRooms({ logger: { log() {} } });

  assert.equal(result.rooms.length, 5);
  assert.equal(result.upsertedCount, 0);
  assert.equal(calls[0].operations.length, 5);
  assert.deepEqual(calls[0].options, { ordered: true });
  assert.deepEqual(calls[1].filter.slug.$in, DEFAULT_CHAT_ROOMS.map((room) => room.slug));
  assert.deepEqual(calls[2].sort, { sortOrder: 1, name: 1 });
});

test('Chat Room list API excludes seeded defaults from normal discovery and returns a clear empty response', async (t) => {
  const { getChatRooms } = require('../src/controllers/chatRoomController');
  const GameTable = require('../src/models/GameTable');
  const originalFindRoomList = ChatRoom.findRoomList;
  const originalGameTableFind = GameTable.find;
  const statusCalls = [];
  let responseBody = null;

  ChatRoom.findRoomList = async function findRoomListStub(options) {
    assert.equal(options.limit, 50);
    assert.equal(options.requireCreator, true);
    assert.deepEqual(options.excludeSlugs, DEFAULT_CHAT_ROOMS.map((room) => room.slug));
    return [];
  };
  GameTable.find = function findStub(filter) {
    assert.deepEqual(filter, {
      status: { $ne: 'closed' },
      tableCode: { $exists: true, $ne: null },
    });
    return {
      sort(sort) {
        assert.deepEqual(sort, { updatedAt: -1, createdAt: -1 });
        return {
          limit(limit) {
            assert.equal(limit, 50);
            return {
              lean: async () => [],
            };
          },
        };
      },
    };
  };

  t.after(() => {
    ChatRoom.findRoomList = originalFindRoomList;
    GameTable.find = originalGameTableFind;
  });

  await getChatRooms(
    { query: {} },
    {
      status(code) {
        statusCalls.push(code);
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    }
  );

  assert.deepEqual(statusCalls, [200]);
  assert.deepEqual(responseBody, {
    count: 0,
    message: 'No live chat rooms are available.',
    rooms: [],
  });
});

test('Chat Room list API allows default rooms with a dev-only query flag outside restricted environments', async (t) => {
  const { getChatRooms } = require('../src/controllers/chatRoomController');
  const originalFindRoomList = ChatRoom.findRoomList;
  const originalNodeEnv = process.env.NODE_ENV;
  const defaultRoom = {
    id: '507f1f77bcf86cd799439012',
    name: 'The Rail',
    slug: 'the-rail',
    isPublic: true,
    visibility: 'public',
  };
  const statusCalls = [];
  let responseBody = null;

  process.env.NODE_ENV = 'development';
  ChatRoom.findRoomList = async function findRoomListStub(options) {
    assert.deepEqual(options, {
      excludeSlugs: [],
      limit: 50,
      requireCreator: false,
    });
    return [defaultRoom];
  };

  t.after(() => {
    ChatRoom.findRoomList = originalFindRoomList;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  await getChatRooms(
    { query: { includeDefaultRooms: 'true' } },
    {
      status(code) {
        statusCalls.push(code);
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    }
  );

  assert.deepEqual(statusCalls, [200]);
  assert.deepEqual(responseBody, { count: 1, rooms: [defaultRoom] });
});

test('Default chat room seed endpoint is disabled in preview environments', async (t) => {
  const { seedDefaultChatRooms } = require('../src/controllers/chatRoomController');
  const originalVercelEnv = process.env.VERCEL_ENV;
  const statusCalls = [];
  let responseBody = null;

  process.env.VERCEL_ENV = 'preview';

  t.after(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  await seedDefaultChatRooms(
    {},
    {
      status(code) {
        statusCalls.push(code);
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    }
  );

  assert.deepEqual(statusCalls, [403]);
  assert.deepEqual(responseBody, {
    message: 'Default chat room seeding is disabled in production and preview environments.',
  });
});
