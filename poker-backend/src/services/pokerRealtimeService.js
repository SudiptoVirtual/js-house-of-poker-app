const jwt = require("jsonwebtoken");

const GameTable = require("../models/GameTable");
const HandHistory = require("../models/HandHistory");
const User = require("../models/User");
const { logTableEvent } = require("../utils/liveEmitter");
const { Hand } = require("../utils/loadPokerSolver");
const {
  THREE_FIVE_SEVEN_TABLE,
  build357WildDefinition,
  is357Mode,
  normalize357Mode,
  rank357Hands,
} = require("../utils/threeFiveSeven");

const SMALL_BLIND = Math.max(
  1,
  Number.parseInt(process.env.POKER_SMALL_BLIND || "10", 10)
);
const BIG_BLIND = Math.max(
  SMALL_BLIND,
  Number.parseInt(process.env.POKER_BIG_BLIND || "20", 10)
);
const DEFAULT_BUY_IN = Math.max(
  BIG_BLIND * 10,
  Number.parseInt(process.env.POKER_DEFAULT_BUY_IN || "1000", 10)
);
const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 2;
const LOG_LIMIT = 32;
const TABLE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALID_GAMES = new Set([
  "357",
  "shanghai",
  "in-between-the-sheets",
  "7-27",
  "holdem",
]);
const VALID_STANDARD_MODES = new Set(["high-only", "high-low", "low-only"]);
const VALID_MODES = new Set([
  ...VALID_STANDARD_MODES,
  ...THREE_FIVE_SEVEN_TABLE.modes,
]);
const VALID_LOW_RULES = new Set(["8-or-better", "wheel", "any-low"]);
const VALID_WILD_CARDS = new Set([
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
]);

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createDefaultGameSettings() {
  return {
    game: "holdem",
    locked: false,
    lowRule: "8-or-better",
    mode: "high-only",
    stips: {
      bestFiveCards: false,
      hostestWithTheMostest: false,
      suitedBeatsUnsuited: false,
      wildCards: false,
    },
    wildCards: [],
  };
}

function cloneGameSettings(gameSettings) {
  const source = gameSettings || createDefaultGameSettings();

  return {
    game: source.game,
    locked: Boolean(source.locked),
    lowRule: source.lowRule,
    mode: source.mode,
    stips: {
      bestFiveCards: Boolean(source.stips?.bestFiveCards),
      hostestWithTheMostest: Boolean(source.stips?.hostestWithTheMostest),
      suitedBeatsUnsuited: Boolean(source.stips?.suitedBeatsUnsuited),
      wildCards: Boolean(source.stips?.wildCards),
    },
    wildCards: Array.isArray(source.wildCards) ? [...source.wildCards] : [],
  };
}

function sync357GameSettings(gameSettings) {
  const nextSettings = cloneGameSettings(gameSettings);

  if (nextSettings.game === "357") {
    const mode = normalize357Mode(nextSettings);
    nextSettings.mode = mode;
    nextSettings.stips.bestFiveCards = mode === "BEST_FIVE";
    nextSettings.stips.hostestWithTheMostest = mode === "HOSTEST";
    nextSettings.stips.wildCards = false;
    nextSettings.wildCards = [];
    return nextSettings;
  }

  if (is357Mode(nextSettings.mode)) {
    nextSettings.mode = "high-only";
  }

  return nextSettings;
}

function normalizeWildCards(wildCards) {
  if (!Array.isArray(wildCards)) {
    return null;
  }

  return [
    ...new Set(
      wildCards
        .map((value) =>
          typeof value === "string" ? value.trim().toUpperCase() : ""
        )
        .filter((value) => VALID_WILD_CARDS.has(value))
    ),
  ];
}

function createDefaultStatusSnapshot() {
  return {
    invitePriority: 0,
    lastUpdatedAt: null,
    recentHands: 0,
    recentScore: 0,
    reputation: 0,
    sharkWins: 0,
    strongTableWins: 0,
    windowSize: 20,
  };
}

