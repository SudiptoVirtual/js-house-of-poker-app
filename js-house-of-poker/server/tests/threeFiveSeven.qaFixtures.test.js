const assert = require('node:assert/strict');

const { rank357Hands } = require('../../shared/threeFiveSeven');
const { players, scenarios } = require('./fixtures/threeFiveSevenQaScenarios');

function selectedCards(cardsByPlayerId, playerIds) {
  return Object.fromEntries(playerIds.map((playerId) => [playerId, cardsByPlayerId[playerId]]));
}

let failures = 0;

scenarios.forEach((scenario) => {
  try {
    assert.equal(scenario.players.length, 7, `${scenario.id} should keep seven seated players`);
    assert.deepEqual(
      scenario.players.map((player) => player.seatIndex),
      [0, 1, 2, 3, 4, 5, 6],
      `${scenario.id} should use contiguous seven-seat layout indexes`,
    );
    assert.equal(scenario.expected.seatedPlayerCount, 7);

    Object.entries(scenario.cardsByPlayerId).forEach(([playerId, cards]) => {
      assert.equal(cards.length, 7, `${scenario.id} ${playerId} should have seven cards`);
    });

    const goPlayerIds = Object.entries(scenario.decisionsByPlayerId)
      .filter(([, decision]) => decision === 'GO')
      .map(([playerId]) => playerId);
    assert.deepEqual(goPlayerIds, scenario.expected.goPlayerIds);

    if (goPlayerIds.length > 1) {
      const result = rank357Hands(
        selectedCards(scenario.cardsByPlayerId, goPlayerIds),
        scenario.mode,
        scenario.wildRanks,
      );
      assert.deepEqual(result.winnerIds.sort(), [...scenario.expected.winnerIds].sort());
    }

    console.log(`PASS ${scenario.id}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${scenario.id}`);
    console.error(error);
  }
});

try {
  assert.equal(players.length, 7);
  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    [
      '357-seven-seated-opening-state',
      '357-solo-go-earns-one-leg',
      '357-two-go-one-winner-loser-pays-winner-and-pot',
      '357-three-go-one-winner',
      '357-tied-go-winners-split-loser-payments',
      '357-no-go-pot-carries',
    ],
  );
  console.log('PASS fixture scenario inventory');
} catch (error) {
  failures += 1;
  console.error('FAIL fixture scenario inventory');
  console.error(error);
}

if (failures > 0) {
  process.exitCode = 1;
}
