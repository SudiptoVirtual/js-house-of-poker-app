const assert = require('node:assert/strict');

const game = require('../game');
const { TABLE_CONFIGS, THREE_FIVE_SEVEN_TABLE } = require('../../shared/threeFiveSeven');

function setup357Room({ mode } = {}) {
  const rooms = new Map();
  const { player: host, room } = game.createRoom(rooms, 'socket-host', 'Host');
  const left = game.joinRoom(room, 'socket-left', 'Left');
  const right = game.joinRoom(room, 'socket-right', 'Right');

  game.updateGameSettings(
    room,
    host.id,
    mode ? { game: '357', mode } : { game: '357' },
  );
  game.startHand(room, host.id);

  return {
    host,
    players: [host, left, right],
    room,
  };
}

function act(room, action) {
  game.performAction(room, room.hand.currentPlayerId, action);
}

function actForEveryHandPlayer(room, action) {
  const actionCount = Object.keys(room.hand?.players ?? {}).length;
  for (let index = 0; index < actionCount; index += 1) {
    act(room, action);
  }
}

function playAllStayCycle(room) {
  actForEveryHandPlayer(room, 'stay');
  actForEveryHandPlayer(room, 'stay');
  actForEveryHandPlayer(room, 'stay');
}

function assertRoundState(room, expectedPhase, expectedRound) {
  assert.equal(room.hand.phase, expectedPhase);
  assert.equal(room.threeFiveSeven.activeRound, expectedRound);
}

function forceFinalRound(room, cardsByPlayerId, { mode = 'BEST_FIVE', pot = 10 } = {}) {
  room.hand.phase = 'decide_7';
  room.threeFiveSeven.activeRound = 7;
  room.threeFiveSeven.activeWildDefinition = {
    cumulative: mode === 'HOSTEST',
    label: mode === 'HOSTEST' ? '3 + 5 + 7 wild' : '7 wild',
    mode,
    round: 7,
    wildRanks: mode === 'HOSTEST' ? ['3', '5', '7'] : ['7'],
  };
  room.threeFiveSeven.hiddenDecisionState.currentRound = 7;
  room.threeFiveSeven.mode = mode;
  room.threeFiveSeven.pot = pot;

  Object.entries(room.hand.players).forEach(([playerId, handPlayer]) => {
    handPlayer.cards = [...cardsByPlayerId[playerId]];
    handPlayer.totalContribution = THREE_FIVE_SEVEN_TABLE.ante;
    room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId][7] = null;
    room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] = null;
    room.hand.threeFiveSeven.visibleDecisionsByPlayerId[playerId] = null;
  });
}