function createDeck() {
  const suits = ["s", "h", "d", "c"];
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

  const deck = suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}`));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function tableEventMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function sanitizeName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function sanitizeTableName(value, tableCode) {
  const trimmed = sanitizeName(value);
  return trimmed || `Table ${tableCode}`;
}

function normalizeInviteMessage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 120);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTableChatText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, 280);
}

function buildTableCodeCandidate() {
  return Array.from({ length: 5 }, () => {
    const index = Math.floor(Math.random() * TABLE_CODE_ALPHABET.length);
    return TABLE_CODE_ALPHABET[index];
  }).join("");
}

function nextId(ids, currentId, predicate = () => true) {
  if (ids.length === 0) {
    return null;
  }

  const currentIndex = currentId ? ids.indexOf(currentId) : -1;

  for (let step = 1; step <= ids.length; step += 1) {
    const candidate = ids[(currentIndex + step + ids.length) % ids.length];
    if (predicate(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildPlayerFromUser(user, seatNumber, socketId, chipsOnTable) {
  return {
    avatar: user.avatar || "",
    chips: chipsOnTable,
    id: user._id.toString(),
    isConnected: true,
    name: user.name,
    pendingRemoval: false,
    playerStatus: user.playerStatus?.tier || "NO_STATUS",
    referralCode: user.referralCode || "",
    seatNumber,
    socketId,
    statusIcon: user.playerStatus?.iconKey || "badge-no-status",
    statusSnapshot: createDefaultStatusSnapshot(),
    userId: user._id.toString(),
  };
}

function sortPlayersBySeat(players) {
  return [...players].sort((left, right) => left.seatNumber - right.seatNumber);
}

function buildPlayerRuntimeMap(players) {
  return sortPlayersBySeat(players);
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) || null;
}

function getHandPlayer(room, playerId) {
  return room.hand?.players?.[playerId] || null;
}

function roomOrderIds(room, predicate = () => true) {
  return buildPlayerRuntimeMap(room.players)
    .filter(predicate)
    .map((player) => player.id);
}

function activeHandIds(room) {
  if (!room.hand) {
    return [];
  }

  return roomOrderIds(room, (player) => Boolean(room.hand.players[player.id]));
}

function contenderIds(room) {
  return activeHandIds(room).filter(
    (playerId) => !room.hand.players[playerId].folded
  );
}

function actionableIds(room) {
  return activeHandIds(room).filter((playerId) => {
    const roomPlayer = getPlayer(room, playerId);
    const handPlayer = getHandPlayer(room, playerId);

    return Boolean(
      roomPlayer &&
        handPlayer &&
        !handPlayer.folded &&
        !handPlayer.allIn &&
        roomPlayer.chips > 0
    );
  });
}

function addLog(room, message) {
  room.actionLog.unshift(message);
  room.actionLog = room.actionLog.slice(0, LOG_LIMIT);
}

function createThreeFiveSevenRoomState() {
  return {
    activeRound: null,
    activeWildDefinition: build357WildDefinition(
      THREE_FIVE_SEVEN_TABLE.defaultMode,
      null
    ),
    anteAmount: THREE_FIVE_SEVEN_TABLE.anteClips,
    anteCollectionKeys: {},
    hiddenDecisionState: {
      currentRound: null,
      historyByPlayerId: {},
      revealedByPlayerId: {},
    },
    lastPhaseSequence: [],
    lastResolution: null,
    legsByPlayerId: {},
    mode: THREE_FIVE_SEVEN_TABLE.defaultMode,
    penaltyModel: {
      legsToWin: THREE_FIVE_SEVEN_TABLE.legsToWin,
      soloGoLegAward: 1,
      unitToPot: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
      unitToWinner: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
    },
    pot: 0,
    revealState: "hidden",
    showdownPlayerIds: [],
  };
}

function ensureThreeFiveSevenState(room) {
  if (!room.threeFiveSeven) {
    room.threeFiveSeven = createThreeFiveSevenRoomState();
  }

  const mode = normalize357Mode(ensureGameSettings(room));
  room.threeFiveSeven.anteAmount = THREE_FIVE_SEVEN_TABLE.anteClips;
  room.threeFiveSeven.anteCollectionKeys =
    room.threeFiveSeven.anteCollectionKeys || {};
  room.threeFiveSeven.penaltyModel = {
    ...(room.threeFiveSeven.penaltyModel || {}),
    legsToWin: THREE_FIVE_SEVEN_TABLE.legsToWin,
    soloGoLegAward: 1,
    unitToPot: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
    unitToWinner: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
  };
  room.threeFiveSeven.mode = mode;
  room.threeFiveSeven.activeWildDefinition = room.threeFiveSeven.activeRound
    ? build357WildDefinition(mode, room.threeFiveSeven.activeRound)
    : build357WildDefinition(mode, null);

  room.players.forEach((player) => {
    if (typeof room.threeFiveSeven.legsByPlayerId[player.id] !== "number") {
      room.threeFiveSeven.legsByPlayerId[player.id] = 0;
    }

    if (!room.threeFiveSeven.hiddenDecisionState.historyByPlayerId[player.id]) {
      room.threeFiveSeven.hiddenDecisionState.historyByPlayerId[player.id] = {};
    }
  });

  return room.threeFiveSeven;
}

function is357Game(room) {
  return ensureGameSettings(room).game === "357";
}

function eligible357ParticipantIds(room) {
  return roomOrderIds(
    room,
    (player) =>
      player.isConnected &&
      !player.pendingRemoval &&
      player.chips >= THREE_FIVE_SEVEN_TABLE.anteClips
  );
}

function set357Phase(room, phase) {
  if (!room.hand) {
    return;
  }

  room.hand.phase = phase;
  room.phase = phase;
  if (
    room.hand.threeFiveSeven.phaseSequence[
      room.hand.threeFiveSeven.phaseSequence.length - 1
    ] !== phase
  ) {
    room.hand.threeFiveSeven.phaseSequence.push(phase);
  }
}

function normalize357Action(actionType) {
  const action = typeof actionType === "string" ? actionType.trim().toUpperCase() : "";

  if (action === "GO" || action === "PLAYER_GO") {
    return "GO";
  }

  if (action === "STAY" || action === "PLAYER_STAY") {
    return "STAY";
  }

  if (action === "FOLD" || action === "PLAYER_FOLD") {
    return "FOLD";
  }

  return null;
}

function is357DecisionPhase(room) {
  if (!room.hand) {
    return false;
  }

  const roundSize = Number(room.hand.phase.slice(-1));
  return (
    room.hand.phase.startsWith("decide_") &&
    THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize)
  );
}

function get357DecisionRound(room) {
  return is357DecisionPhase(room) ? Number(room.hand.phase.slice(-1)) : null;
}

function totalPot(room) {
  if (is357Game(room)) {
    return ensureThreeFiveSevenState(room).pot;
  }

  if (!room.hand) {
    return 0;
  }

  return Object.values(room.hand.players).reduce(
    (sum, player) => sum + player.totalContribution,
    0
  );
}

function findNextActionablePlayer(room, fromPlayerId) {
  return nextId(actionableIds(room), fromPlayerId);
}

function commitChips(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.betThisRound += committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  return committed;
}

function contribute357ToPot(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);
  const variantState = ensureThreeFiveSevenState(room);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  variantState.pot += committed;
  return committed;
}

function withdraw357ForWinner(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  return committed;
}

function reset357PublicDecisionState(room, roundSize) {
  const variantState = ensureThreeFiveSevenState(room);
  variantState.activeRound = roundSize;
  variantState.activeWildDefinition = build357WildDefinition(
    variantState.mode,
    roundSize
  );
  variantState.hiddenDecisionState.currentRound = roundSize;
  variantState.hiddenDecisionState.revealedByPlayerId = {};
  variantState.revealState = "hidden";
  variantState.showdownPlayerIds = [];
}

function deal357ToRound(room, roundSize) {
  if (!room.hand) {
    return;
  }

  activeHandIds(room).forEach((playerId) => {
    const handPlayer = room.hand.players[playerId];
    while (handPlayer.cards.length < roundSize) {
      handPlayer.cards.push(room.hand.deck.pop());
    }
  });

  reset357PublicDecisionState(room, roundSize);
  set357Phase(room, `decide_${roundSize}`);
}

function findNext357DecisionPlayer(room, roundSize, fromPlayerId) {
  return nextId(
    activeHandIds(room),
    fromPlayerId,
    (playerId) =>
      room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[
        roundSize
      ] == null
  );
}

function collect357AnteOnce(room, participantIds, cycleKey) {
  const variantState = ensureThreeFiveSevenState(room);
  if (!cycleKey || variantState.anteCollectionKeys[cycleKey]) {
    return { chargedPlayerIds: [], collectedTotal: 0 };
  }

  const chargedPlayerIds = [];
  let collectedTotal = 0;

  participantIds.forEach((participantId) => {
    const contributed = contribute357ToPot(
      room,
      participantId,
      variantState.anteAmount
    );
    if (contributed > 0) {
      chargedPlayerIds.push(participantId);
      collectedTotal += contributed;
    }
  });

  variantState.anteCollectionKeys[cycleKey] = {
    chargedPlayerIds,
    collectedTotal,
    handNumber: room.handCount,
  };

  return { chargedPlayerIds, collectedTotal };
}

function start357Cycle(room) {
  const variantState = ensureThreeFiveSevenState(room);

  const participants = eligible357ParticipantIds(room);
  if (participants.length < 2) {
    if (room.hand) {
      room.hand.currentPlayerId = null;
      room.hand.phase = "completed";
      room.lastDealerId = room.hand.dealerId;
      room.phase = "completed";
      room.status = "paused";
    }
    return false;
  }

  const dealerId = nextId(participants, room.lastDealerId);
  const deck = createDeck();
  room.currentHandDbId = null;

  room.hand = {
    bigBlindId: null,
    communityCards: [],
    currentBet: 0,
    currentPlayerId: null,
    dealerId,
    deck,
    minRaise: 0,
    phase: "deal_3",
    players: {},
    showdownDescriptions: {},
    smallBlindId: null,
    startedAt: Date.now(),
    threeFiveSeven: {
      decisionHistoryByPlayerId: {},
      finalDecisionByPlayerId: {},
      phaseSequence: [],
      visibleDecisionsByPlayerId: {},
    },
  };
  room.handCount += 1;
  room.lastWinnerSummary = null;
  room.phase = "deal_3";
  room.status = "active";

  participants.forEach((participantId) => {
    room.hand.players[participantId] = {
      allIn: false,
      betThisRound: 0,
      cards: [],
      folded: false,
      handDescription: null,
      hasActed: false,
      payout: 0,
      startingStack: getPlayer(room, participantId).chips,
      totalContribution: 0,
    };
    room.hand.threeFiveSeven.decisionHistoryByPlayerId[participantId] = {
      3: null,
      5: null,
      7: null,
    };
    room.hand.threeFiveSeven.finalDecisionByPlayerId[participantId] = null;
    room.hand.threeFiveSeven.visibleDecisionsByPlayerId[participantId] = null;
    variantState.hiddenDecisionState.historyByPlayerId[participantId] = {
      3: null,
      5: null,
      7: null,
    };
  });

  const anteCollection = collect357AnteOnce(
    room,
    participants,
    `hand:${room.handCount}:deal:1`
  );

  set357Phase(room, "deal_3");
  addLog(
    room,
    `357 cycle #${room.handCount} started. Dealer button is on ${getPlayer(room, dealerId).name}.`
  );
  addLog(
    room,
    `${anteCollection.chargedPlayerIds.length} players anted ${variantState.anteAmount}.`
  );
  return true;
}

function resetActionFlags(room, actorId) {
  if (!room.hand) {
    return;
  }

  activeHandIds(room).forEach((playerId) => {
    const handPlayer = getHandPlayer(room, playerId);
    if (!handPlayer || handPlayer.folded || handPlayer.allIn) {
      return;
    }

    handPlayer.hasActed = playerId === actorId;
  });
}

function isBettingRoundComplete(room) {
  if (!room.hand) {
    return true;
  }

  return contenderIds(room).every((playerId) => {
    const handPlayer = room.hand.players[playerId];
    return (
      handPlayer.allIn ||
      (handPlayer.hasActed &&
        handPlayer.betThisRound === room.hand.currentBet)
    );
  });
}

function buildSidePots(room) {
  if (!room.hand) {
    return [];
  }

  const contributions = activeHandIds(room).map((playerId) => ({
    amount: room.hand.players[playerId].totalContribution,
    playerId,
  }));
  const levels = [
    ...new Set(
      contributions.map((entry) => entry.amount).filter((amount) => amount > 0)
    ),
  ].sort((left, right) => left - right);
  const pots = [];
  let previousLevel = 0;

  levels.forEach((level) => {
    const participants = contributions
      .filter((entry) => entry.amount >= level)
      .map((entry) => entry.playerId);
    const eligible = participants.filter(
      (playerId) => !room.hand.players[playerId].folded
    );
    const amount = (level - previousLevel) * participants.length;

    if (amount > 0) {
      pots.push({ amount, eligible });
    }

    previousLevel = level;
  });

  return pots;
}

function revealNextStreet(room) {
  if (!room.hand) {
    return;
  }

  const drawCount = room.hand.phase === "preflop" ? 3 : 1;

  for (let index = 0; index < drawCount; index += 1) {
    room.hand.communityCards.push(room.hand.deck.pop());
  }

  if (room.hand.phase === "preflop") {
    room.hand.phase = "flop";
  } else if (room.hand.phase === "flop") {
    room.hand.phase = "turn";
  } else if (room.hand.phase === "turn") {
    room.hand.phase = "river";
  }

  room.hand.currentBet = 0;
  room.hand.minRaise = BIG_BLIND;
  activeHandIds(room).forEach((playerId) => {
    const handPlayer = getHandPlayer(room, playerId);
    handPlayer.betThisRound = 0;
    handPlayer.hasActed = false;
  });
  room.hand.currentPlayerId = findNextActionablePlayer(room, room.hand.dealerId);
}

function completeHand(room) {
  if (!room.hand) {
    return;
  }

  room.hand.finalPlayerSnapshot = buildPlayerRuntimeMap(room.players).map((player) => ({
    ...cloneValue(player),
  }));
  room.hand.currentPlayerId = null;
  room.hand.phase = "completed";
  room.lastDealerId = room.hand.dealerId;
  room.phase = "completed";
  room.status = room.players.length >= MIN_PLAYERS_TO_START ? "waiting" : "paused";
}

function reveal357Decisions(room) {
  const variantState = ensureThreeFiveSevenState(room);
  const roundSize = variantState.activeRound || 7;
  const revealedByPlayerId = {};

  activeHandIds(room).forEach((playerId) => {
    const decision =
      room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] ||
      room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] ||
      "STAY";
    revealedByPlayerId[playerId] = decision;
    room.hand.threeFiveSeven.visibleDecisionsByPlayerId[playerId] = decision;
  });

  variantState.hiddenDecisionState.revealedByPlayerId = revealedByPlayerId;
  variantState.showdownPlayerIds = Object.keys(revealedByPlayerId).filter(
    (playerId) => revealedByPlayerId[playerId] === "GO"
  );
  variantState.revealState = "revealed";
  addLog(
    room,
    `Reveal: ${roomOrderIds(room, (player) => Boolean(revealedByPlayerId[player.id]))
      .map((playerId) => `${getPlayer(room, playerId).name} ${revealedByPlayerId[playerId]}`)
      .join(", ")}.`
  );
}

