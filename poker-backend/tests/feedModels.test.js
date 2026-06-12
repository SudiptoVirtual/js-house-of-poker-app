const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const FeedComment = require("../src/models/FeedComment");
const FeedGiftClip = require("../src/models/FeedGiftClip");
const FeedPost = require("../src/models/FeedPost");
const FeedPromotion = require("../src/models/FeedPromotion");
const FeedReaction = require("../src/models/FeedReaction");
const FeedShare = require("../src/models/FeedShare");
const { SHARE_DESTINATIONS, normalizeShareDestination, serializeTableContext } = require("../src/models/feedShared");

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
    "FeedPost validates required author fields while allowing media-only content",
    () => {
      const post = new FeedPost({});
      const error = post.validateSync();

      assert.equal(error.errors.authorUserId.kind, "required");
      assert.equal(error.errors.authorSnapshot.kind, "required");
      assert.equal(post.body, "");
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
          gameType: "holdem",
          handId: "NIGHT7:42",
          handNumber: 42,
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
          activeTableNavigation: {
            deepLink: "houseofpoker://tables/NIGHT7",
            params: { tableCode: "NIGHT7", tableId: String(objectId("3")) },
            route: "Game",
            screen: "GameScreen",
          },
          gameLabel: "Texas Hold'em",
          seatsOpen: 2,
          tableCode: "NIGHT7",
          tableId: String(objectId("3")),
          tableName: "Night Shift",
        },
        tableId: objectId("3"),
      });

      const client = post.toClient({ currentUserId: objectId("1") });

      assert.deepEqual(client, {
        actorProfileLink: {
          deepLink: "houseofpoker://profile/000000000000000000000001",
          params: { playerId: String(objectId("1")), userId: String(objectId("1")) },
          route: "Profile",
          screen: "ProfileScreen",
        },
        commentCount: 18,
        content: "Settling in for a mellow free-play night.",
        gameContext: {
          gameType: "holdem",
          handId: "NIGHT7:42",
          handNumber: 42,
          headline: "River review queue",
          resultLabel: "Open discussion",
          stakesLabel: "Free-play",
        },
        giftClipsCount: 12,
        giftClipsTotal: 18500,
        friendStatus: {
          action: "view-friends",
          available: false,
          isFriend: false,
          route: {
            action: "view-friends",
            deepLink: "houseofpoker://friends?userId=000000000000000000000001&action=view-friends",
            params: { action: "view-friends", userId: String(objectId("1")) },
            route: "Friends",
            screen: "FriendsScreen",
          },
        },
        id: String(objectId("2")),
        isPromoted: true,
        isTableRelated: true,
        media: [],
        player: {
          actorProfileLink: {
            deepLink: "houseofpoker://profile/000000000000000000000001",
            params: { playerId: String(objectId("1")), userId: String(objectId("1")) },
            route: "Profile",
            screen: "ProfileScreen",
          },
          handle: "@river-regular",
          id: String(objectId("1")),
          name: "River Regular",
          profileDeepLink: "houseofpoker://profile/000000000000000000000001",
          profileRoute: {
            deepLink: "houseofpoker://profile/000000000000000000000001",
            params: { playerId: String(objectId("1")), userId: String(objectId("1")) },
            route: "Profile",
            screen: "ProfileScreen",
          },
          status: "Online",
          statusTier: "mid_roller",
        },
        postKind: "standard",
        promotedCount: 8,
        reactionCounts: {
          support: 250,
        },
        shareCount: 7,
        supportersCount: 250,
        tableContext: {
          activeTableNavigation: {
            deepLink: "houseofpoker://tables/NIGHT7",
            params: { tableCode: "NIGHT7", tableId: String(objectId("3")) },
            route: "Game",
            screen: "GameScreen",
          },
          gameLabel: "Texas Hold'em",
          seatsOpen: 2,
          tableCode: "NIGHT7",
          tableId: String(objectId("3")),
          tableName: "Night Shift",
        },
        timestamp: "2026-06-03T12:00:00.000Z",
      });
    },
  ],
  [
    "FeedPost preserves document-level table invitation identifiers and resolves populated metadata",
    () => {
      const tableId = objectId("9");
      const post = createFeedPost({
        _id: objectId("8"),
        postKind: "table-invite",
        tableCode: "JOIN42",
        tableContext: {},
        tableId: { _id: tableId, gameType: "357", maxPlayers: 6, players: [{ id: "one" }, { id: "two" }], tableCode: "JOIN42", tableName: "Friday Night" },
      });
      const client = post.toClient();

      assert.equal(client.postKind, "table-invite");
      assert.equal(client.tableContext.tableCode, "JOIN42");
      assert.equal(client.tableContext.tableId, String(tableId));
      assert.equal(client.tableContext.tableName, "");
      assert.equal(client.tableContext.gameLabel, "");
      assert.deepEqual(serializeTableContext({
        tableCode: "JOIN42",
        tableContext: {},
        tableId: { _id: tableId, gameType: "357", maxPlayers: 6, players: [{ id: "one" }, { id: "two" }], tableName: "Friday Night" },
      }), {
        activeTableNavigation: { deepLink: "houseofpoker://tables/JOIN42", params: { tableCode: "JOIN42", tableId: String(tableId) }, route: "Game", screen: "GameScreen" },
        gameLabel: "3-5-7",
        seatsOpen: 4,
        tableCode: "JOIN42",
        tableId: String(tableId),
        tableName: "Friday Night",
      });
    },
  ],
  [
    "table codes survive create, list, and get feed serialization",
    () => {
      const persistedPost = createFeedPost({ _id: objectId("a"), postKind: "table-invite", tableCode: "SURVIVE7", tableContext: {}, tableId: objectId("b") });
      const createResponse = persistedPost.toClient();
      const listResponse = [persistedPost].map((post) => post.toClient())[0];
      const getResponse = persistedPost.toClient();

      for (const response of [createResponse, listResponse, getResponse]) {
        assert.equal(response.postKind, "table-invite");
        assert.equal(response.tableContext.tableCode, "SURVIVE7");
        assert.equal(response.tableContext.tableId, String(objectId("b")));
      }
    },
  ],
  [
    "FeedPost exposes feed ordering and lookup indexes",
    () => {
      assert.ok(hasIndex(FeedPost, { createdAt: -1, _id: -1 }));
      assert.ok(hasIndex(FeedPost, { authorUserId: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { isPromoted: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { chatRoomId: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { tableId: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { tableCode: 1, createdAt: -1 }));
      assert.ok(hasIndex(FeedPost, { visibility: 1, status: 1, "moderation.status": 1, createdAt: -1 }));
    },
  ],
  [
    "FeedReaction and FeedShare enforce per-user lookup uniqueness indexes",
    () => {
      assert.ok(hasIndex(FeedReaction, { postId: 1, userId: 1, reactionType: 1 }));
      assert.ok(hasIndex(FeedShare, { postId: 1, userId: 1, destination: 1, targetId: 1 }));
    },
  ],
  [
    "FeedShare maps frontend destinations and serializes share metadata",
    () => {
      assert.deepEqual(SHARE_DESTINATIONS, ["copy-link", "profile", "feed", "chat-room", "table", "facebook", "external"]);
      assert.equal(normalizeShareDestination("fb"), "facebook");
      assert.equal(normalizeShareDestination("chatroom"), "chat-room");

      const share = new FeedShare({
        destination: "fb",
        metadata: { source: "share-menu" },
        postId: objectId("c"),
        targetIdentifiers: { tableId: "NIGHT7" },
        targetType: "table",
        userId: objectId("d"),
      });

      assert.equal(share.validateSync(), undefined);
      assert.equal(share.destination, "facebook");
      assert.equal(share.channel, "facebook");
      assert.deepEqual(share.toClient().metadata, { source: "share-menu" });
      assert.deepEqual(share.toClient().targetIdentifiers, { tableId: "NIGHT7" });
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
        metadata: { source: "share-menu" },
        postId,
        targetId: "room-1",
        targetIdentifiers: { roomId: "room-1" },
        targetType: "room",
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
      assert.equal(share.toClient().targetType, "room");
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
