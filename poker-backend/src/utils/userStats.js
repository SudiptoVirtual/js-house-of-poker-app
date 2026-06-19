const HandHistory = require("../models/HandHistory");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isSameUserId(first, second) {
  return String(first || "") === String(second || "");
}

function getPlayerFromHand(hand, userId) {
  return (hand.players || []).find((player) => isSameUserId(player.userId, userId));
}

function getGameKey(hand) {
  if (hand.tableId) {
    return String(hand.tableId);
  }

  if (hand.tableCode) {
    return String(hand.tableCode).trim().toUpperCase();
  }

  return null;
}

async function buildUserGameplayStats(userId) {
  const hands = await HandHistory.find({
    "players.userId": userId,
    status: "completed",
  })
    .select("players.userId players.chipsWon players.chipsDelta totalPot tableId tableCode")
    .lean();

  const games = new Set();
  let wins = 0;
  let losses = 0;
  let totalWinnings = 0;
  let biggestPotWon = 0;

  for (const hand of hands) {
    const player = getPlayerFromHand(hand, userId);

    if (!player) {
      continue;
    }

    const gameKey = getGameKey(hand);
    if (gameKey) {
      games.add(gameKey);
    }

    const chipsWon = toNumber(player.chipsWon);
    const chipsDelta = toNumber(player.chipsDelta);
    const wonHand = chipsWon > 0 || chipsDelta > 0;

    if (wonHand) {
      wins += 1;
      biggestPotWon = Math.max(biggestPotWon, toNumber(hand.totalPot));
    }

    if (chipsDelta < 0) {
      losses += 1;
    }

    totalWinnings += chipsDelta || chipsWon;
  }

  const handsPlayed = hands.length;

  return {
    handsPlayed,
    gamesPlayed: games.size,
    wins,
    losses,
    winRate: handsPlayed > 0 ? (wins / handsPlayed) * 100 : 0,
    totalWinnings,
    biggestPotWon,
  };
}

module.exports = {
  buildUserGameplayStats,
};