function resolve357Cycle(room) {
  if (!room.hand) {
    return;
  }

  const variantState = ensureThreeFiveSevenState(room);
  const goPlayerIds = variantState.showdownPlayerIds.filter((playerId) =>
    Boolean(room.hand.players[playerId])
  );
  const payouts = {};
  const legDeltaByPlayerId = {};
  const legsByPlayerId = variantState.legsByPlayerId;
  const potBefore = variantState.pot;
  let potAwarded = 0;
  let potPenaltyTotal = 0;
  let winnerPenaltyTotal = 0;
  let winnerIds = [];
  let loserIds = [];
  let showdownDescriptions = {};

  activeHandIds(room).forEach((playerId) => {
    payouts[playerId] = 0;
    legDeltaByPlayerId[playerId] = 0;
  });

  if (goPlayerIds.length === 0) {
    room.lastWinnerSummary = "No GO players. Pot carries to the next reshuffle.";
  } else if (goPlayerIds.length === 1) {
    const winnerId = goPlayerIds[0];
    winnerIds = [winnerId];
    potAwarded = variantState.pot;
    payouts[winnerId] = potAwarded;
    getPlayer(room, winnerId).chips += potAwarded;
    room.hand.players[winnerId].payout = potAwarded;
    variantState.pot = 0;
    legsByPlayerId[winnerId] = (legsByPlayerId[winnerId] || 0) + 1;
    legDeltaByPlayerId[winnerId] = 1;
    room.lastWinnerSummary = `${getPlayer(room, winnerId).name} wins ${potAwarded} chips as the only GO and earns 1 leg.`;
  } else {
    const playerCardsById = {};
    goPlayerIds.forEach((playerId) => {
      playerCardsById[playerId] = [...room.hand.players[playerId].cards];
    });

    const { rankedHands, winnerIds: rankedWinnerIds } = rank357Hands(
      playerCardsById,
      variantState.mode,
      variantState.activeWildDefinition.wildRanks
    );
    winnerIds = rankedWinnerIds;
    rankedHands.forEach((entry) => {
      showdownDescriptions[entry.playerId] = entry.solved.descr;
      room.hand.players[entry.playerId].handDescription = entry.solved.descr;
    });
    loserIds = goPlayerIds.filter((playerId) => !winnerIds.includes(playerId));

    loserIds.forEach((playerId) => {
      winnerPenaltyTotal += withdraw357ForWinner(
        room,
        playerId,
        variantState.penaltyModel.unitToWinner
      );
      potPenaltyTotal += contribute357ToPot(
        room,
        playerId,
        variantState.penaltyModel.unitToPot
      );
      legsByPlayerId[playerId] = 0;
    });

    const orderedWinnerIds = roomOrderIds(room, (player) =>
      winnerIds.includes(player.id)
    );
    const splitAmount =
      orderedWinnerIds.length > 0
        ? Math.floor(winnerPenaltyTotal / orderedWinnerIds.length)
        : 0;
    let remainder =
      orderedWinnerIds.length > 0
        ? winnerPenaltyTotal % orderedWinnerIds.length
        : 0;

    orderedWinnerIds.forEach((playerId) => {
      const amount = splitAmount + (remainder > 0 ? 1 : 0);
      payouts[playerId] += amount;
      getPlayer(room, playerId).chips += amount;
      room.hand.players[playerId].payout = amount;
      if (remainder > 0) {
        remainder -= 1;
      }
    });

    room.hand.showdownDescriptions = showdownDescriptions;
    room.lastWinnerSummary =
      winnerIds.length > 1
        ? `${winnerIds.map((playerId) => getPlayer(room, playerId).name).join(" & ")} split ${winnerPenaltyTotal} chips.`
        : `${getPlayer(room, winnerIds[0]).name} wins ${winnerPenaltyTotal} chips (${showdownDescriptions[winnerIds[0]]}).`;
  }

  addLog(room, room.lastWinnerSummary);
  variantState.revealState = "resolved";
  variantState.lastPhaseSequence = [...room.hand.threeFiveSeven.phaseSequence];
  variantState.lastResolution = {
    goPlayerIds,
    handNumber: room.handCount,
    legDeltaByPlayerId,
    loserIds,
    outcome:
      goPlayerIds.length === 0
        ? "no_go"
        : goPlayerIds.length === 1
          ? "solo_go"
          : winnerIds.length > 1
            ? "showdown_tie"
            : "showdown",
    payoutByPlayerId: payouts,
    potAfterResolution: variantState.pot,
    potAwarded,
    potBeforeResolution: potBefore,
    potPenaltyTotal,
    revealedDecisions: { ...variantState.hiddenDecisionState.revealedByPlayerId },
    showdownDescriptions,
    splitWinnerPayout: winnerIds.length > 1,
    winnerIds,
    winnerPenaltyTotal,
  };
}

function advance357Game(room) {
  if (!room.hand) {
    return;
  }

  while (room.hand && room.hand.phase !== "completed") {
    if (room.hand.phase === "deal_3") {
      deal357ToRound(room, 3);
      continue;
    }

    if (room.hand.phase === "deal_5") {
      deal357ToRound(room, 5);
      continue;
    }

    if (room.hand.phase === "deal_7") {
      deal357ToRound(room, 7);
      continue;
    }

    if (
      room.hand.phase === "decide_3" ||
      room.hand.phase === "decide_5" ||
      room.hand.phase === "decide_7"
    ) {
      const roundSize = Number(room.hand.phase.slice(-1));
      const nextPlayerId = findNext357DecisionPlayer(
        room,
        roundSize,
        room.hand.currentPlayerId
      );

      if (nextPlayerId) {
        room.hand.currentPlayerId = nextPlayerId;
        return;
      }

      room.hand.currentPlayerId = null;
      if (roundSize === 3) {
        set357Phase(room, "deal_5");
        continue;
      }

      if (roundSize === 5) {
        set357Phase(room, "deal_7");
        continue;
      }

      set357Phase(room, "reveal");
      continue;
    }

    if (room.hand.phase === "reveal") {
      reveal357Decisions(room);
      set357Phase(room, "resolve");
      continue;
    }

    if (room.hand.phase === "resolve") {
      resolve357Cycle(room);
      room.lastDealerId = room.hand.dealerId;
      set357Phase(room, "reshuffle");
      ensureThreeFiveSevenState(room).lastPhaseSequence = [
        ...room.hand.threeFiveSeven.phaseSequence,
      ];
      continue;
    }

    if (room.hand.phase === "reshuffle") {
      if (!start357Cycle(room)) {
        return;
      }
      continue;
    }

    return;
  }
}

function awardSingleWinner(room, winnerId) {
  const winner = getPlayer(room, winnerId);
  if (!room.hand || !winner) {
    return;
  }

  const amount = totalPot(room);
  winner.chips += amount;
  room.lastWinnerSummary = `${winner.name} wins ${amount} chips uncontested.`;
  addLog(room, room.lastWinnerSummary);
  completeHand(room);
}

function resolveShowdown(room) {
  if (!room.hand) {
    return;
  }

  while (room.hand.communityCards.length < 5) {
    room.hand.communityCards.push(room.hand.deck.pop());
  }

  const descriptions = {};
  const solvedHands = {};
  const payouts = {};

  contenderIds(room).forEach((playerId) => {
    const solved = Hand.solve([
      ...room.hand.players[playerId].cards,
      ...room.hand.communityCards,
    ]);
    solvedHands[playerId] = solved;
    descriptions[playerId] = solved.descr;
    payouts[playerId] = 0;
  });

  buildSidePots(room).forEach((pot) => {
    const winnerHands = Hand.winners(
      pot.eligible.map((playerId) => solvedHands[playerId])
    );
    const winnerIds = pot.eligible.filter((playerId) =>
      winnerHands.includes(solvedHands[playerId])
    );
    const orderedWinners = roomOrderIds(room, (player) =>
      winnerIds.includes(player.id)
    );
    const splitAmount = Math.floor(pot.amount / orderedWinners.length);
    let remainder = pot.amount % orderedWinners.length;

    orderedWinners.forEach((playerId) => {
      payouts[playerId] =
        (payouts[playerId] || 0) +
        splitAmount +
        (remainder > 0 ? 1 : 0);

      if (remainder > 0) {
        remainder -= 1;
      }
    });
  });

  const winnerSummary = roomOrderIds(room, (player) => Boolean(payouts[player.id]))
    .map((playerId) => {
      const player = getPlayer(room, playerId);
      player.chips += payouts[playerId];
      room.hand.players[playerId].payout = payouts[playerId];
      room.hand.players[playerId].handDescription = descriptions[playerId];
      return `${player.name} +${payouts[playerId]} (${descriptions[playerId]})`;
    })
    .join(", ");

  room.hand.showdownDescriptions = descriptions;
  room.lastWinnerSummary = winnerSummary || "Hand complete.";
  addLog(room, room.lastWinnerSummary);
  completeHand(room);
}

function advanceGame(room) {
  if (!room.hand) {
    return;
  }

  if (is357Game(room)) {
    advance357Game(room);
    return;
  }

  while (room.hand && room.hand.phase !== "completed") {
    const contenders = contenderIds(room);

    if (contenders.length === 1) {
      awardSingleWinner(room, contenders[0]);
      return;
    }

    if (!isBettingRoundComplete(room)) {
      room.hand.currentPlayerId = findNextActionablePlayer(
        room,
        room.hand.currentPlayerId
      );
      return;
    }

    if (room.hand.phase === "river") {
      resolveShowdown(room);
      return;
    }

    revealNextStreet(room);
  }
}

