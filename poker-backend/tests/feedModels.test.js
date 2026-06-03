const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const FeedComment = require("../src/models/FeedComment");
const FeedGiftClip = require("../src/models/FeedGiftClip");
const FeedPost = require("../src/models/FeedPost");
const FeedPromotion = require("../src/models/FeedPromotion");
const FeedReaction = require("../src/models/FeedReaction");
const FeedShare = require("../src/models/FeedShare");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function createAuthorSnapshot(overrides = {}) {
  return {
    handle: "@river-regular",
    name: "River Regular",
    status: "Online",
    statusTier: "mid_roller",
    ...overrides,
  };
}

function createFeedPost(overrides = {}) {
  return new FeedPost({
    authorSnapshot: createAuthorSnapshot(),
    authorUserId: objectId("1"),
    body: "Settling in for a mellow free-play night.",
    counters: {
      commentCount: 3,
      shareCount: 2,
      supportersCount: 7,
    },
    ...overrides,
  });
}

function getIndexFields(model) {
  return model.schema.indexes().map(([fields]) => fields);
}

function hasIndex(model, expectedFields) {
  return getIndexFields(model).some(
    (fields) => JSON.stringify(fields) === JSON.stringify(expectedFields)
  );
}

const tests = [
  [
    "FeedPost validates required content and author fields",
    () => {
      const post = new FeedPost({});
      const error = post.validateSync();

      assert.equal(error.errors.authorUserId.kind, "required");
      assert.equal(error.errors.authorSnapshot.kind, "required");
      assert.equal(error.errors.body.kind, "required");
    },
  ],
  [
    "FeedPost serializes to the mobile FeedPost contract",
    () => {
      const createdAt = new Date("2026-06-03T12:00:00.000Z");
      const post = createFeedPost({
        _id: objectId("2"),
        counters: {
          commentCount: 18,
          giftClipsCount: 12,
          giftClipsTotal: 18500,
          promotedCount: 8,
          shareCount: 7,
          supportersCount: 250,
        },
        createdAt,
        gameContext: {
          headline: "River review queue",
          resultLabel: "Open discussion",
          stakesLabel: "Free-play",
        },
        isPromoted: true,
        promotion: {
          isPromoted: true,
          state: "active",
        },
        tableCode: "NIGHT7",
        tableContext: {
          gameLabel: "Texas Hold'em",
          seatsOpen: 2,
          tableName: "Night Shift",
        },
        tableId: objectId("3"),
      });

      const client = post.toClient({ currentUserId: objectId("1") });

      assert.deepEqual(client, {
        commentCount: 18,
        content: "Settling in for a mellow free-play night.",
        gameContext: {
          headline: "River review queue",
          resultLabel: "Open discussion",
          stakesLabel: "Free-play",
        },
        giftClipsCount: 12,
        giftClipsTotal: 18500,
        id: String(objectId("2")),
        isPromoted: true,
        isTableRelated: true,
        player: {
          handle: "@river-regular",
          id: String(objectId("1")),
          name: "River Regular",
          status: "Online",
          statusTier: "mid_roller",
        },
        promotedCount: 8,
        shareCount: 7,
        supportersCount: 250,
        tableContext: {
          gameLabel: "Texas Hold'em",
          seatsOpen: 2,
          tableName: "Night Shift",
        },
        timestamp: "2026-06-03T12:00:00.000Z",
      });
    },
  ],
  [
    "FeedPost exposes feed ordering and lookup indexes",
    () => {
      assert.ok(hasIndex(FeedPost, { createdAt: -1, _id: -1 }));
      assert.ok(hasIndex(FeedPost, { authorUserId: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { isPromoted: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { tableId: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { tableCode: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { visibility: 1, status: 1, "moderation.status": 1, createdAt: -1 }));
    },
  ],
  [
    "FeedReaction and FeedShare enforce per-user lookup uniqueness indexes",
    () => {
      assert.ok(hasIndex(FeedReaction, { postId: 1, userId: 1, type: 1 }));
      assert.ok(hasIndex(FeedShare, { postId: 1, userId: 1, destination: 1, targetId: 1 }));
    },
  ],
  [
    "Related feed models validate and serialize client-facing fields",
    () => {
      const postId = objectId("4");
      const userId = objectId("5");
      const recipientUserId = objectId("6");
      const createdAt = new Date("2026-06-03T12:30:00.000Z");

      const comment = new FeedComment({
        _id: objectId("7"),
        authorSnapshot: createAuthorSnapshot({ name: "Commenter" }),
        authorUserId: userId,
        body: "Great hand review.",
        createdAt,
        postId,
      });
      const reaction = new FeedReaction({ _id: objectId("8"), createdAt, postId, userId });
      const share = new FeedShare({
        _id: objectId("9"),
        createdAt,
        destination: "chat-room",
        postId,
        targetId: "room-1",
        userId,
      });
      const giftClip = new FeedGiftClip({
        _id: objectId("a"),
        amount: 250,
        createdAt,
        postId,
        recipientUserId,
        senderUserId: userId,
      });
      const promotion = new FeedPromotion({
        _id: objectId("b"),
        budgetClips: 1000,
        createdAt,
        postId,
        promotedByUserId: userId,
        startsAt: createdAt,
        state: "active",
        updatedAt: createdAt,
      });

      for (const document of [comment, reaction, share, giftClip, promotion]) {
        assert.equal(document.validateSync(), undefined);
      }

      assert.equal(comment.toClient().body, "Great hand review.");
      assert.equal(comment.toClient().player.name, "Commenter");
      assert.equal(reaction.toClient().type, "support");
      assert.equal(share.toClient().targetId, "room-1");
      assert.equal(giftClip.toClient().amount, 250);
      assert.equal(promotion.toClient().state, "active");
    },
  ],
];

(async () => {
  let failures = 0;

  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
})();
