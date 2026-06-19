const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FriendRequest = require("../src/models/FriendRequest");
const HandHistory = require("../src/models/HandHistory");
const User = require("../src/models/User");
const { getFriendDetails } = require("../src/controllers/friendController");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function createResponse() {
  return {
    body: null,
    statusCode: null,
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function mockFindById(usersById, selectFields = []) {
  return (id) => ({
    async select(fields) {
      selectFields.push(fields);
      return usersById.get(String(id)) || null;
    },
  });
}

test("getFriendDetails returns public details and gameplay stats for an authorized friend", async () => {
  const currentUserId = objectId("1");
  const friendId = objectId("2");
  const currentUser = { _id: currentUserId, friends: [friendId], isBlocked: false, status: "active" };
  const friend = {
    _id: friendId,
    avatar: "friend.png",
    chips: 2450,
    email: "friend@example.test",
    friends: [currentUserId],
    handle: "friend_handle",
    isBlocked: false,
    isOnline: true,
    name: "Friend Player",
    playerStatus: { iconKey: "badge-shark", tier: "SHARK" },
    status: "active",
    username: "friend_user",
    wins: 7,
    losses: 3,
    gamesPlayed: 10,
  };
  const originalFindById = User.findById;
  const originalExists = FriendRequest.exists;
  const originalHandFind = HandHistory.find;
  let existsFilter;

  User.findById = mockFindById(new Map([[String(currentUserId), currentUser], [String(friendId), friend]]));
  HandHistory.find = (filter) => {
    assert.deepEqual(filter, { "players.userId": friendId, status: "completed" });

    return {
      select(fields) {
        assert.equal(fields, "players.userId players.chipsWon players.chipsDelta totalPot tableId tableCode");

        return {
          async lean() {
            return [
              {
                tableId: objectId("10"),
                totalPot: 200,
                players: [{ userId: friendId, chipsWon: 200, chipsDelta: 120 }],
              },
              {
                tableId: objectId("10"),
                totalPot: 80,
                players: [{ userId: friendId, chipsWon: 0, chipsDelta: -30 }],
              },
            ];
          },
        };
      },
    };
  };
  FriendRequest.exists = async (filter) => {
    existsFilter = filter;
    return null;
  };

  try {
    const response = createResponse();

    await getFriendDetails({ params: { userId: String(friendId) }, user: { _id: currentUserId } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.id, String(friendId));
    assert.equal(response.body.user.userId, String(friendId));
    assert.equal(response.body.user.name, "Friend Player");
    assert.equal(response.body.user.username, "friend_user");
    assert.equal(response.body.user.handle, "friend_handle");
    assert.equal(response.body.user.avatar, "friend.png");
    assert.equal(response.body.user.isOnline, true);
    assert.equal(response.body.user.status, "active");
    assert.equal(response.body.user.playerStatus, "SHARK");
    assert.equal(response.body.user.chips, 2450);
    assert.deepEqual(response.body.user.gameplayStats, {
      chips: 2450,
      tablesPlayed: 0,
      gamesPlayed: 1,
      handsPlayed: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      totalWinnings: 90,
    });
    assert.equal(existsFilter.status, "blocked");
  } finally {
    User.findById = originalFindById;
    FriendRequest.exists = originalExists;
    HandHistory.find = originalHandFind;
  }
});

test("getFriendDetails rejects non-friend and blocked relationship access", async () => {
  const currentUserId = objectId("1");
  const strangerId = objectId("3");
  const currentUser = { _id: currentUserId, friends: [], isBlocked: false, status: "active" };
  const stranger = {
    _id: strangerId,
    chips: 1000,
    friends: [],
    isBlocked: false,
    name: "Stranger",
    status: "active",
  };
  const originalFindById = User.findById;
  const originalExists = FriendRequest.exists;
  const originalHandFind = HandHistory.find;

  User.findById = mockFindById(new Map([[String(currentUserId), currentUser], [String(strangerId), stranger]]));
  HandHistory.find = () => {
    throw new Error("HandHistory.find should not be called before privacy checks pass");
  };

  try {
    FriendRequest.exists = async () => null;
    const nonFriendResponse = createResponse();
    await getFriendDetails(
      { params: { userId: String(strangerId) }, user: { _id: currentUserId } },
      nonFriendResponse
    );
    assert.equal(nonFriendResponse.statusCode, 403);
    assert.equal(nonFriendResponse.body.message, "You can only view details for friends");

    FriendRequest.exists = async () => ({ _id: objectId("4") });
    const blockedResponse = createResponse();
    await getFriendDetails(
      { params: { userId: String(strangerId) }, user: { _id: currentUserId } },
      blockedResponse
    );
    assert.equal(blockedResponse.statusCode, 403);
    assert.equal(blockedResponse.body.message, "This user's details are not available");
  } finally {
    User.findById = originalFindById;
    FriendRequest.exists = originalExists;
    HandHistory.find = originalHandFind;
  }
});

test("getFriendDetails rejects invalid user ids before querying users", async () => {
  const originalFindById = User.findById;
  User.findById = () => {
    throw new Error("User.findById should not be called for invalid ids");
  };

  try {
    const response = createResponse();
    await getFriendDetails({ params: { userId: "not-an-id" }, user: { _id: objectId("1") } }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, "A valid userId is required");
  } finally {
    User.findById = originalFindById;
  }
});

test("getFriendDetails returns not found when the target user is missing", async () => {
  const currentUserId = objectId("1");
  const missingUserId = objectId("5");
  const currentUser = { _id: currentUserId, friends: [], isBlocked: false, status: "active" };
  const originalFindById = User.findById;

  User.findById = mockFindById(new Map([[String(currentUserId), currentUser]]));

  try {
    const response = createResponse();
    await getFriendDetails(
      { params: { userId: String(missingUserId) }, user: { _id: currentUserId } },
      response
    );

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.message, "User not found");
  } finally {
    User.findById = originalFindById;
  }
});
