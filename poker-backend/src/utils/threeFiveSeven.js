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
} = require('pokersolver');

const THREE_FIVE_SEVEN_MODES = Object.freeze(['HOSTEST', 'BEST_FIVE']);
const THREE_CARD = 'THREE_CARD';
const FIVE_CARD = 'FIVE_CARD';
const SEVEN_CARD = 'SEVEN_CARD';
const THREE_FIVE_SEVEN_STAGES = Object.freeze([THREE_CARD, FIVE_CARD, SEVEN_CARD]);
/**
 * Centralized 357 stage rule/taxonomy spec consumed by both:
 * 1) evaluator/comparator logic, and
 * 2) player-facing explanation text generation.
 *
 * Client handoff examples captured here to reduce interpretation drift:
 * - "3-card round: no straights, no flushes, wilds enabled"
 * - "5-card round: standard five-card taxonomy with wilds"
 * - "7-card HOSTEST: special six aces / seven-card straight flush interaction"
 * - "Comparator override: 7-card straight flush > six aces (but < seven aces)"
 */
const THREE_FIVE_SEVEN_STAGE_RULES = Object.freeze({
  [THREE_CARD]: Object.freeze({
    allowFiveOfAKind: false,
    allowFlushes: false,
    allowStraights: false,
    allowWilds: true,
    sevenCardHands: false,
    taxonomy: Object.freeze(['THREE_OF_A_KIND', 'ONE_PAIR', 'HIGH_CARD']),
  }),
  [FIVE_CARD]: Object.freeze({
    allowFiveOfAKind: true,
    allowFlushes: true,
    allowStraights: true,
    allowWilds: true,
    sevenCardHands: false,
    taxonomy: Object.freeze([
      'FIVE_OF_A_KIND',
      'STRAIGHT_FLUSH',
      'FOUR_OF_A_KIND',
      'FULL_HOUSE',
      'FLUSH',
      'STRAIGHT',
      'THREE_OF_A_KIND',
      'TWO_PAIR',
      'ONE_PAIR',
      'HIGH_CARD',
    ]),
  }),
  [SEVEN_CARD]: Object.freeze({
    allowFiveOfAKind: true,
    allowFlushes: true,
    allowStraights: true,
    allowWilds: true,
    sevenCardHands: true,
    taxonomy: Object.freeze([
      'SEVEN_ACES',
      'SEVEN_CARD_STRAIGHT_FLUSH',
      'SIX_ACES',
      'FIVE_OF_A_KIND',
      'FOUR_OF_A_KIND_PAIR_PLUS',
      'STRAIGHT_FLUSH',
      'FLUSH',
      'STRAIGHT',
      'FOUR_OF_A_KIND',
      'TWO_THREE_OF_A_KIND',
      'THREE_OF_A_KIND_TWO_PAIR',
      'FULL_HOUSE',
      'THREE_OF_A_KIND',
      'THREE_PAIR',
      'TWO_PAIR',
      'ONE_PAIR',
      'HIGH_CARD',
    ]),
    comparatorOverrides: Object.freeze([
      Object.freeze({
        higher: 'SEVEN_CARD_STRAIGHT_FLUSH',
        lower: 'SIX_ACES',
        reason: 'Client handoff override: 7-card straight flush outranks six aces.',
      }),
    ]),
  }),
});

const SEVEN_CARD_HAND_CLASSES = Object.freeze({
  SEVEN_ACES: 'SEVEN_ACES',
  SIX_ACES: 'SIX_ACES',
  SEVEN_CARD_STRAIGHT_FLUSH: 'SEVEN_CARD_STRAIGHT_FLUSH',
  OTHER: 'OTHER',
});