function buildPlayerStatusPayload(player) {
  return {
    playerStatus: player.playerStatus || "NO_STATUS",
    statusSnapshot: player.statusSnapshot || createDefaultStatusSnapshot(),
  };
}

function ensureGameSettings(room) {
  room.gameSettings = sync357GameSettings(room.gameSettings);
  room.gameSettings.locked = Boolean(
    room.gameSettings.locked || room.handCount > 0
  );
  return room.gameSettings;
}

function applyGameSettingsUpdate(room, update) {
  const gameSettings = ensureGameSettings(room);
  const candidate = update && typeof update === "object" ? update : {};
  const nextSettings = cloneGameSettings(gameSettings);

  if (typeof candidate.game === "string" && VALID_GAMES.has(candidate.game)) {
    nextSettings.game = candidate.game;
  }

  if (typeof candidate.mode === "string" && VALID_MODES.has(candidate.mode)) {
    nextSettings.mode = candidate.mode;
  }

  if (
    typeof candidate.lowRule === "string" &&
    VALID_LOW_RULES.has(candidate.lowRule)
  ) {
    nextSettings.lowRule = candidate.lowRule;
  }

  if (candidate.stips && typeof candidate.stips === "object") {
    if (typeof candidate.stips.bestFiveCards === "boolean") {
      nextSettings.stips.bestFiveCards = candidate.stips.bestFiveCards;
    }

    if (typeof candidate.stips.hostestWithTheMostest === "boolean") {
      nextSettings.stips.hostestWithTheMostest =
        candidate.stips.hostestWithTheMostest;
    }

    if (typeof candidate.stips.suitedBeatsUnsuited === "boolean") {
      nextSettings.stips.suitedBeatsUnsuited =
        candidate.stips.suitedBeatsUnsuited;
    }

    if (typeof candidate.stips.wildCards === "boolean") {
      nextSettings.stips.wildCards = candidate.stips.wildCards;
    }
  }

  const normalizedWildCards = normalizeWildCards(candidate.wildCards);
  if (normalizedWildCards) {
    nextSettings.wildCards = normalizedWildCards;
  }

  nextSettings.locked = Boolean(nextSettings.locked || room.handCount > 0);
  room.gameSettings = sync357GameSettings(nextSettings);
  room.gameSettings.locked = nextSettings.locked;
  return room.gameSettings;
}

