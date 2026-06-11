const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const ChatRoom = require("../src/models/ChatRoom");
const GameTable = require("../src/models/GameTable");
const { getChatRoomById, getChatRooms } = require("../src/controllers/chatRoomController");
const {
  OBSOLETE_DEFAULT_CHAT_ROOM_SLUGS,
  cleanupObsoleteChatData,
} = require("../src/scripts/cleanupObsoleteChatData");

function createResponseRecorder() {
  return {
    body: null,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("empty social-room discovery stays empty while BotTableManager training tables exist", async (t) => {
  const originalFindRoomList = ChatRoom.findRoomList;
  const originalGameTableFind = GameTable.find;
  const trainingTablesCreatedByBotTableManager = [
    { notes: "training-bot-table", status: "waiting", tableCode: "TRAIN01" },
  ];
  let gameTableFindCalls = 0;

  ChatRoom.findRoomList = async function findRoomListStub(options) {
    assert.deepEqual(options, { limit: 50, requireCreator: true });
    return [];
  };
  GameTable.find = function findStub() {
    gameTableFindCalls += 1;
    return trainingTablesCreatedByBotTableManager;
  };

  t.after(() => {
    ChatRoom.findRoomList = originalFindRoomList;
    GameTable.find = originalGameTableFind;
  });

  const response = createResponseRecorder();
  await getChatRooms({ query: {} }, response);

  assert.equal(gameTableFindCalls, 0, "chat-room discovery must never fall back to GameTable records");
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    count: 0,
    message: "No live chat rooms are available.",
    rooms: [],
  });
});

test("social-room discovery passes the requesting user to the accessible ChatRoom query", async (t) => {
  const originalFindRoomList = ChatRoom.findRoomList;
  const userId = "507f1f77bcf86cd799439011";
  const accessibleRoom = { id: "507f1f77bcf86cd799439012", name: "Friends" };

  ChatRoom.findRoomList = async function findRoomListStub(options) {
    assert.deepEqual(options, { limit: 25, requireCreator: true, userId });
    return [accessibleRoom];
  };
  t.after(() => {
    ChatRoom.findRoomList = originalFindRoomList;
  });

  const response = createResponseRecorder();
  await getChatRooms({ query: { limit: "25" }, user: { _id: userId } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { count: 1, rooms: [accessibleRoom] });
});

test("game-table detail lookup rejects BotTableManager and internal/demo table notes", async (t) => {
  const originalChatRoomFindOne = ChatRoom.findOne;
  const originalGameTableFindOne = GameTable.findOne;
  const rejectedMarkers = [
    "training-bot-table",
    "bot-training-table",
    "demo-table",
    "internal-game-table",
    "internal-demo-table",
  ];

  ChatRoom.findOne = async function findOneStub() {
    return null;
  };
  GameTable.findOne = function findOneStub(filter) {
    const notesExclusion = filter.$and[0].notes.$not;
    rejectedMarkers.forEach((marker) => {
      assert.equal(notesExclusion.test(marker), true, `${marker} must be rejected`);
    });
    assert.equal(notesExclusion.test("friends table"), false);
    return { lean: async () => null };
  };

  t.after(() => {
    ChatRoom.findOne = originalChatRoomFindOne;
    GameTable.findOne = originalGameTableFindOne;
  });

  const response = createResponseRecorder();
  await getChatRoomById({ params: { roomId: "TRAIN01" }, query: {} }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { message: "Chat room not found" });
});


test("game-table detail exposes public-visitor membership capabilities", async (t) => {
  const originalChatRoomFindOne = ChatRoom.findOne;
  const originalGameTableFindOne = GameTable.findOne;

  ChatRoom.findOne = async function findOneStub() {
    return null;
  };
  GameTable.findOne = function findOneStub() {
    return {
      lean: async () => ({
        chatMessages: [],
        hostUserId: "507f1f77bcf86cd799439031",
        players: [],
        status: "waiting",
        tableCode: "PUBLIC1",
      }),
    };
  };

  t.after(() => {
    ChatRoom.findOne = originalChatRoomFindOne;
    GameTable.findOne = originalGameTableFindOne;
  });

  const response = createResponseRecorder();
  await getChatRoomById({
    params: { roomId: "PUBLIC1" },
    query: {},
    user: { _id: "507f1f77bcf86cd799439032" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    { canLeave: response.body.room.canLeave, isCreator: response.body.room.isCreator, isMember: response.body.room.isMember },
    { canLeave: false, isCreator: false, isMember: false },
  );
});

test("social-room serialization exposes membership capabilities and prevents leaving public rooms", () => {
  const creatorId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439021");
  const memberId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439022");
  const visitorId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439023");
  const privateRoom = new ChatRoom({
    createdByUserId: creatorId,
    isPublic: false,
    name: "Private friends",
    participantStates: [{ userId: memberId }],
    slug: "private-friends",
    visibility: "private",
  });
  const publicRoom = new ChatRoom({
    createdByUserId: creatorId,
    isPublic: true,
    name: "Public lounge",
    participantStates: [],
    slug: "public-lounge",
    visibility: "public",
  });

  assert.deepEqual(privateRoom.getMembershipCapabilities(memberId), {
    canLeave: true, isCreator: false, isMember: true,
  });
  assert.deepEqual(privateRoom.getMembershipCapabilities(creatorId), {
    canLeave: false, isCreator: true, isMember: true,
  });
  assert.deepEqual(publicRoom.getMembershipCapabilities(visitorId), {
    canLeave: false, isCreator: false, isMember: false,
  });

  assert.equal(privateRoom.toRoomListItem(memberId).canLeave, true);
  assert.equal(privateRoom.toRoomListItem(creatorId).canLeave, false);
  assert.equal(publicRoom.toRoomListItem(visitorId).canLeave, false);
});

test("one-time cleanup removes retired default rooms and internal/demo game tables", async (t) => {
  const originalChatRoomDeleteMany = ChatRoom.deleteMany;
  const originalGameTableDeleteMany = GameTable.deleteMany;

  ChatRoom.deleteMany = async function deleteManyStub(filter) {
    assert.deepEqual(filter, { slug: { $in: OBSOLETE_DEFAULT_CHAT_ROOM_SLUGS } });
    return { deletedCount: 5 };
  };
  GameTable.deleteMany = async function deleteManyStub(filter) {
    assert.equal(filter.notes.test("training-bot-table"), true);
    assert.equal(filter.notes.test("demo-table"), true);
    assert.equal(filter.notes.test("real-player-table"), false);
    return { deletedCount: 3 };
  };

  t.after(() => {
    ChatRoom.deleteMany = originalChatRoomDeleteMany;
    GameTable.deleteMany = originalGameTableDeleteMany;
  });

  const result = await cleanupObsoleteChatData({ logger: { log() {} } });
  assert.deepEqual(result, { deletedChatRooms: 5, deletedGameTables: 3 });
});