const SEVEN_CARD_HAND_CLASS_BASELINE = Object.freeze({
  [SEVEN_CARD_HAND_CLASSES.SEVEN_ACES]: 400,
  [SEVEN_CARD_HAND_CLASSES.SIX_ACES]: 300,
  [SEVEN_CARD_HAND_CLASSES.SEVEN_CARD_STRAIGHT_FLUSH]: 250,
  [SEVEN_CARD_HAND_CLASSES.OTHER]: 0,
});
const THREE_FIVE_SEVEN_PHASES = Object.freeze([
  'deal_3',
  'decide_3',
  'deal_5',
  'decide_5',
  'deal_7',
  'decide_7',
  'reveal',
  'resolve',
  'reshuffle',
]);
const THREE_FIVE_SEVEN_DECISIONS = Object.freeze(['GO', 'STAY', 'FOLD']);
const THREE_FIVE_SEVEN_ACTIONS = Object.freeze(['GO', 'STAY', 'FOLD']);
const TABLE_CONFIGS = Object.freeze({
  ONE_DOLLAR_357: Object.freeze({
    allowCall: false,
    allowRaise: false,
    allowTraditionalBetting: false,
    anteClips: 1,
    currencyUnit: 'clips',
    gameType: '357',
    goLossPenaltyToPotClips: 2,
    goLossPenaltyToWinnerClips: 2,
    simultaneousAction: true,
    tableStake: 1,
  }),
});
const ONE_DOLLAR_357_TABLE_CONFIG = TABLE_CONFIGS.ONE_DOLLAR_357;
const THREE_FIVE_SEVEN_TABLE = Object.freeze({
  allowCall: ONE_DOLLAR_357_TABLE_CONFIG.allowCall,
  allowRaise: ONE_DOLLAR_357_TABLE_CONFIG.allowRaise,
  allowTraditionalBetting: ONE_DOLLAR_357_TABLE_CONFIG.allowTraditionalBetting,
  ante: ONE_DOLLAR_357_TABLE_CONFIG.anteClips,
  anteClips: ONE_DOLLAR_357_TABLE_CONFIG.anteClips,
  currencyUnit: ONE_DOLLAR_357_TABLE_CONFIG.currencyUnit,
  defaultMode: 'HOSTEST',
  gameType: ONE_DOLLAR_357_TABLE_CONFIG.gameType,
  goLossPenaltyToPotClips: ONE_DOLLAR_357_TABLE_CONFIG.goLossPenaltyToPotClips,
  goLossPenaltyToWinnerClips: ONE_DOLLAR_357_TABLE_CONFIG.goLossPenaltyToWinnerClips,
  legsToWin: 4,
  modes: THREE_FIVE_SEVEN_MODES,
  rounds: Object.freeze([3, 5, 7]),
  simultaneousAction: ONE_DOLLAR_357_TABLE_CONFIG.simultaneousAction,
  tableStake: ONE_DOLLAR_357_TABLE_CONFIG.tableStake,
  unitToPot: ONE_DOLLAR_357_TABLE_CONFIG.goLossPenaltyToPotClips,
  unitToWinner: ONE_DOLLAR_357_TABLE_CONFIG.goLossPenaltyToWinnerClips,
});

const BEST_FIVE_GAME = Object.freeze({
  cardsInHand: 5,
  descr: '357-best-five',
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
  wildValue: 'O',
});

const HOSTEST_GAME = Object.freeze({
  cardsInHand: 7,
  descr: '357-hostest',
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
  wildValue: 'O',
});


const THREE_CARD_GAME = Object.freeze({
  cardsInHand: 3,
  descr: '357-three-card',
  handValues: [ThreeOfAKind, OnePair, HighCard],
  lowestQualified: null,
  noKickers: false,
  sfQualify: 5,
  straights: false,
  flushes: false,
  wildStatus: 1,
  wildValue: 'O',
});

function is357Mode(value) {
  return value === 'HOSTEST' || value === 'BEST_FIVE';
}

function normalize357Mode(gameSettings = {}) {
  if (is357Mode(gameSettings.mode)) {
    return gameSettings.mode;
  }

  if (
    gameSettings.stips?.bestFiveCards &&
    !gameSettings.stips?.hostestWithTheMostest
  ) {
    return 'BEST_FIVE';
  }

  return THREE_FIVE_SEVEN_TABLE.defaultMode;
}

function build357WildRanks(mode, roundSize) {
  if (!THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize)) {
    return [];
  }

  if (mode === 'BEST_FIVE') {
    if (roundSize === 3) {
      return ['3'];
    }

    if (roundSize === 5) {
      return ['5'];
    }

    return ['7'];
  }

  if (roundSize === 3) {
    return ['3'];
  }

  if (roundSize === 5) {
    return ['3', '5'];
  }

  return ['3', '5', '7'];
}

function build357WildDefinition(mode, roundSize) {
  const wildRanks = build357WildRanks(mode, roundSize);

  return {
    cumulative: mode === 'HOSTEST',
    label: wildRanks.length > 0 ? `${wildRanks.join(' + ')} wild` : 'No wilds',
    mode,
    round: roundSize ?? null,
    wildRanks,
  };
}

function mapWildCards(cards, wildRanks) {
  const activeWilds = new Set(wildRanks);

  return cards.map((card) =>
    activeWilds.has(card?.[0]) ? `O${card?.[1] ?? 'r'}` : card,
  );
}

function get357SolverGame(mode) {
  return mode === 'BEST_FIVE' ? BEST_FIVE_GAME : HOSTEST_GAME;
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
  return Hand.solve(mapWildCards(cards, wildRanks), THREE_CARD_GAME);
}

function evaluateFiveCardHand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), BEST_FIVE_GAME);
}

function evaluateSevenCardHand(cards, mode, wildRanks) {
  return solve357Hand(cards, mode, wildRanks);
}


