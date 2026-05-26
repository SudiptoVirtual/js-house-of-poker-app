const assert = require('assert');

const {
  build357ShowdownPanelViewModel,
  get357ShowdownStageLabel,
} = require('../../src/utils/threeFiveSevenShowdown');

const players = [
  { id: 'p1', name: 'Alex' },
  { id: 'p2', name: 'Blair' },
];

assert.strictEqual(get357ShowdownStageLabel('THREE_CARD'), '3-CARD SHOWDOWN');
assert.strictEqual(get357ShowdownStageLabel('FIVE_CARD'), '5-CARD SHOWDOWN');
assert.strictEqual(get357ShowdownStageLabel('SEVEN_CARD'), 'SEVEN CARD FINAL SHOWDOWN');

const baseState = {
  pot: 42,
  lastResolution: {
    winnerIds: ['p1'],
    goPlayerIds: ['p1', 'p2'],
    legDeltaByPlayerId: { p1: 1, p2: -1 },
    potBeforeResolution: 40,
    potAfterResolution: 42,
    showdownDescriptions: { p1: 'Three Aces', p2: 'Pair of Queens' },
  },
};

const threeCardVm = build357ShowdownPanelViewModel(baseState, players);
assert.strictEqual(threeCardVm.stageLabel, '3-CARD SHOWDOWN');
assert.strictEqual(threeCardVm.winningHandName, 'Three Aces');

const fiveCardVm = build357ShowdownPanelViewModel(
  {
    ...baseState,
    lastResolution: {
      ...baseState.lastResolution,
      showdownDescriptions: { p1: 'Five Aces' },
    },
  },
  players,
);
assert.strictEqual(fiveCardVm.stageLabel, '5-CARD SHOWDOWN');

const sevenCardVm = build357ShowdownPanelViewModel(
  {
    ...baseState,
    lastResolution: {
      ...baseState.lastResolution,
      showdownDescriptions: { p1: '7-Card Straight Flush' },
    },
  },
  players,
);
assert.strictEqual(sevenCardVm.stageLabel, 'SEVEN CARD FINAL SHOWDOWN');

console.log('threeFiveSeven showdown panel tests passed');
