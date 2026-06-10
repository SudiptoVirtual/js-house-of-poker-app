const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FriendRequest = require("../src/models/FriendRequest");
const { getIncomingFriendRequests } = require("../src/controllers/friendController");

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

test("getIncomingFriendRequests lists only the authenticated recipient's pending requests", async () => {
  const receiverUserId = objectId("1");
  const senderUserId = objectId("2");
  const requestId = objectId("3");
  const originalFind = FriendRequest.find;
  let filter;
  let populateOptions;

  FriendRequest.find = (receivedFilter) => {
    filter = receivedFilter;
    return {
      lean: async () => [{
        _id: requestId,
        createdAt: new Date("2026-06-10T00:00:00.000Z"),
        receiverUserId,
        senderUserId: {
          _id: senderUserId,
          avatar: "sender.png",
          displayName: "Sender Display",
          email: "sender@example.test",
          isOnline: true,
          name: "Sender Name",
          playerStatus: { iconKey: "badge-pro", tier: "PRO" },
          status: "active",
          username: "sender_user",
        },
        status: "pending",
        updatedAt: new Date("2026-06-10T00:00:00.000Z"),
      }],
      populate(options) {
        populateOptions = options;
        return this;
      },
      sort() {
        return this;
      },
    };
  };

  try {
    const response = createResponse();
    await getIncomingFriendRequests({ user: { _id: receiverUserId } }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(filter, { receiverUserId, status: "pending" });
    assert.equal(populateOptions.path, "senderUserId");
    assert.equal(response.body.count, 1);
    assert.equal(response.body.status, "pending_received");
    assert.equal(response.body.requests[0].id, String(senderUserId));
    assert.equal(response.body.requests[0].displayName, "Sender Display");
    assert.equal(response.body.requests[0].isOnline, true);
    assert.equal(response.body.requests[0].relationshipStatus, "pending_received");
    assert.equal(response.body.requests[0].requestId, String(requestId));
    assert.equal(response.body.requests[0].request.receiverUserId, String(receiverUserId));
  } finally {
    FriendRequest.find = originalFind;
  }
});

test("friend routes register incoming requests before parameterized status routes", () => {
  const router = require("../src/routes/friendRoutes");
  const routeLayers = router.stack.filter((layer) => layer.route);
  const incomingIndex = routeLayers.findIndex((layer) => layer.route.path === "/requests/incoming");
  const statusIndex = routeLayers.findIndex((layer) => layer.route.path === "/status/:userId");

  assert.notEqual(incomingIndex, -1);
  assert.equal(routeLayers[incomingIndex].route.methods.get, true);
  assert.ok(incomingIndex < statusIndex);
});
