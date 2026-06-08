const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FriendRequest = require("../src/models/FriendRequest");
const User = require("../src/models/User");
const { searchPlayers } = require("../src/controllers/friendController");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function createQuery(result) {
  return {
    lean: async () => result,
    limit() {
      return this;
    },
    select() {
      return this;
    },
    sort() {
      return this;
    },
  };
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

function player(id, name, email) {
  return {
    _id: id,
    avatar: "",
    email,
    isOnline: false,
    name,
    playerStatus: { tier: "NO_STATUS" },
    status: "active",
  };
}

test("searchPlayers accepts q, searches supported identity fields, excludes the current user, and decorates relationships", async () => {
  const currentUserId = objectId("1");
  const friendId = objectId("2");
  const inboundId = objectId("3");
  const outboundId = objectId("4");
  const strangerId = objectId("5");
  const inboundRequestId = objectId("13");
  const outboundRequestId = objectId("14");
  const users = [
    player(friendId, "Thor Friend", "thor.friend@example.com"),
    player(inboundId, "Thor Inbound", "thor.inbound@example.com"),
    player(outboundId, "Thor Outbound", "thor.outbound@example.com"),
    player(strangerId, "Thor Stranger", "thor.stranger@example.com"),
  ];
  const pendingRequests = [
    {
      _id: inboundRequestId,
      receiverUserId: currentUserId,
      senderUserId: inboundId,
      status: "pending",
    },
    {
      _id: outboundRequestId,
      receiverUserId: outboundId,
      senderUserId: currentUserId,
      status: "pending",
    },
  ];
  const originalUserFind = User.find;
  const originalFriendRequestFind = FriendRequest.find;
  let userFilter;
  let requestFilter;

  User.find = (filter) => {
    userFilter = filter;
    return createQuery(users);
  };
  FriendRequest.find = (filter) => {
    requestFilter = filter;
    return createQuery(pendingRequests);
  };

  try {
    const response = createResponse();

    await searchPlayers(
      { query: { q: "Thor" }, user: { _id: currentUserId, friends: [friendId] } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.count, 4);
    assert.equal(response.body.query, "Thor");
    assert.deepEqual(
      response.body.players.map(({ relationshipStatus }) => relationshipStatus),
      ["friend", "request_received", "request_sent", "not_friends"]
    );
    assert.equal(response.body.players[1].requestId, String(inboundRequestId));
    assert.equal(response.body.players[2].requestId, String(outboundRequestId));
    assert.deepEqual(userFilter._id, { $ne: currentUserId });
    assert.equal(userFilter.$or.find((condition) => condition.name).name.test("Mighty Thor"), true);
    assert.equal(
      userFilter.$or.find((condition) => condition.username).username.test("thor_user"),
      true
    );
    assert.equal(
      userFilter.$or.find((condition) => condition.email).email.test("thor@example.com"),
      true
    );
    assert.equal(
      userFilter.$or.find((condition) => condition.email).email.test("hero.thor@example.com"),
      false
    );
    assert.deepEqual(requestFilter.status, "pending");
    assert.equal(requestFilter.pairKey.$in.length, users.length);
  } finally {
    User.find = originalUserFind;
    FriendRequest.find = originalFriendRequestFind;
  }
});

test("searchPlayers accepts query as an alias for q", async () => {
  const originalUserFind = User.find;
  let userFilter;

  User.find = (filter) => {
    userFilter = filter;
    return createQuery([]);
  };

  try {
    const response = createResponse();

    await searchPlayers(
      { query: { query: "  Loki  " }, user: { _id: objectId("1"), friends: [] } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.query, "Loki");
    assert.equal(
      userFilter.$or.find((condition) => condition.name).name.test("Loki Laufeyson"),
      true
    );
  } finally {
    User.find = originalUserFind;
  }
});

test("searchPlayers returns an empty successful result without querying users", async () => {
  const originalUserFind = User.find;
  User.find = () => {
    throw new Error("User.find should not be called for an empty query");
  };

  try {
    for (const query of [{}, { q: "   " }, { query: "   " }]) {
      const response = createResponse();

      await searchPlayers({ query, user: { _id: objectId("1"), friends: [] } }, response);

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { count: 0, players: [], query: "" });
    }
  } finally {
    User.find = originalUserFind;
  }
});

test("friend routes register GET /search before parameterized status routes", () => {
  const router = require("../src/routes/friendRoutes");
  const routeLayers = router.stack.filter((layer) => layer.route);
  const searchIndex = routeLayers.findIndex((layer) => layer.route.path === "/search");
  const statusIndex = routeLayers.findIndex((layer) => layer.route.path === "/status/:userId");
  const searchRoute = routeLayers[searchIndex]?.route;

  assert.notEqual(searchIndex, -1);
  assert.equal(searchRoute.methods.get, true);
  assert.ok(searchIndex < statusIndex);
});
