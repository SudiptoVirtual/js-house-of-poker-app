const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const FriendRequest = require("../src/models/FriendRequest");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function getIndexes(model) {
  return model.schema.indexes();
}

function hasIndex(model, expectedFields, predicate = () => true) {
  return getIndexes(model).some(
    ([fields, options]) =>
      JSON.stringify(fields) === JSON.stringify(expectedFields) && predicate(options || {})
  );
}

const tests = [
  [
    "FriendRequest supports required statuses and timestamps",
    () => {
      const request = new FriendRequest({
        senderUserId: objectId("1"),
        receiverUserId: objectId("2"),
      });

      assert.equal(request.status, "pending");
      assert.deepEqual(FriendRequest.FRIEND_REQUEST_STATUSES, [
        "pending",
        "accepted",
        "declined",
        "blocked",
        "removed",
      ]);

      const invalidRequest = new FriendRequest({
        senderUserId: objectId("1"),
        receiverUserId: objectId("2"),
        status: "ignored",
      });
      const error = invalidRequest.validateSync();

      assert.equal(error.errors.status.kind, "enum");
      assert.equal(FriendRequest.schema.options.timestamps, true);
    },
  ],
  [
    "FriendRequest creates an order-independent pair key",
    async () => {
      const first = new FriendRequest({
        senderUserId: objectId("1"),
        receiverUserId: objectId("2"),
      });
      const second = new FriendRequest({
        senderUserId: objectId("2"),
        receiverUserId: objectId("1"),
      });

      await first.validate();
      await second.validate();

      assert.equal(first.pairKey, second.pairKey);
      assert.equal(
        first.pairKey,
        "000000000000000000000001:000000000000000000000002"
      );
    },
  ],
  [
    "FriendRequest defines pending dedupe and lookup indexes",
    () => {
      assert.ok(
        hasIndex(
          FriendRequest,
          { pairKey: 1, status: 1 },
          (options) => options.unique === true && options.partialFilterExpression?.status === "pending"
        )
      );
      assert.ok(
        hasIndex(FriendRequest, {
          senderUserId: 1,
          status: 1,
          receiverUserId: 1,
          updatedAt: -1,
        })
      );
      assert.ok(
        hasIndex(FriendRequest, {
          receiverUserId: 1,
          status: 1,
          senderUserId: 1,
          updatedAt: -1,
        })
      );
      assert.ok(hasIndex(FriendRequest, { pairKey: 1, status: 1, updatedAt: -1 }));
    },
  ],
];

for (const [name, testFn] of tests) {
  test(name, testFn);
}
