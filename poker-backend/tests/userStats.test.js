const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const HandHistory = require("../src/models/HandHistory");
const { buildUserGameplayStats } = require("../src/utils/userStats");

function objectId(hex) {
  return new mongoose.Types.ObjectId(hex.padStart(24, "0"));
}

function mockFind(hands, calls = []) {
  return (filter) => {
    calls.push(filter);

    return {
      select(fields) {
        calls.push({ select: fields });

        return {
          async lean() {
            return hands;
          },
        };
      },
    };
  };
}

test("buildUserGameplayStats summarizes completed hand history for a user", async () => {
  const userId = objectId("1");
  const otherUserId = objectId("2");
  const calls = [];
  const originalFind = HandHistory.find;

  HandHistory.find = mockFind(
    [
      {
        tableId: objectId("10"),
        tableCode: "ALPHA",
        totalPot: 300,
        players: [
          { userId, chipsWon: 300, chipsDelta: 150 },
          { userId: otherUserId, chipsWon: 0, chipsDelta: -150 },
        ],
      },
      {
        tableId: objectId("10"),
        totalPot: 120,
        players: [{ userId, chipsWon: 0, chipsDelta: -40 }],
      },
      {
        tableCode: "beta",
        totalPot: 500,
        players: [{ userId: String(userId), chipsWon: 500, chipsDelta: 0 }],
      },
    ],
    calls
  );

  try {
    const stats = await buildUserGameplayStats(userId);

    assert.deepEqual(stats, {
      handsPlayed: 3,
      gamesPlayed: 2,
      wins: 2,
      losses: 1,
      winRate: (2 / 3) * 100,
      totalWinnings: 610,
      biggestPotWon: 500,
    });
    assert.deepEqual(calls[0], { "players.userId": userId, status: "completed" });
  } finally {
    HandHistory.find = originalFind;
  }
});

test("buildUserGameplayStats returns zero values when no completed hands exist", async () => {
  const userId = objectId("1");
  const originalFind = HandHistory.find;

  HandHistory.find = mockFind([]);

  try {
    const stats = await buildUserGameplayStats(userId);

    assert.deepEqual(stats, {
      handsPlayed: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalWinnings: 0,
      biggestPotWon: 0,
    });
  } finally {
    HandHistory.find = originalFind;
  }
});