const tests = [

  [
    '$1 357 table config exposes ante and no traditional betting flags',
    () => {
      assert.deepEqual(TABLE_CONFIGS.ONE_DOLLAR_357, {
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
      });
      assert.equal(THREE_FIVE_SEVEN_TABLE.anteClips, 1);
      assert.equal(THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips, 2);
      assert.equal(THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips, 2);
      assert.equal(THREE_FIVE_SEVEN_TABLE.allowTraditionalBetting, false);
    },
  ],
  [
    '357 actions are simultaneous, idempotent, and locked per round',
    () => {
      const { players, room } = setup357Room();
      const [host, left] = players;
      const startingPhase = room.hand.phase;

      game.performAction(room, left.id, 'PLAYER_STAY');
      assert.equal(room.hand.phase, startingPhase);
      assert.equal(room.hand.threeFiveSeven.decisionHistoryByPlayerId[left.id][3], 'STAY');

      game.performAction(room, left.id, 'stay');
      assert.equal(room.hand.threeFiveSeven.decisionHistoryByPlayerId[left.id][3], 'STAY');

      assert.throws(
        () => game.performAction(room, left.id, 'go'),
        /already locked/,
      );

      game.performAction(room, host.id, 'PLAYER_GO');
      assert.equal(room.hand.threeFiveSeven.decisionHistoryByPlayerId[host.id][3], 'GO');
    },
  ],
  [
    'round progression follows 3 -> 5 -> 7',
    () => {
      const { room } = setup357Room();

      assertRoundState(room, 'decide_3', 3);

      actForEveryHandPlayer(room, 'stay');
      assertRoundState(room, 'decide_5', 5);

      actForEveryHandPlayer(room, 'stay');
      assertRoundState(room, 'decide_7', 7);

      assert.deepEqual(room.hand.threeFiveSeven.phaseSequence, [
        'deal_3',
        'decide_3',
        'deal_5',
        'decide_5',
        'deal_7',
        'decide_7',
      ]);
    },
  ],
  [
    'HOSTEST uses cumulative wild progression',
    () => {
      const { room } = setup357Room();

      assert.equal(room.threeFiveSeven.mode, 'HOSTEST');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['3']);

      actForEveryHandPlayer(room, 'stay');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['3', '5']);

      actForEveryHandPlayer(room, 'stay');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['3', '5', '7']);
    },
  ],
  [
    'BEST_FIVE uses non-cumulative wild progression',
    () => {
      const { room } = setup357Room({ mode: 'BEST_FIVE' });

      assert.equal(room.threeFiveSeven.mode, 'BEST_FIVE');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['3']);

      actForEveryHandPlayer(room, 'stay');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['5']);

      actForEveryHandPlayer(room, 'stay');
      assert.deepEqual(room.threeFiveSeven.activeWildDefinition.wildRanks, ['7']);
    },
  ],
  [
    'solo GO wins the pot and earns exactly one leg',
    () => {
      const { host, room } = setup357Room();

      actForEveryHandPlayer(room, 'stay');
      actForEveryHandPlayer(room, 'stay');

      const soloGoPlayerId = room.hand.currentPlayerId;
      act(room, 'go');
      act(room, 'stay');
      act(room, 'stay');

      assert.equal(room.threeFiveSeven.lastResolution?.outcome, 'solo_go');
      assert.deepEqual(room.threeFiveSeven.lastResolution?.winnerIds, [soloGoPlayerId]);
      assert.equal(room.threeFiveSeven.lastResolution?.potAwarded, 3);
      assert.equal(
        room.threeFiveSeven.lastResolution?.legDeltaByPlayerId[soloGoPlayerId],
        1,
      );
      assert.equal(room.threeFiveSeven.legsByPlayerId[soloGoPlayerId], 1);
      assert.equal(
        room.threeFiveSeven.lastResolution?.payoutByPlayerId[soloGoPlayerId],
        3,
      );

      const roomState = game.buildRoomState(room, host.id);
      const winnerState = roomState.players.find((player) => player.id === soloGoPlayerId);
      assert.equal(winnerState?.legs, 1);
    },
  ],
  [
    'multiple GO showdown pays the winner but awards no leg and resets losing GO legs',
    () => {
      const { players, room } = setup357Room({ mode: 'BEST_FIVE' });
      const [winner, loserOne, loserTwo] = players;

      room.threeFiveSeven.legsByPlayerId[winner.id] = 2;
      room.threeFiveSeven.legsByPlayerId[loserOne.id] = 3;
      room.threeFiveSeven.legsByPlayerId[loserTwo.id] = 1;

      forceFinalRound(
        room,
        {
          [winner.id]: ['As', 'Ad', 'Kh', 'Qc', 'Jd', '4c', '2d'],
          [loserOne.id]: ['Ks', 'Kd', 'Qh', 'Jc', 'Td', '4d', '2c'],
          [loserTwo.id]: ['Qs', 'Qd', 'Jh', 'Tc', '9d', '5d', '2h'],
        },
        { mode: 'BEST_FIVE', pot: 10 },
      );
      room.hand.currentPlayerId = winner.id;

      act(room, 'go');
      act(room, 'go');
      act(room, 'go');

      const resolution = room.threeFiveSeven.lastResolution;
      assert.equal(resolution?.outcome, 'showdown');
      assert.deepEqual(resolution?.winnerIds, [winner.id]);
      assert.equal(resolution?.winnerPenaltyTotal, 4);
      assert.equal(resolution?.payoutByPlayerId[winner.id], 4);
      assert.equal(resolution?.legDeltaByPlayerId[winner.id], 0);
      assert.equal(resolution?.potBeforeResolution, 10);
      assert.equal(resolution?.potAfterResolution, 14);
      assert.equal(resolution?.potPenaltyTotal, 4);
      assert.equal(room.threeFiveSeven.legsByPlayerId[winner.id], 2);
      assert.equal(room.threeFiveSeven.legsByPlayerId[loserOne.id], 0);
      assert.equal(room.threeFiveSeven.legsByPlayerId[loserTwo.id], 0);
    },
  ],
  [
    '0 GO players give no payout and no leg',
    () => {
      const { players, room } = setup357Room();
      const initialLegsByPlayerId = {
        [players[0].id]: 2,
        [players[1].id]: 1,
        [players[2].id]: 3,
      };

      Object.entries(initialLegsByPlayerId).forEach(([playerId, legCount]) => {
        room.threeFiveSeven.legsByPlayerId[playerId] = legCount;
      });

      const potBeforeCycleResolution = room.threeFiveSeven.pot;
      playAllStayCycle(room);

      const resolution = room.threeFiveSeven.lastResolution;
      assert.equal(resolution?.outcome, 'no_go');
      assert.equal(resolution?.potBeforeResolution, potBeforeCycleResolution);
      assert.equal(resolution?.potAwarded, 0);
      assert.equal(resolution?.potAfterResolution, potBeforeCycleResolution);

      players.forEach((player) => {
        assert.equal(resolution?.payoutByPlayerId[player.id], 0);
        assert.equal(resolution?.legDeltaByPlayerId[player.id], 0);
        assert.equal(
          room.threeFiveSeven.legsByPlayerId[player.id],
          initialLegsByPlayerId[player.id],
        );
      });
    },
  ],
  [
    'all players STAY all 3 rounds triggers reshuffle and a fresh ante',
    () => {
      const { host, room } = setup357Room();

      playAllStayCycle(room);

      assert.equal(room.hand.phase, 'decide_3');
      assert.equal(room.handCount, 2);
      assert.equal(room.threeFiveSeven.pot, 6);
      assert.equal(room.threeFiveSeven.lastResolution?.outcome, 'no_go');
      assert.deepEqual(room.threeFiveSeven.lastPhaseSequence, [
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

      const roomState = game.buildRoomState(room, host.id);
      assert.equal(roomState.phase, 'decide_3');
      assert.equal(roomState.threeFiveSeven?.activeRound, 3);
      assert.deepEqual(roomState.threeFiveSeven?.activeWildDefinition.wildRanks, ['3']);
    },
  ],
  [
    'ante is charged on each reshuffle',
    () => {
      const { players, room } = setup357Room();
      const chipsAfterOpeningAnteByPlayerId = Object.fromEntries(
        players.map((player) => [player.id, player.chips]),
      );

      playAllStayCycle(room);
      assert.equal(room.handCount, 2);
      assert.equal(room.threeFiveSeven.pot, 6);
      players.forEach((player) => {
        assert.equal(
          player.chips,
          chipsAfterOpeningAnteByPlayerId[player.id] - THREE_FIVE_SEVEN_TABLE.ante,
        );
      });

      playAllStayCycle(room);
      assert.equal(room.handCount, 3);
      assert.equal(room.threeFiveSeven.pot, 9);
      players.forEach((player) => {
        assert.equal(
          player.chips,
          chipsAfterOpeningAnteByPlayerId[player.id] - (THREE_FIVE_SEVEN_TABLE.ante * 2),
        );
      });
    },
  ],
  [
    'showdown ties split the winner-side payout and still charge the pot portion',
    () => {
      const { players, room } = setup357Room({ mode: 'BEST_FIVE' });
      const [winnerOne, winnerTwo, loser] = players;

      room.threeFiveSeven.legsByPlayerId[winnerOne.id] = 1;
      room.threeFiveSeven.legsByPlayerId[winnerTwo.id] = 3;

      forceFinalRound(
        room,
        {
          [winnerOne.id]: ['As', 'Ad', 'Kh', 'Qc', 'Jd', '4c', '2d'],
          [winnerTwo.id]: ['Ah', 'Ac', 'Ks', 'Qd', 'Jc', '4d', '2c'],
          [loser.id]: ['Qs', 'Qd', 'Jh', 'Tc', '9d', '5d', '2h'],
        },
        { mode: 'BEST_FIVE', pot: 8 },
      );
      room.hand.currentPlayerId = winnerOne.id;

      act(room, 'go');
      act(room, 'go');
      act(room, 'go');

      const resolution = room.threeFiveSeven.lastResolution;
      assert.equal(resolution?.outcome, 'showdown_tie');
      assert.equal(resolution?.splitWinnerPayout, true);
      assert.deepEqual(resolution?.winnerIds.sort(), [winnerOne.id, winnerTwo.id].sort());
      assert.equal(resolution?.winnerPenaltyTotal, 2);
      assert.equal(resolution?.payoutByPlayerId[winnerOne.id], 1);
      assert.equal(resolution?.payoutByPlayerId[winnerTwo.id], 1);
      assert.equal(resolution?.payoutByPlayerId[loser.id], 0);
      assert.equal(resolution?.potBeforeResolution, 8);
      assert.equal(resolution?.potAfterResolution, 10);
      assert.equal(resolution?.potPenaltyTotal, 2);
      assert.equal(room.threeFiveSeven.legsByPlayerId[winnerOne.id], 1);
      assert.equal(room.threeFiveSeven.legsByPlayerId[winnerTwo.id], 3);
    },
  ],
  [
    'a player leaving mid-round is treated as STAY for the rest of the cycle',
    () => {
      const { room } = setup357Room();

      const leavingPlayerId = room.hand.currentPlayerId;
      const currentRound = room.threeFiveSeven.activeRound;

      game.leaveRoom(room, leavingPlayerId);

      assert.equal(
        room.hand.threeFiveSeven.decisionHistoryByPlayerId[leavingPlayerId][currentRound],
        'STAY',
      );
      assert.equal(room.hand.threeFiveSeven.finalDecisionByPlayerId[leavingPlayerId], 'STAY');

      for (let index = 0; index < 6; index += 1) {
        act(room, 'stay');
      }

      assert.equal(room.threeFiveSeven.lastResolution?.outcome, 'no_go');
      assert.equal(
        room.threeFiveSeven.lastResolution?.revealedDecisions[leavingPlayerId],
        'STAY',
      );
      assert.equal(room.hand.phase, 'decide_3');
      assert.equal(room.handCount, 2);
    },
  ],
];

let failures = 0;

tests.forEach(([name, fn]) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
});

if (failures > 0) {
  process.exitCode = 1;
}
