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

function solve357Hand(cards, mode, wildRanks) {
  return Hand.solve(mapWildCards(cards, wildRanks), get357SolverGame(mode));
}

function rank357Hands(playerCardsById, mode, wildRanks) {
  const rankedHands = Object.entries(playerCardsById).map(([playerId, cards]) => ({
    playerId,
    solved: solve357Hand(cards, mode, wildRanks),
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
  ONE_DOLLAR_357_TABLE_CONFIG,
  TABLE_CONFIGS,
  THREE_FIVE_SEVEN_ACTIONS,
  THREE_FIVE_SEVEN_DECISIONS,
  THREE_FIVE_SEVEN_MODES,
  THREE_FIVE_SEVEN_PHASES,
  THREE_FIVE_SEVEN_TABLE,
  build357WildDefinition,
  build357WildRanks,
  is357Mode,
  normalize357Mode,
  rank357Hands,
  solve357Hand,
};