class PokerRealtimeService {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.sessions = new Map();
  }

  extractToken(socket, payload = {}) {
    const authHeader = socket.handshake.headers?.authorization;
    const headerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;

    return (
      payload.token ||
      payload.authToken ||
      socket.handshake.auth?.token ||
      headerToken ||
      null
    );
  }

  async authenticateSocketUser(socket, payload = {}) {
    if (socket.data.userId) {
      const cachedUser = await User.findById(socket.data.userId);
      if (cachedUser && !cachedUser.isBlocked && cachedUser.status !== "blocked") {
        return cachedUser;
      }
    }

    const token = this.extractToken(socket, payload);

    if (!token) {
      throw new Error("Authentication token is required for realtime play.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "user") {
      throw new Error("Invalid player token.");
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new Error("User not found.");
    }

    if (user.isBlocked || user.status === "blocked") {
      throw new Error("Your account is blocked.");
    }

    socket.data.userId = user._id.toString();
    return user;
  }

  async generateUniqueTableCode() {
    for (let attempts = 0; attempts < 20; attempts += 1) {
      const candidate = buildTableCodeCandidate();
      const existingRoom = this.rooms.get(candidate);
      const existingTable = await GameTable.exists({ tableCode: candidate });

      if (!existingRoom && !existingTable) {
        return candidate;
      }
    }

    throw new Error("Unable to generate a unique table code.");
  }

  findOpenSeat(room, requestedSeat) {
    const occupiedSeats = new Set(room.players.map((player) => player.seatNumber));

    if (
      Number.isInteger(requestedSeat) &&
      requestedSeat >= 0 &&
      requestedSeat < room.maxPlayers &&
      !occupiedSeats.has(requestedSeat)
    ) {
      return requestedSeat;
    }

    for (let seat = 0; seat < room.maxPlayers; seat += 1) {
      if (!occupiedSeats.has(seat)) {
        return seat;
      }
    }

    return null;
  }

  getCurrentTurnSeat(room) {
    if (!room.hand?.currentPlayerId) {
      return null;
    }

    return getPlayer(room, room.hand.currentPlayerId)?.seatNumber ?? null;
  }

  serializeHand(room) {
    if (!room.hand) {
      return null;
    }

    return cloneValue(room.hand);
  }

  async createRoom(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);

    if (user.chips < DEFAULT_BUY_IN) {
      throw new Error(
        `At least ${DEFAULT_BUY_IN} chips are required to create a table.`
      );
    }

    const tableCode = await this.generateUniqueTableCode();
    const seatNumber = 0;

    user.chips -= DEFAULT_BUY_IN;
    user.isOnline = true;
    await user.save();

    const player = buildPlayerFromUser(
      user,
      seatNumber,
      socket.id,
      DEFAULT_BUY_IN
    );
    const room = {
      actionLog: [`${player.name} opened table ${tableCode}.`],
      buyInAmount: DEFAULT_BUY_IN,
      chatMessages: [],
      currentHandDbId: null,
      gameSettings: createDefaultGameSettings(),
      hand: null,
      handCount: 0,
      hostId: player.id,
      id: tableCode,
      lastDealerId: null,
      lastWinnerSummary: null,
      maxPlayers: MAX_PLAYERS,
      minPlayersToStart: MIN_PLAYERS_TO_START,
      players: [player],
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      status: "waiting",
      phase: "waiting",
      tableDbId: null,
      tableInvites: [],
      tableName: sanitizeTableName(payload.tableName, tableCode),
      threeFiveSeven: null,
    };
    applyGameSettingsUpdate(room, payload.gameSettings || payload.update || {});
    if (room.gameSettings.game === "357") {
      ensureThreeFiveSevenState(room);
    }

    const table = await GameTable.create({
      actionLog: room.actionLog,
      bigBlind: BIG_BLIND,
      buyInAmount: DEFAULT_BUY_IN,
      chatMessages: [],
      createdByUserId: user._id,
      currentPot: 0,
      currentTurnPlayerId: null,
      currentTurnSeat: null,
      gameSettings: room.gameSettings,
      gameType: room.gameSettings.game,
      handCount: 0,
      hostUserId: user._id,
      maxPlayers: MAX_PLAYERS,
      minPlayersToStart: MIN_PLAYERS_TO_START,
      phase: "waiting",
      players: [
        {
          avatar: player.avatar,
          chipsOnTable: player.chips,
          displayName: player.name,
          isAllIn: false,
          isConnected: true,
          isDealer: false,
          isFolded: false,
          pendingRemoval: false,
          playerStatus: player.playerStatus,
          referralCode: player.referralCode,
          seatNumber,
          statusIcon: player.statusIcon,
          userId: user._id,
        },
      ],
      smallBlind: SMALL_BLIND,
      status: "waiting",
      tableCode,
      tableName: room.tableName,
    });

    room.tableDbId = table._id.toString();
    this.rooms.set(room.id, room);
    this.sessions.set(socket.id, {
      playerId: player.id,
      roomId: room.id,
    });
    socket.join(room.id);

    await logTableEvent({
      createdById: user._id.toString(),
      createdByType: "player",
      eventType: "PLAYER_TABLE_CREATED",
      message: `${player.name} created realtime table ${room.id}`,
      payload: {
        roomId: room.id,
        tableName: room.tableName,
      },
      tableId: table._id,
    });

    await this.emitRoomState(room);
    return room;
  }

  async loadRoom(roomId) {
    const normalizedRoomId = String(roomId || "").trim().toUpperCase();
    if (!normalizedRoomId) {
      throw new Error("Table code is required.");
    }

    const cached = this.rooms.get(normalizedRoomId);
    if (cached) {
      return cached;
    }

    const table = await GameTable.findOne({ tableCode: normalizedRoomId });
    if (!table || table.status === "closed") {
      throw new Error("Table not found.");
    }

    const room = {
      actionLog: Array.isArray(table.actionLog) ? [...table.actionLog] : [],
      buyInAmount: table.buyInAmount || DEFAULT_BUY_IN,
      chatMessages: cloneValue(table.chatMessages || []),
      currentHandDbId: table.currentHandId ? table.currentHandId.toString() : null,
      gameSettings: cloneGameSettings(table.gameSettings),
      hand: cloneValue(table.currentHandSnapshot),
      handCount: table.handCount || 0,
      hostId: table.hostUserId ? table.hostUserId.toString() : null,
      id: table.tableCode,
      lastDealerId: table.lastDealerPlayerId || null,
      lastWinnerSummary: table.lastWinnerSummary || null,
      maxPlayers: table.maxPlayers || MAX_PLAYERS,
      minPlayersToStart: table.minPlayersToStart || MIN_PLAYERS_TO_START,
      players: (table.players || []).map((player) => ({
        avatar: player.avatar || "",
        chips: player.chipsOnTable,
        id: player.userId.toString(),
        isConnected: false,
        name: player.displayName,
        pendingRemoval: Boolean(player.pendingRemoval),
        playerStatus: player.playerStatus || "NO_STATUS",
        referralCode: player.referralCode || "",
        seatNumber: player.seatNumber,
        socketId: null,
        statusIcon: player.statusIcon || "badge-no-status",
        statusSnapshot: createDefaultStatusSnapshot(),
        userId: player.userId.toString(),
      })),
      smallBlind: table.smallBlind || SMALL_BLIND,
      bigBlind: table.bigBlind || BIG_BLIND,
      status: table.status || "waiting",
      phase: table.phase || "waiting",
      tableDbId: table._id.toString(),
      tableInvites: cloneValue(table.tableInvites || []),
      tableName: table.tableName,
      threeFiveSeven: cloneValue(table.variantStateSnapshot || null),
    };

    if (room.gameSettings.game === "357") {
      ensureThreeFiveSevenState(room);
    }

    this.rooms.set(room.id, room);
    return room;
  }

  async joinRoom(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);
    const room = await this.loadRoom(payload.tableId || payload.roomId);

    const existingPlayer = getPlayer(room, user._id.toString());
    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.isConnected = true;
      existingPlayer.pendingRemoval = false;
      existingPlayer.name = user.name;
      existingPlayer.avatar = user.avatar || "";
      existingPlayer.playerStatus = user.playerStatus?.tier || "NO_STATUS";
      existingPlayer.statusIcon = user.playerStatus?.iconKey || "badge-no-status";
      existingPlayer.referralCode = user.referralCode || "";

      this.sessions.set(socket.id, {
        playerId: existingPlayer.id,
        roomId: room.id,
      });
      socket.join(room.id);
      await this.persistRoom(room);
      await this.emitRoomState(room);
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Table is full.");
    }

    if (user.chips < room.buyInAmount) {
      throw new Error(
        `At least ${room.buyInAmount} chips are required to join this table.`
      );
    }

    const requestedSeat = Number.isInteger(payload.seatIndex)
      ? payload.seatIndex
      : Number.isFinite(Number(payload.seatIndex))
        ? Number(payload.seatIndex)
        : null;
    const seatNumber = this.findOpenSeat(room, requestedSeat);

    if (seatNumber == null) {
      throw new Error("No seats are available at this table.");
    }

    user.chips -= room.buyInAmount;
    user.isOnline = true;
    await user.save();

    const player = buildPlayerFromUser(user, seatNumber, socket.id, room.buyInAmount);
    room.players.push(player);
    if (is357Game(room)) {
      ensureThreeFiveSevenState(room);
    }
    addLog(room, `${player.name} joined the table.`);
    room.status = "waiting";
    room.phase = room.hand?.phase || "waiting";

    this.sessions.set(socket.id, {
      playerId: player.id,
      roomId: room.id,
    });
    socket.join(room.id);

    await this.persistRoom(room);
    await logTableEvent({
      createdById: user._id.toString(),
      createdByType: "player",
      eventType: "PLAYER_JOINED_TABLE",
      message: `${player.name} joined table ${room.id}`,
      payload: {
        roomId: room.id,
        seatNumber,
      },
      tableId: room.tableDbId,
    });
    await this.emitRoomState(room);
    return room;
  }

  async getSessionRoom(socket) {
    const session = this.sessions.get(socket.id);
    if (!session) {
      throw new Error("You are not seated at a table.");
    }

    const room = await this.loadRoom(session.roomId);
    return { room, session };
  }

  async removePendingPlayers(room) {
    if (room.hand && room.hand.phase !== "completed") {
      return;
    }

    const leavingPlayers = room.players.filter((player) => player.pendingRemoval);

    for (const player of leavingPlayers) {
      if (player.chips > 0) {
        await User.findByIdAndUpdate(player.userId, {
          $inc: { chips: player.chips },
        });
        player.chips = 0;
      }
    }

    room.players = room.players.filter((player) => !player.pendingRemoval);

    if (!getPlayer(room, room.hostId)) {
      room.hostId = buildPlayerRuntimeMap(room.players)[0]?.id || null;
    }

    if (room.players.length === 0) {
      room.status = "closed";
      room.phase = "waiting";
      room.hand = null;
      room.lastWinnerSummary = room.lastWinnerSummary || "Table closed.";
    }
  }

  async cleanupRoomIfEmpty(room) {
    if (room.players.length > 0) {
      return;
    }

    await this.persistRoom(room);
    this.rooms.delete(room.id);
  }

  async startGame(socket) {
    const { room, session } = await this.getSessionRoom(socket);

    await this.removePendingPlayers(room);
    ensureGameSettings(room);

    if (room.hostId !== session.playerId) {
      throw new Error("Only the host can start the next hand.");
    }

    if (room.hand && room.hand.phase !== "completed") {
      throw new Error("A hand is already in progress.");
    }

    if (room.gameSettings.game === "357") {
      const participants = eligible357ParticipantIds(room);
      if (participants.length < room.minPlayersToStart) {
        throw new Error(
          `At least two connected players with ${THREE_FIVE_SEVEN_TABLE.anteClips} chip(s) are required.`
        );
      }

      room.gameSettings.locked = true;
      ensureThreeFiveSevenState(room);
      if (!start357Cycle(room)) {
        throw new Error("Unable to start a 357 cycle.");
      }
      advanceGame(room);
      await this.persistRoom(room);
      await logTableEvent({
        createdById: session.playerId,
        createdByType: "player",
        eventType: "HAND_STARTED",
        message: `357 cycle ${room.handCount} started on table ${room.id}`,
        payload: {
          game: "357",
          handNumber: room.handCount,
          roomId: room.id,
        },
        tableId: room.tableDbId,
      });
      await logTableEvent({
        createdById: "system",
        createdByType: "system",
        eventType: "CARDS_DEALT",
        message: `357 round ${room.threeFiveSeven?.activeRound || 3} cards dealt on table ${room.id}`,
        payload: {
          activeRound: room.threeFiveSeven?.activeRound || 3,
          game: "357",
          handNumber: room.handCount,
          roomId: room.id,
        },
        tableId: room.tableDbId,
      });
      await this.emitRoomState(room);
      return;
    }

    const participants = roomOrderIds(
      room,
      (player) => player.isConnected && !player.pendingRemoval && player.chips > 0
    );

    if (participants.length < room.minPlayersToStart) {
      throw new Error("At least two connected players with chips are required.");
    }

    const dealerId = nextId(participants, room.lastDealerId);
    const smallBlindId =
      participants.length === 2 ? dealerId : nextId(participants, dealerId);
    const bigBlindId = nextId(participants, smallBlindId);
    const firstToAct =
      participants.length === 2 ? dealerId : nextId(participants, bigBlindId);
    const deck = createDeck();

    room.hand = {
      bigBlindId,
      communityCards: [],
      currentBet: 0,
      currentPlayerId: firstToAct,
      dealerId,
      deck,
      minRaise: room.bigBlind,
      phase: "preflop",
      players: {},
      showdownDescriptions: {},
      smallBlindId,
      startedAt: Date.now(),
    };
    room.handCount += 1;
    room.gameSettings.locked = true;
    room.lastWinnerSummary = null;
    room.phase = "preflop";
    room.status = "active";

    participants.forEach((participantId) => {
      const roomPlayer = getPlayer(room, participantId);
      room.hand.players[participantId] = {
        allIn: false,
        betThisRound: 0,
        cards: [deck.pop(), deck.pop()],
        folded: false,
        handDescription: null,
        hasActed: false,
        payout: 0,
        startingStack: roomPlayer.chips,
        totalContribution: 0,
      };
    });

    const smallBlindAmount = commitChips(room, smallBlindId, room.smallBlind);
    const bigBlindAmount = commitChips(room, bigBlindId, room.bigBlind);
    room.hand.currentBet = Math.max(smallBlindAmount, bigBlindAmount);

    addLog(
      room,
      `Hand #${room.handCount} started. Dealer button is on ${getPlayer(room, dealerId).name}.`
    );
    addLog(
      room,
      `${getPlayer(room, smallBlindId).name} posted the small blind (${smallBlindAmount}).`
    );
    addLog(
      room,
      `${getPlayer(room, bigBlindId).name} posted the big blind (${bigBlindAmount}).`
    );

    advanceGame(room);
    await this.persistRoom(room);
    await logTableEvent({
      createdById: session.playerId,
      createdByType: "player",
      eventType: "HAND_STARTED",
      message: `Hand ${room.handCount} started on table ${room.id}`,
      payload: {
        handNumber: room.handCount,
        roomId: room.id,
      },
      tableId: room.tableDbId,
    });
    await this.emitRoomState(room);
  }

  async performAction(socket, actionType, rawAmount) {
    const { room, session } = await this.getSessionRoom(socket);

    if (!room.hand || room.hand.phase === "completed") {
      throw new Error("No active hand to act in.");
    }

    if (is357Game(room)) {
      const roundSize = get357DecisionRound(room);
      if (!roundSize) {
        throw new Error("357 is not waiting on a decision.");
      }

      if (!room.hand.players[session.playerId]) {
        throw new Error("Player is not active in this 357 cycle.");
      }

      const decision = normalize357Action(actionType);
      if (!decision) {
        throw new Error("Only GO, STAY, and FOLD intents are available in 357.");
      }

      const lockedDecision =
        room.hand.threeFiveSeven.decisionHistoryByPlayerId[session.playerId]?.[
          roundSize
        ] || null;
      const nextDecision = decision === "FOLD" ? "STAY" : decision;

      if (lockedDecision != null) {
        if (lockedDecision === nextDecision) {
          advanceGame(room);
          await this.persistRoom(room);
          await this.emitRoomState(room);
          return;
        }

        throw new Error("357 action is already locked for this round.");
      }

      room.hand.threeFiveSeven.decisionHistoryByPlayerId[session.playerId][
        roundSize
      ] = nextDecision;
      room.hand.threeFiveSeven.finalDecisionByPlayerId[session.playerId] =
        nextDecision;
      ensureThreeFiveSevenState(room).hiddenDecisionState.historyByPlayerId[
        session.playerId
      ][roundSize] = nextDecision;
      room.hand.currentPlayerId = findNext357DecisionPlayer(
        room,
        roundSize,
        session.playerId
      );

      const player = getPlayer(room, session.playerId);
      const message = `${player.name} locked a 357 decision for round ${roundSize}.`;
      const previousResolutionKey = room.threeFiveSeven?.lastResolution
        ? `${room.threeFiveSeven.lastResolution.handNumber}:${room.threeFiveSeven.lastResolution.outcome}`
        : null;
      addLog(room, message);
      advanceGame(room);
      const nextResolution = room.threeFiveSeven?.lastResolution || null;
      const nextResolutionKey = nextResolution
        ? `${nextResolution.handNumber}:${nextResolution.outcome}`
        : null;

      await this.persistRoom(room);
      await logTableEvent({
        createdById: session.playerId,
        createdByType: "player",
        eventType: "PLAYER_ACTION",
        message,
        payload: {
          actionType: nextDecision,
          game: "357",
          roomId: room.id,
          roundSize,
        },
        tableId: room.tableDbId,
      });
      if (nextResolution && nextResolutionKey !== previousResolutionKey) {
        await logTableEvent({
          createdById: session.playerId,
          createdByType: "player",
          eventType: "WINNER_DECLARED",
          message: room.lastWinnerSummary || "357 round resolved.",
          payload: {
            game: "357",
            result: nextResolution,
            roomId: room.id,
          },
          tableId: room.tableDbId,
        });

        if (room.handCount > nextResolution.handNumber) {
          await logTableEvent({
            createdById: "system",
            createdByType: "system",
            eventType: "ROUND_RESET",
            message: `357 table ${room.id} moved to cycle ${room.handCount}.`,
            payload: {
              game: "357",
              handNumber: room.handCount,
              previousHandNumber: nextResolution.handNumber,
              roomId: room.id,
            },
            tableId: room.tableDbId,
          });
        }
      }
      await this.emitRoomState(room);
      await this.cleanupRoomIfEmpty(room);
      return;
    }

    if (room.hand.currentPlayerId !== session.playerId) {
      throw new Error("It is not your turn.");
    }

    const roomPlayer = getPlayer(room, session.playerId);
    const handPlayer = getHandPlayer(room, session.playerId);
    const toCall = Math.max(0, room.hand.currentBet - handPlayer.betThisRound);
    const maxTotal = handPlayer.betThisRound + roomPlayer.chips;
    const numericAmount = Number(rawAmount);
    const amount = Number.isFinite(numericAmount) ? Math.floor(numericAmount) : 0;
    let message = "";

    if (actionType === "fold") {
      handPlayer.folded = true;
      handPlayer.hasActed = true;
      message = `${roomPlayer.name} folded.`;
    } else if (actionType === "check") {
      if (toCall > 0) {
        throw new Error("Cannot check when facing a bet.");
      }
      handPlayer.hasActed = true;
      message = `${roomPlayer.name} checked.`;
    } else if (actionType === "call") {
      if (toCall === 0) {
        throw new Error("Nothing to call.");
      }

      const committed = commitChips(room, session.playerId, toCall);
      handPlayer.hasActed = true;
      message =
        committed < toCall
          ? `${roomPlayer.name} called all-in for ${committed}.`
          : `${roomPlayer.name} called ${committed}.`;
    } else if (actionType === "bet") {
      if (room.hand.currentBet > 0) {
        throw new Error("Use raise once betting has started.");
      }

      const target = Math.min(amount, maxTotal);
      if (target <= handPlayer.betThisRound) {
        throw new Error("Bet amount must increase your wager.");
      }

      if (target < Math.min(room.bigBlind, maxTotal) && target !== maxTotal) {
        throw new Error(`Bet must be at least ${room.bigBlind}.`);
      }

      commitChips(room, session.playerId, target - handPlayer.betThisRound);
      room.hand.currentBet = handPlayer.betThisRound;
      room.hand.minRaise = Math.max(room.bigBlind, handPlayer.betThisRound);
      resetActionFlags(room, session.playerId);
      message = `${roomPlayer.name} bet ${handPlayer.betThisRound}.`;
    } else if (actionType === "raise") {
      if (room.hand.currentBet === 0) {
        throw new Error("Use bet to open the action.");
      }

      const target = Math.min(amount, maxTotal);
      const raiseSize = target - room.hand.currentBet;

      if (target <= room.hand.currentBet) {
        throw new Error("Raise must beat the current bet.");
      }

      if (raiseSize < room.hand.minRaise && target !== maxTotal) {
        throw new Error(
          `Minimum raise is to ${room.hand.currentBet + room.hand.minRaise}.`
        );
      }

      commitChips(room, session.playerId, target - handPlayer.betThisRound);
      room.hand.currentBet = handPlayer.betThisRound;
      if (raiseSize >= room.hand.minRaise) {
        room.hand.minRaise = raiseSize;
      }
      resetActionFlags(room, session.playerId);
      message = `${roomPlayer.name} raised to ${handPlayer.betThisRound}.`;
    } else if (actionType === "all-in") {
      if (maxTotal <= handPlayer.betThisRound) {
        throw new Error("You have no chips left.");
      }

      commitChips(room, session.playerId, roomPlayer.chips);
      if (handPlayer.betThisRound > room.hand.currentBet) {
        const raiseSize = handPlayer.betThisRound - room.hand.currentBet;
        room.hand.currentBet = handPlayer.betThisRound;
        if (raiseSize >= room.hand.minRaise) {
          room.hand.minRaise = raiseSize;
        }
        resetActionFlags(room, session.playerId);
      }

      handPlayer.hasActed = true;
      message = `${roomPlayer.name} moved all-in for ${handPlayer.betThisRound}.`;
    } else {
      throw new Error("Unknown action.");
    }

    addLog(room, message);
    advanceGame(room);
    if (room.hand?.phase === "completed") {
      await this.persistRoom(room);
      await this.removePendingPlayers(room);
    }

    await this.persistRoom(room);
    await logTableEvent({
      createdById: session.playerId,
      createdByType: "player",
      eventType: "PLAYER_ACTION",
      message,
      payload: {
        actionType,
        amount: Number.isFinite(amount) ? amount : null,
        roomId: room.id,
      },
      tableId: room.tableDbId,
    });
    await this.emitRoomState(room);
    await this.cleanupRoomIfEmpty(room);
  }

  async rebuy(socket) {
    const { room, session } = await this.getSessionRoom(socket);
    const player = getPlayer(room, session.playerId);

    if (!player) {
      throw new Error("Player not found.");
    }

    if (player.chips > 0) {
      throw new Error("Rebuy is only available when you are out of chips.");
    }

    if (room.hand && room.hand.phase !== "completed") {
      throw new Error("Rebuy is only available between hands.");
    }

    const user = await User.findById(player.userId);
    if (!user) {
      throw new Error("Player account not found.");
    }

    if (user.chips < room.buyInAmount) {
      throw new Error(`At least ${room.buyInAmount} chips are required to rebuy.`);
    }

    user.chips -= room.buyInAmount;
    await user.save();
    player.chips += room.buyInAmount;

    addLog(room, `${player.name} re-bought for ${room.buyInAmount} chips.`);
    await this.persistRoom(room);
    await this.emitRoomState(room);
  }

  async leaveRoom(socket, { silent = false } = {}) {
    const session = this.sessions.get(socket.id);
    if (!session) {
      if (!silent) {
        socket.emit("table:left");
        socket.emit("room:left");
      }
      return;
    }

    const room = await this.loadRoom(session.roomId).catch(() => null);
    this.sessions.delete(socket.id);
    socket.leave(session.roomId);

    if (!room) {
      if (!silent) {
        socket.emit("table:left");
        socket.emit("room:left");
      }
      return;
    }

    const player = getPlayer(room, session.playerId);
    if (!player) {
      if (!silent) {
        socket.emit("table:left");
        socket.emit("room:left");
      }
      return;
    }

    player.isConnected = false;
    player.pendingRemoval = true;
    player.socketId = null;

    if (room.hand && room.hand.phase !== "completed" && room.hand.players[player.id]) {
      if (is357Game(room)) {
        const roundSize = Number(room.hand.phase.slice(-1));
        if (
          Number.isInteger(roundSize) &&
          THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize)
        ) {
          const lockedDecision =
            room.hand.threeFiveSeven.decisionHistoryByPlayerId[player.id]?.[
              roundSize
            ] || null;
          if (lockedDecision == null) {
            room.hand.threeFiveSeven.decisionHistoryByPlayerId[player.id][
              roundSize
            ] = "STAY";
            room.hand.threeFiveSeven.finalDecisionByPlayerId[player.id] = "STAY";
            ensureThreeFiveSevenState(room).hiddenDecisionState.historyByPlayerId[
              player.id
            ][roundSize] = "STAY";
          }
        }
        addLog(
          room,
          `${player.name} left the table and unresolved 357 decisions are treated as STAY.`
        );
      } else {
        const handPlayer = room.hand.players[player.id];
        if (!handPlayer.folded && !handPlayer.allIn) {
          handPlayer.folded = true;
          handPlayer.hasActed = true;
          addLog(room, `${player.name} left the table and folded.`);
        }
      }
      advanceGame(room);
    }

    if (room.hand?.phase === "completed") {
      await this.persistRoom(room);
    }

    if (!room.hand || room.hand.phase === "completed") {
      await this.removePendingPlayers(room);
    }

    if (!getPlayer(room, room.hostId)) {
      room.hostId = buildPlayerRuntimeMap(room.players)[0]?.id || null;
    }

    await this.persistRoom(room);
    await logTableEvent({
      createdById: player.id,
      createdByType: "player",
      eventType: "PLAYER_LEFT_TABLE",
      message: `${player.name} left table ${room.id}`,
      payload: {
        roomId: room.id,
      },
      tableId: room.tableDbId,
    });

    if (!silent) {
      socket.emit("table:left");
      socket.emit("room:left");
    }
    await this.emitRoomState(room);
    await this.cleanupRoomIfEmpty(room);
  }

  async updateGameSettings(socket, payload = {}) {
    const { room, session } = await this.getSessionRoom(socket);
    ensureGameSettings(room);

    if (room.hostId !== session.playerId) {
      throw new Error("Only the host can update game settings.");
    }

    if (room.gameSettings.locked || room.handCount > 0) {
      room.gameSettings.locked = true;
      throw new Error("Game settings are locked once play has started.");
    }

    applyGameSettingsUpdate(room, payload.gameSettings || payload.update || payload);
    await this.persistRoom(room);

    const requestingSocket = this.io.sockets.sockets.get(socket.id);
    if (requestingSocket) {
      requestingSocket.emit("game:settings:updated", {
        gameSettings: cloneGameSettings(room.gameSettings),
        roomId: room.id,
        roomState: this.buildRoomState(room, session.playerId),
        tableId: room.id,
        updatedBy: session.playerId,
      });
    }

    await this.emitRoomState(room);
  }

  async sitAtSeat(socket, payload = {}) {
    const { room, session } = await this.getSessionRoom(socket);
    const player = getPlayer(room, session.playerId);

    if (!player) {
      throw new Error("Player not found.");
    }

    if (room.hand && room.hand.phase !== "completed") {
      throw new Error("You cannot change seats during an active hand.");
    }

    const seatIndex = Number(payload.seatIndex);
    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= room.maxPlayers) {
      throw new Error("A valid seat index is required.");
    }

    const isOccupied = room.players.some(
      (candidate) => candidate.id !== player.id && candidate.seatNumber === seatIndex
    );

    if (isOccupied) {
      throw new Error("That seat is already occupied.");
    }

    player.seatNumber = seatIndex;
    await this.persistRoom(room);
    await this.emitRoomState(room);
  }

  async sendTableChatMessage(socket, payload = {}) {
    const { room, session } = await this.getSessionRoom(socket);
    const player = getPlayer(room, session.playerId);
    const text = normalizeTableChatText(payload.message || payload.text);

    if (!text) {
      throw new Error("Chat message cannot be empty.");
    }

    const chatMessage = {
      createdAt: Date.now(),
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      moderation: {
        flags: [],
        reason: null,
        reviewedAt: null,
        status: "accepted",
      },
      playerId: player.id,
      playerName: player.name,
      text,
      tone: "player",
    };

    room.chatMessages = [chatMessage, ...(room.chatMessages || [])].slice(0, 100);
    await this.persistRoom(room);
    this.io.to(room.id).emit("table:chat:message", {
      chatMessage,
      roomId: room.id,
      tableId: room.id,
    });
    this.io.to(room.id).emit("room:chat_message", {
      chatMessage,
      roomId: room.id,
    });
    await this.emitRoomState(room);
  }

  async sendTableInvite(socket, payload = {}) {
    const { room, session } = await this.getSessionRoom(socket);
    const player = getPlayer(room, session.playerId);
    const message = normalizeInviteMessage(payload.message);
    const source =
      payload.source === "share-link" ||
      payload.source === "friend-list" ||
      payload.source === "seat-pass"
        ? payload.source
        : null;

    if (!source) {
      throw new Error("A valid invite source is required.");
    }

    if (
      typeof payload.recipientAccountId !== "string" ||
      payload.recipientAccountId.trim().length === 0
    ) {
      throw new Error("recipientAccountId is required.");
    }

    const invite = {
      createdAt: Date.now(),
      giftBuyInChips: 0,
      giftBuyInClips: 0,
      id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      recipientAccountId: payload.recipientAccountId.trim(),
      recipientHandle: payload.recipientHandle || payload.recipientAccountId.trim(),
      recipientLabel: payload.recipientLabel || payload.recipientAccountId.trim(),
      senderPlayerId: player.id,
      senderPlayerName: player.name,
      source,
      status: "pending",
    };

    room.tableInvites = [invite, ...(room.tableInvites || [])].slice(0, 50);

    await User.findByIdAndUpdate(player.userId, {
      $inc: { "referralStats.invitesSent": 1 },
      $set: { "referralStats.lastInviteSentAt": new Date() },
    });

    addLog(room, `${player.name} sent a ${source} invite.`);
    await this.persistRoom(room);
    await this.emitRoomState(room);
  }

  async resumeSession(socket, payload = {}) {
    const user = await this.authenticateSocketUser(socket, payload);
    const room = await this.loadRoom(payload.tableId || payload.roomId);
    const player = getPlayer(room, user._id.toString());

    if (!player) {
      socket.emit("session:resume_failed", {
        message: "Your previous table session is no longer available.",
      });
      return;
    }

    player.socketId = socket.id;
    player.isConnected = true;
    player.pendingRemoval = false;
    this.sessions.set(socket.id, {
      playerId: player.id,
      roomId: room.id,
    });
    socket.join(room.id);
    await this.persistRoom(room);
    await this.emitRoomState(room);
  }

  buildControls(room, playerId) {
    const player = getPlayer(room, playerId);
    const handPlayer = getHandPlayer(room, playerId);
    const gameSettings = ensureGameSettings(room);
    const is357 = gameSettings.game === "357";

    if (!player) {
      return {
        availableActions: [],
        callAmount: 0,
        canAct: false,
        canRebuy: false,
        canStartHand: false,
        maxRaiseTo: 0,
        minRaiseTo: 0,
      };
    }

    const canStartHand =
      room.hostId === playerId &&
      (!room.hand || room.hand.phase === "completed") &&
      (is357
        ? eligible357ParticipantIds(room).length >= room.minPlayersToStart
        : roomOrderIds(
            room,
            (entry) => entry.isConnected && !entry.pendingRemoval && entry.chips > 0
          ).length >= room.minPlayersToStart);
    const canRebuy =
      player.chips <= 0 && (is357 || !room.hand || room.hand.phase === "completed");

    if (
      !room.hand ||
      room.hand.phase === "completed" ||
      !handPlayer ||
      handPlayer.folded ||
      handPlayer.allIn
    ) {
      return {
        availableActions: [],
        callAmount: 0,
        canAct: false,
        canRebuy,
        canStartHand,
        maxRaiseTo: 0,
        minRaiseTo: 0,
      };
    }

    if (is357) {
      const roundSize = get357DecisionRound(room);
      const decisionLocked = roundSize
        ? room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[
            roundSize
          ] != null
        : true;

      return {
        availableActions: !decisionLocked ? ["go", "stay", "fold"] : [],
        callAmount: 0,
        canAct: !decisionLocked,
        canRebuy,
        canStartHand,
        maxRaiseTo: 0,
        minRaiseTo: 0,
      };
    }

    if (room.hand.currentPlayerId !== playerId) {
      return {
        availableActions: [],
        callAmount: 0,
        canAct: false,
        canRebuy,
        canStartHand,
        maxRaiseTo: 0,
        minRaiseTo: 0,
      };
    }

    const toCall = Math.max(0, room.hand.currentBet - handPlayer.betThisRound);
    const maxRaiseTo = handPlayer.betThisRound + player.chips;
    const minRaiseTo =
      room.hand.currentBet === 0
        ? Math.min(maxRaiseTo, room.bigBlind)
        : Math.min(maxRaiseTo, room.hand.currentBet + room.hand.minRaise);
    const availableActions = ["fold"];

    if (toCall === 0) {
      availableActions.push("check");
    } else {
      availableActions.push("call");
    }

    if (player.chips > 0 && maxRaiseTo > room.hand.currentBet) {
      availableActions.push(room.hand.currentBet === 0 ? "bet" : "raise");
      availableActions.push("all-in");
    }

    return {
      availableActions,
      callAmount: toCall,
      canAct: true,
      canRebuy,
      canStartHand,
      maxRaiseTo,
      minRaiseTo,
    };
  }

  buildRoomState(room, playerId) {
    const hand = room.hand;
    const controls = this.buildControls(room, playerId);
    const gameSettings = ensureGameSettings(room);
    const is357 = gameSettings.game === "357";
    const variantState = is357 ? ensureThreeFiveSevenState(room) : null;
    const sortedPlayers = buildPlayerRuntimeMap(room.players);
    const players = sortedPlayers.map((player) => {
      const handPlayer = hand?.players?.[player.id];
      const revealedDecision = is357
        ? variantState.hiddenDecisionState.revealedByPlayerId[player.id] || null
        : null;
      const revealCards = Boolean(
        handPlayer &&
          (is357
            ? player.id === playerId ||
              (variantState.revealState !== "hidden" && revealedDecision === "GO")
            : player.id === playerId ||
              ((hand?.phase === "completed" || hand?.phase === "showdown") &&
                !handPlayer.folded))
      );
      const statusPayload = buildPlayerStatusPayload(player);

      return {
        betThisRound: handPlayer?.betThisRound ?? 0,
        chips: player.chips,
        handDescription:
          hand?.showdownDescriptions?.[player.id] ||
          handPlayer?.handDescription ||
          null,
        hasFolded: is357 ? false : handPlayer?.folded ?? false,
        holeCards: revealCards ? handPlayer.cards : [],
        id: player.id,
        isAllIn: handPlayer?.allIn ?? false,
        isBigBlind: hand?.bigBlindId === player.id,
        isConnected: player.isConnected,
        isDealer: hand?.dealerId === player.id,
        isHost: room.hostId === player.id,
        legs: variantState?.legsByPlayerId[player.id] ?? 0,
        isSmallBlind: hand?.smallBlindId === player.id,
        isTurn: hand?.currentPlayerId === player.id,
        name: player.name,
        netChipBalance: 0,
        playerStatus: statusPayload.playerStatus,
        revealedDecision,
        statusSnapshot: statusPayload.statusSnapshot,
        statusMomentum: 0,
        statusScore: 0,
        statusTier: player.playerStatus || "none",
        statusUpdatedAt: null,
        totalContribution: handPlayer?.totalContribution ?? 0,
      };
    });

    const phase = hand?.phase || "waiting";
    const actingPlayer = hand?.currentPlayerId
      ? getPlayer(room, hand.currentPlayerId)
      : null;
    const statusMessage = is357
      ? phase === "completed"
        ? room.lastWinnerSummary || "357 is waiting for the next cycle."
        : phase === "resolve" || phase === "reshuffle"
          ? room.lastWinnerSummary || "Resolving 357."
          : phase === "reveal"
            ? "Revealing GO and STAY."
            : phase.startsWith("decide_")
              ? hand?.currentPlayerId === playerId
                ? `Round ${variantState.activeRound}: choose GO or STAY.`
                : `Round ${variantState.activeRound}: waiting for players...`
              : "Dealing 357 cards."
      : phase === "completed"
        ? room.lastWinnerSummary || "Hand complete."
        : actingPlayer
          ? `${actingPlayer.name} to act.`
          : "Waiting for the next hand.";

    return {
      actionLog: room.actionLog,
      bigBlind: is357 ? 0 : room.bigBlind,
      chatMessages: room.chatMessages || [],
      communityCards: hand?.communityCards || [],
      controls,
      currentBet: hand?.currentBet || 0,
      currentTurnPlayerId: hand?.currentPlayerId || null,
      economy: null,
      gameSettings: cloneGameSettings(gameSettings),
      handNumber: room.handCount,
      hostId: room.hostId,
      inviteRecipients: [],
      lastWinnerSummary: room.lastWinnerSummary,
      phase,
      players,
      pot: totalPot(room),
      roomId: room.id,
      selfId: playerId,
      smallBlind: is357 ? 0 : room.smallBlind,
      statusMessage,
      tableInvites: room.tableInvites || [],
      threeFiveSeven: is357
        ? {
            activeRound: variantState.activeRound,
            activeWildDefinition: { ...variantState.activeWildDefinition },
            anteAmount: variantState.anteAmount,
            hiddenDecisionState: {
              currentRound: variantState.hiddenDecisionState.currentRound,
              historyByPlayerId: Object.fromEntries(
                Object.entries(
                  variantState.hiddenDecisionState.historyByPlayerId
                ).map(([id, history]) => [id, { ...history }])
              ),
              revealedByPlayerId: {
                ...variantState.hiddenDecisionState.revealedByPlayerId,
              },
            },
            lastPhaseSequence: [...variantState.lastPhaseSequence],
            lastResolution: variantState.lastResolution
              ? {
                  ...variantState.lastResolution,
                  legDeltaByPlayerId: {
                    ...variantState.lastResolution.legDeltaByPlayerId,
                  },
                  payoutByPlayerId: {
                    ...variantState.lastResolution.payoutByPlayerId,
                  },
                  revealedDecisions: {
                    ...variantState.lastResolution.revealedDecisions,
                  },
                  showdownDescriptions: {
                    ...variantState.lastResolution.showdownDescriptions,
                  },
                }
              : null,
            legsByPlayerId: { ...variantState.legsByPlayerId },
            mode: variantState.mode,
            penaltyModel: { ...variantState.penaltyModel },
            pot: variantState.pot,
            revealState: variantState.revealState,
            showdownPlayerIds: [...variantState.showdownPlayerIds],
          }
        : null,
    };
  }

  async emitRoomState(room) {
    const sortedPlayers = buildPlayerRuntimeMap(room.players);

    sortedPlayers.forEach((player) => {
      if (!player.socketId) {
        return;
      }

      const socket = this.io.sockets.sockets.get(player.socketId);
      if (!socket) {
        return;
      }

      const roomState = this.buildRoomState(room, player.id);
      socket.emit("table:state", roomState);
      socket.emit("room:state", roomState);
    });
  }

  async persistRoom(room) {
    const currentTurnSeat = this.getCurrentTurnSeat(room);
    const tableId = room.tableDbId;

    const update = {
      actionLog: room.actionLog,
      bigBlind: room.bigBlind,
      buyInAmount: room.buyInAmount,
      chatMessages: cloneValue(room.chatMessages || []),
      currentHandSnapshot: this.serializeHand(room),
      currentPot: totalPot(room),
      currentTurnPlayerId: room.hand?.currentPlayerId || null,
      currentTurnSeat,
      gameSettings: cloneGameSettings(ensureGameSettings(room)),
      gameType: room.gameSettings.game || "holdem",
      handCount: room.handCount,
      hostUserId: room.hostId || null,
      lastDealerPlayerId: room.lastDealerId || null,
      lastWinnerSummary: room.lastWinnerSummary || null,
      maxPlayers: room.maxPlayers,
      minPlayersToStart: room.minPlayersToStart,
      phase: room.hand?.phase || room.phase || "waiting",
      players: buildPlayerRuntimeMap(room.players).map((player) => ({
        avatar: player.avatar || "",
        chipsOnTable: player.chips,
        displayName: player.name,
        isAllIn: room.hand?.players?.[player.id]?.allIn || false,
        isConnected: player.isConnected,
        isDealer: room.hand?.dealerId === player.id,
        isFolded: room.hand?.players?.[player.id]?.folded || false,
        pendingRemoval: player.pendingRemoval,
        playerStatus: player.playerStatus || "NO_STATUS",
        referralCode: player.referralCode || "",
        seatNumber: player.seatNumber,
        statusIcon: player.statusIcon || "badge-no-status",
        userId: player.userId,
      })),
      smallBlind: room.smallBlind,
      status: room.status,
      tableInvites: cloneValue(room.tableInvites || []),
      tableName: room.tableName,
      variantStateSnapshot:
        room.gameSettings?.game === "357"
          ? cloneValue(ensureThreeFiveSevenState(room))
          : null,
    };

    const table = await GameTable.findByIdAndUpdate(tableId, update, {
      new: true,
    });

    if (!table) {
      throw new Error("Realtime table could not be persisted.");
    }

    room.tableDbId = table._id.toString();
    await this.persistHandHistory(room, table);
  }

  async persistHandHistory(room, table) {
    if (!room.hand) {
      if (room.currentHandDbId) {
        await GameTable.findByIdAndUpdate(table._id, {
          currentHandId: null,
        });
        room.currentHandDbId = null;
      }
      return;
    }

    const playerSnapshotSource =
      room.hand.phase === "completed" && Array.isArray(room.hand.finalPlayerSnapshot)
        ? room.hand.finalPlayerSnapshot
        : room.players;
    const handPlayers = buildPlayerRuntimeMap(playerSnapshotSource)
      .filter((player) => Boolean(room.hand.players[player.id]))
      .map((player) => {
        const handPlayer = room.hand.players[player.id];
        const chipsAfter = player.chips;
        const chipsBefore = handPlayer.startingStack ?? chipsAfter;

        return {
          allIn: Boolean(handPlayer.allIn),
          chipsAfter,
          chipsBefore,
          chipsDelta: chipsAfter - chipsBefore,
          chipsWon: Math.max(0, handPlayer.payout || chipsAfter - chipsBefore),
          folded: Boolean(handPlayer.folded),
          handDescription:
            room.hand.showdownDescriptions?.[player.id] ||
            handPlayer.handDescription ||
            "",
          holeCards: [...handPlayer.cards],
          nameSnapshot: player.name,
          playerId: player.id,
          result:
            room.hand.phase === "completed"
              ? room.lastWinnerSummary || "completed"
              : "in_progress",
          seatIndex: player.seatNumber,
          totalContribution: handPlayer.totalContribution,
          userId: player.userId,
        };
      });

    const payload = {
      actionLog: room.actionLog,
      communityCards: [...(room.hand.communityCards || [])],
      completedAt: room.hand.phase === "completed" ? new Date() : null,
      gameSettingsSnapshot: cloneGameSettings(room.gameSettings),
      gameType: room.gameSettings.game || "holdem",
      handNumber: room.handCount,
      hostUserId: room.hostId || null,
      lastActionAt: new Date(),
      phase: room.hand.phase,
      players: handPlayers,
      startedAt: room.hand.startedAt ? new Date(room.hand.startedAt) : new Date(),
      stateSnapshot: this.serializeHand(room),
      status: room.hand.phase === "completed" ? "completed" : "in_progress",
      tableCode: room.id,
      tableId: table._id,
      tableName: room.tableName,
      totalPot: totalPot(room),
      winnerText: room.lastWinnerSummary || "",
    };

    if (room.currentHandDbId) {
      await HandHistory.findByIdAndUpdate(room.currentHandDbId, payload);
    } else {
      const createdHand = await HandHistory.create(payload);
      room.currentHandDbId = createdHand._id.toString();
      await GameTable.findByIdAndUpdate(table._id, {
        currentHandId: createdHand._id,
      });
    }
  }
}

function createPokerRealtimeService(io) {
  return new PokerRealtimeService(io);
}

module.exports = {
  createPokerRealtimeService,
  DEFAULT_BUY_IN,
  BIG_BLIND,
  SMALL_BLIND,
};
