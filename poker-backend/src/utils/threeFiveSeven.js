const {
  FiveOfAKind,
  FourOfAKind,
  FourOfAKindPairPlus,
  FullHouse,
  Hand,
  HighCard,
  OnePair,
  Straight,
  StraightFlush,
  ThreeOfAKind,
  ThreeOfAKindTwoPair,
  ThreePair,
  TwoPair,
  TwoThreeOfAKind,
  Flush,
} = require("pokersolver");

const THREE_FIVE_SEVEN_MODES = Object.freeze(["HOSTEST", "BEST_FIVE"]);
const THREE_CARD = "THREE_CARD";
const FIVE_CARD = "FIVE_CARD";
const SEVEN_CARD = "SEVEN_CARD";
const THREE_FIVE_SEVEN_STAGES = Object.freeze([THREE_CARD, FIVE_CARD, SEVEN_CARD]);
const THREE_FIVE_SEVEN_TABLE = Object.freeze({
  anteClips: 1,
  defaultMode: "HOSTEST",
  goLossPenaltyToPotClips: 2,
  goLossPenaltyToWinnerClips: 2,
  legsToWin: 4,
  modes: THREE_FIVE_SEVEN_MODES,
  rounds: Object.freeze([3, 5, 7]),
});

const BEST_FIVE_GAME = Object.freeze({
  cardsInHand: 5,
  descr: "357-best-five",
  handValues: [
    FiveOfAKind,
    StraightFlush,
    FourOfAKind,
    FullHouse,
    Flush,
    Straight,
    ThreeOfAKind,
    TwoPair,
    OnePair,
    HighCard,
  ],
  lowestQualified: null,
  noKickers: false,
  sfQualify: 5,
  wheelStatus: 0,
  wildStatus: 1,
  wildValue: "O",
});

const HOSTEST_GAME = Object.freeze({
  cardsInHand: 7,
  descr: "357-hostest",
  handValues: [
    FiveOfAKind,
    FourOfAKindPairPlus,
    StraightFlush,
    Flush,
    Straight,
    FourOfAKind,
    TwoThreeOfAKind,
    ThreeOfAKindTwoPair,
    FullHouse,
    ThreeOfAKind,
    ThreePair,
    TwoPair,
    OnePair,
    HighCard,
  ],
  lowestQualified: null,
  noKickers: false,
  sfQualify: 5,
  wheelStatus: 1,
  wildStatus: 1,
  wildValue: "O",
});

function is357Mode(value) {
  return value === "HOSTEST" || value === "BEST_FIVE";
}

function normalize357Mode(gameSettings = {}) {
  if (is357Mode(gameSettings.mode)) {
    return gameSettings.mode;
  }

  if (
    gameSettings.stips?.bestFiveCards &&
    !gameSettings.stips?.hostestWithTheMostest
  ) {
    return "BEST_FIVE";
  }

  return THREE_FIVE_SEVEN_TABLE.defaultMode;
}

function build357WildRanks(mode, roundSize) {
  if (!THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize)) {
    return [];
  }

  if (mode === "BEST_FIVE") {
    return [String(roundSize)];
  }

  if (roundSize === 3) {
    return ["3"];
  }

  if (roundSize === 5) {
    return ["3", "5"];
  }

  return ["3", "5", "7"];
}

function build357WildDefinition(mode, roundSize) {
  const wildRanks = build357WildRanks(mode, roundSize);

  return {
    cumulative: mode === "HOSTEST",
    label: wildRanks.length > 0 ? `${wildRanks.join(" + ")} wild` : "No wilds",
    mode,
    round: roundSize || null,
    wildRanks,
  };
}

function mapWildCards(cards, wildRanks) {
  const activeWilds = new Set(wildRanks);

  return cards.map((card) =>
    activeWilds.has(card?.[0]) ? `O${card?.[1] || "r"}` : card
  );
}

function get357SolverGame(mode) {
  return mode === "BEST_FIVE" ? BEST_FIVE_GAME : HOSTEST_GAME;
}

function expectedCardCountForStage(stage) {
  if (stage === THREE_CARD) {
    return 3;
  }
  if (stage === FIVE_CARD) {
    return 5;
  }
  if (stage === SEVEN_CARD) {
    return 7;
  }
  return null;
}

function evaluateThreeCardHand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), get357SolverGame(mode));
}

function evaluateFiveCardHand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), BEST_FIVE_GAME);
}

function evaluateSevenCardHand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), get357SolverGame(mode));
}

function build357EvaluationPayload(stage, cards, solved, wildRanks) {
  return {
    displayName: solved.descr,
    explanation: {
      cards,
      cardsUsed: solved.cards,
      stage,
      wildRanks: [...wildRanks],
    },
    normalizedKey: String(solved.name || solved.descr || "unknown")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_"),
    solved,
    tiebreakers: Array.isArray(solved.rank) ? solved.rank : [solved.rank],
  };
}

function evaluate357Hand(stage, cards, mode, wildRanks = []) {
  const expectedCardCount = expectedCardCountForStage(stage);
  if (!expectedCardCount) {
    throw new Error(`Unsupported 357 stage: ${stage}`);
  }
  if (!Array.isArray(cards) || cards.length !== expectedCardCount) {
    throw new Error(
      `Invalid 357 stage/card-count combination. Stage ${stage} requires ${expectedCardCount} cards, received ${Array.isArray(cards) ? cards.length : "non-array"}.`
    );
  }

  let solved;
  if (stage === THREE_CARD) {
    solved = evaluateThreeCardHand(cards, mode, wildRanks);
  } else if (stage === FIVE_CARD) {
    solved = evaluateFiveCardHand(cards, mode, wildRanks);
  } else {
    solved = evaluateSevenCardHand(cards, mode, wildRanks);
  }

  return build357EvaluationPayload(stage, cards, solved, wildRanks);
}

function rank357Hands(playerCardsById, mode, wildRanks) {
  const rankedHands = Object.entries(playerCardsById).map(([playerId, cards]) => ({
    evaluation: evaluate357Hand(
      cards.length === 3 ? THREE_CARD : cards.length === 5 ? FIVE_CARD : SEVEN_CARD,
      cards,
      mode,
      wildRanks
    ),
    playerId,
    solved: Hand.solve(mapWildCards(cards, wildRanks), get357SolverGame(mode)),
  }));
  const winnerHands = Hand.winners(rankedHands.map((entry) => entry.solved));

  return {
    rankedHands,
    winnerIds: rankedHands
      .filter((entry) => winnerHands.includes(entry.solved))
      .map((entry) => entry.playerId),
  };
}

module.exports = {
  THREE_CARD,
  FIVE_CARD,
  SEVEN_CARD,
  THREE_FIVE_SEVEN_STAGES,
  THREE_FIVE_SEVEN_TABLE,
  build357WildDefinition,
  evaluate357Hand,
  is357Mode,
  normalize357Mode,
  rank357Hands,
};