function classifySevenCardHand(cards, solved, wildRanks) {
  const wildSet = new Set(wildRanks);
  const aceCount = cards.reduce((count, card) => {
    const rank = card?.[0];
    if (rank === 'A' || wildSet.has(rank)) {
      return count + 1;
    }
    return count;
  }, 0);

  if (aceCount >= 7) {
    return SEVEN_CARD_HAND_CLASSES.SEVEN_ACES;
  }
  if (aceCount >= 6) {
    return SEVEN_CARD_HAND_CLASSES.SIX_ACES;
  }

  const normalizedName = String(solved?.name || solved?.descr || '').toLowerCase();
  if (normalizedName.includes('straight flush') && Array.isArray(solved?.cards) && solved.cards.length === 7) {
    return SEVEN_CARD_HAND_CLASSES.SEVEN_CARD_STRAIGHT_FLUSH;
  }

  return SEVEN_CARD_HAND_CLASSES.OTHER;
}

function compare357Evaluations(leftEvaluation, rightEvaluation) {
  const leftSolved = leftEvaluation?.solved;
  const rightSolved = rightEvaluation?.solved;
  const leftClass = leftEvaluation?.sevenCardClass || SEVEN_CARD_HAND_CLASSES.OTHER;
  const rightClass = rightEvaluation?.sevenCardClass || SEVEN_CARD_HAND_CLASSES.OTHER;

  const overrides = THREE_FIVE_SEVEN_STAGE_RULES[SEVEN_CARD]?.comparatorOverrides ?? [];
  for (const override of overrides) {
    if (leftClass === override.higher && rightClass === override.lower) {
      return 1;
    }
    if (leftClass === override.lower && rightClass === override.higher) {
      return -1;
    }
  }

  const leftBaseline = SEVEN_CARD_HAND_CLASS_BASELINE[leftClass] ?? 0;
  const rightBaseline = SEVEN_CARD_HAND_CLASS_BASELINE[rightClass] ?? 0;
  if (leftBaseline !== rightBaseline) {
    return leftBaseline > rightBaseline ? 1 : -1;
  }

  const winners = Hand.winners([leftSolved, rightSolved]);
  const leftWins = winners.includes(leftSolved);
  const rightWins = winners.includes(rightSolved);
  if (leftWins && rightWins) {
    return 0;
  }
  return leftWins ? 1 : -1;
}

function build357EvaluationPayload(stage, cards, solved, wildRanks) {
  const sevenCardClass = stage === SEVEN_CARD ? classifySevenCardHand(cards, solved, wildRanks) : null;
  const stageRules = THREE_FIVE_SEVEN_STAGE_RULES[stage] ?? null;

  return {
    displayName: solved.descr,
    explanation: {
      cards,
      cardsUsed: solved.cards,
      comparatorOverrides: stageRules?.comparatorOverrides ?? [],
      handTaxonomy: stageRules?.taxonomy ?? [],
      ruleFlags: stageRules
        ? {
            allowFiveOfAKind: stageRules.allowFiveOfAKind,
            allowFlushes: stageRules.allowFlushes,
            allowStraights: stageRules.allowStraights,
            allowWilds: stageRules.allowWilds,
            sevenCardHands: stageRules.sevenCardHands,
          }
        : {},
      stage,
      wildRanks: [...wildRanks],
    },
    normalizedKey: String(solved.name || solved.descr || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
    sevenCardClass,
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
      `Invalid 357 stage/card-count combination. Stage ${stage} requires ${expectedCardCount} cards, received ${Array.isArray(cards) ? cards.length : 'non-array'}.`,
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

function solve357Hand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), get357SolverGame(mode));
}

function rank357Hands(playerCardsById, mode, wildRanks, stage = null) {
  const rankedHands = Object.entries(playerCardsById).map(([playerId, cards]) => ({
    evaluation: evaluate357Hand(
      stage ?? (cards.length === 3 ? THREE_CARD : cards.length === 5 ? FIVE_CARD : SEVEN_CARD),
      cards,
      mode,
      wildRanks,
    ),
    playerId,
    solved: solve357Hand(cards, mode, wildRanks),
  }));
  const bestEntry = rankedHands.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }
    return compare357Evaluations(candidate.evaluation, best.evaluation) > 0 ? candidate : best;
  }, null);

  return {
    rankedHands,
    winnerIds: rankedHands
      .filter((entry) => compare357Evaluations(entry.evaluation, bestEntry.evaluation) === 0)
      .map((entry) => entry.playerId),
  };
}

module.exports = {
  ONE_DOLLAR_357_TABLE_CONFIG,
  TABLE_CONFIGS,
  THREE_FIVE_SEVEN_ACTIONS,
  THREE_FIVE_SEVEN_DECISIONS,
  THREE_FIVE_SEVEN_MODES,
  THREE_FIVE_SEVEN_PHASES,
  THREE_CARD,
  FIVE_CARD,
  SEVEN_CARD,
  THREE_FIVE_SEVEN_STAGES,
  THREE_FIVE_SEVEN_TABLE,
  THREE_FIVE_SEVEN_STAGE_RULES,
  build357WildDefinition,
  build357WildRanks,
  evaluate357Hand,
  is357Mode,
  normalize357Mode,
  rank357Hands,
  solve357Hand,
  compare357Evaluations,
  SEVEN_CARD_HAND_CLASSES,
};
