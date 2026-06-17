const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FriendRequest = require("../src/models/FriendRequest");
const User = require("../src/models/User");
const { removeFriend } = require("../src/controllers/friendController");

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

function selectable(value) {
  return { select: async () => value };
}

function installUserFindById(usersById) {
  User.findById = (id) => selectable(usersById.get(String(id)) || null);
}

async function withMocks(callback) {
  const originals = {
    exists: FriendRequest.exists,
    findById: User.findById,
    findOneAndUpdate: FriendRequest.findOneAndUpdate,
    updateOne: User.updateOne,
  };

  try {
    await callback();
  } finally {
    FriendRequest.exists = originals.exists;
    FriendRequest.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.findById;
    User.updateOne = originals.updateOne;
  }
}

test("removeFriend pulls each user from the other's friends list", async () => {
  await withMocks(async () => {
    const currentUserId = objectId("1");
    const targetUserId = objectId("2");
    const currentUser = { _id: currentUserId, friends: [targetUserId], isBlocked: false, status: "active" };
    const targetUser = { _id: targetUserId, friends: [currentUserId], isBlocked: false, status: "active" };
    const updates = [];
    let historyUpdate;

    installUserFindById(new Map([[String(currentUserId), currentUser], [String(targetUserId), targetUser]]));
    FriendRequest.exists = async () => null;
    User.updateOne = async (filter, update) => {
      updates.push({ filter, update });
      return { modifiedCount: 1 };
    };
    FriendRequest.findOneAndUpdate = async (filter, update, options) => {
      historyUpdate = { filter, options, update };
      return { _id: objectId("3"), ...update.$set };
    };

    const response = createResponse();
    await removeFriend({ params: { userId: String(targetUserId) }, user: { _id: currentUserId } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.status, "none");
    assert.equal(String(updates[0].filter._id), String(currentUserId));
    assert.equal(String(updates[0].update.$pull.friends), String(targetUserId));
    assert.equal(String(updates[1].filter._id), String(targetUserId));
    assert.equal(String(updates[1].update.$pull.friends), String(currentUserId));
    assert.equal(historyUpdate.update.$set.status, "removed");
    assert.equal(historyUpdate.options.upsert, true);
  });
});

test("removeFriend rejects not-friends removal", async () => {
  await withMocks(async () => {
    const currentUserId = objectId("1");
    const targetUserId = objectId("2");

    installUserFindById(new Map([
      [String(currentUserId), { _id: currentUserId, friends: [], isBlocked: false, status: "active" }],
      [String(targetUserId), { _id: targetUserId, friends: [], isBlocked: false, status: "active" }],
    ]));
    FriendRequest.exists = async () => null;
    User.updateOne = async () => { throw new Error("should not update non-friends"); };

    const response = createResponse();
    await removeFriend({ params: { userId: String(targetUserId) }, user: { _id: currentUserId } }, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.message, "Friend relationship not found");
  });
});

test("removeFriend rejects invalid target ids before querying users", async () => {
  await withMocks(async () => {
    User.findById = () => { throw new Error("should not query for invalid id"); };

    const response = createResponse();
    await removeFriend({ params: { userId: "bad-id" }, user: { _id: objectId("1") } }, response);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, "A valid userId is required");
  });
});

test("removeFriend rejects blocked or suspended account behavior", async () => {
  await withMocks(async () => {
    const currentUserId = objectId("1");
    const targetUserId = objectId("2");

    installUserFindById(new Map([
      [String(currentUserId), { _id: currentUserId, friends: [targetUserId], isBlocked: true, status: "active" }],
      [String(targetUserId), { _id: targetUserId, friends: [currentUserId], isBlocked: false, status: "active" }],
    ]));

    let response = createResponse();
    await removeFriend({ params: { userId: String(targetUserId) }, user: { _id: currentUserId } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.message, "Your account is blocked");

    installUserFindById(new Map([
      [String(currentUserId), { _id: currentUserId, friends: [targetUserId], isBlocked: false, status: "active" }],
      [String(targetUserId), { _id: targetUserId, friends: [currentUserId], isBlocked: false, status: "suspended" }],
    ]));

    response = createResponse();
    await removeFriend({ params: { userId: String(targetUserId) }, user: { _id: currentUserId } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.message, "Cannot remove this friend right now");
  });
});
