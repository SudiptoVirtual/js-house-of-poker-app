const assert = require('node:assert/strict');
const { Hand } = require('pokersolver');

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

function setRoundCards(room, roundSize, cardsByPlayerId) {
  Object.entries(room.hand.players).forEach(([playerId, handPlayer]) => {
    handPlayer.cards = [...cardsByPlayerId[playerId]].slice(0, roundSize);
    handPlayer.handDescription = null;
  });
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
    'showdown evaluation uses stage-correct context through 3 -> 5 -> 7 progression',
    () => {
      const { room, players } = setup357Room({ mode: 'BEST_FIVE' });
      const [host, left, right] = players;

      setRoundCards(room, 3, {
        [host.id]: ['As', 'Ad', '3c'],
        [left.id]: ['Ks', 'Kd', '2c'],
        [right.id]: ['Qs', 'Qd', '2d'],
      });
      actForEveryHandPlayer(room, 'go');
      assertRoundState(room, 'decide_5', 5);
      assert.equal(room.hand.players[host.id].handDescription, null);

      setRoundCards(room, 5, {
        [host.id]: ['As', 'Ad', 'Ac', 'Ah', '5c'],
        [left.id]: ['Ks', 'Kd', 'Kc', 'Kh', '2c'],
        [right.id]: ['Qs', 'Qd', 'Qc', 'Qh', '2d'],
      });
      actForEveryHandPlayer(room, 'go');
      assertRoundState(room, 'decide_7', 7);
      assert.equal(room.hand.players[host.id].handDescription, null);

      setRoundCards(room, 7, {
        [host.id]: ['As', 'Ad', 'Ac', 'Ah', 'Ks', 'Qd', '2c'],
        [left.id]: ['Ks', 'Kd', 'Kc', 'Kh', 'Qs', 'Jd', '2d'],
        [right.id]: ['Qs', 'Qd', 'Qc', 'Qh', 'Js', 'Td', '2h'],
      });
      const potBefore = room.threeFiveSeven.pot;
      actForEveryHandPlayer(room, 'go');

      const resolution = room.threeFiveSeven.lastResolution;
      assert.equal(resolution?.outcome, 'showdown');
      assert.deepEqual(resolution?.winnerIds, [host.id]);
      assert.equal(resolution?.potBeforeResolution, potBefore);
      assert.equal(
        resolution?.potAfterResolution,
        potBefore + ((players.length - 1) * room.threeFiveSeven.penaltyModel.unitToPot),
      );
      assert.ok((resolution?.showdownDescriptions?.[host.id] ?? '').length > 0);
      assert.equal(room.threeFiveSeven.legsByPlayerId[host.id], 0);
      assert.equal(room.threeFiveSeven.legsByPlayerId[left.id], 0);
      assert.equal(room.threeFiveSeven.legsByPlayerId[right.id], 0);
      assert.equal(room.threeFiveSeven.lastResolution?.goPlayerIds.length, players.length);
    },
  ],
  [
    'FIVE_CARD wildcards can construct five aces and classify above straight flush',
    () => {
      const { evaluate357Hand, FIVE_CARD } = require('../../shared/threeFiveSeven');
      const fiveAces = evaluate357Hand(FIVE_CARD, ['As', 'Ad', 'Ac', 'Ah', '7s'], 'BEST_FIVE', ['7']);
      const royalFlush = evaluate357Hand(FIVE_CARD, ['As', 'Ks', 'Qs', 'Js', 'Ts'], 'BEST_FIVE', []);

      assert.match(fiveAces.displayName, /five of a kind/i);
      assert.deepEqual(Hand.winners([fiveAces.solved, royalFlush.solved]), [fiveAces.solved]);
    },
  ],
  [
    'FIVE_CARD five-of-a-kind ranks by made rank (A > K > Q)',
    () => {
      const { evaluate357Hand, FIVE_CARD } = require('../../shared/threeFiveSeven');
      const fiveAces = evaluate357Hand(FIVE_CARD, ['As', 'Ad', 'Ac', 'Ah', '7s'], 'BEST_FIVE', ['7']);
      const fiveKings = evaluate357Hand(FIVE_CARD, ['Ks', 'Kd', 'Kc', 'Kh', '7d'], 'BEST_FIVE', ['7']);
      const fiveQueens = evaluate357Hand(FIVE_CARD, ['Qs', 'Qd', 'Qc', 'Qh', '7c'], 'BEST_FIVE', ['7']);

      assert.deepEqual(Hand.winners([fiveAces.solved, fiveKings.solved]), [fiveAces.solved]);
      assert.deepEqual(Hand.winners([fiveKings.solved, fiveQueens.solved]), [fiveKings.solved]);
    },
  ],
  [
    'FIVE_CARD preserves normal hierarchy when no wild upgrade exists',
    () => {
      const { evaluate357Hand, FIVE_CARD } = require('../../shared/threeFiveSeven');
      const straightFlush = evaluate357Hand(FIVE_CARD, ['9s', '8s', '7s', '6s', '5s'], 'BEST_FIVE', ['3']);
      const fourKind = evaluate357Hand(FIVE_CARD, ['As', 'Ad', 'Ac', 'Ah', '2d'], 'BEST_FIVE', ['3']);
      const fullHouse = evaluate357Hand(FIVE_CARD, ['Ks', 'Kd', 'Kc', 'Qh', 'Qd'], 'BEST_FIVE', ['3']);

      assert.deepEqual(Hand.winners([straightFlush.solved, fourKind.solved]), [straightFlush.solved]);
      assert.deepEqual(Hand.winners([fourKind.solved, fullHouse.solved]), [fourKind.solved]);
    },
  ],

  [
    'SEVEN_CARD ranks seven aces above seven-card straight flush and six aces with explicit override',
    () => {
      const { evaluate357Hand, compare357Evaluations, SEVEN_CARD } = require('../../shared/threeFiveSeven');
      const sevenCardStraightFlush = evaluate357Hand(
        SEVEN_CARD,
        ['As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '8s'],
        'HOSTEST',
        [],
      );
      const baseOther = evaluate357Hand(
        SEVEN_CARD,
        ['As', 'Ad', 'Ac', 'Kd', 'Kh', 'Qc', 'Jd'],
        'HOSTEST',
        [],
      );
      const sevenAces = { ...baseOther, sevenCardClass: 'SEVEN_ACES' };
      const fiveAces = { ...baseOther, sevenCardClass: 'OTHER' };
      const sixAces = { ...baseOther, sevenCardClass: 'SIX_ACES' };

      assert.ok(compare357Evaluations(sevenAces, sevenCardStraightFlush) > 0);
      assert.ok(compare357Evaluations(sevenCardStraightFlush, sixAces) > 0);
      assert.ok(compare357Evaluations(sixAces, fiveAces) > 0);
    },
  ],

  [
    'THREE_CARD ignores straight/flush and ranks trips > pair > high card',
    () => {
      const { rank357Hands } = require('../../shared/threeFiveSeven');
      const result = rank357Hands(
        {
          tripsA: ['As', 'Ad', 'Ac'],
          tripsK: ['Ks', 'Kd', 'Kc'],
          pairQ: ['Qs', 'Qd', '2c'],
          highA: ['As', 'Kd', '9c'],
        },
        'BEST_FIVE',
        [],
      );

      assert.deepEqual(result.winnerIds, ['tripsA']);
      const byId = Object.fromEntries(result.rankedHands.map((entry) => [entry.playerId, entry]));
      assert.match(byId.tripsA.evaluation.displayName, /three of a kind/i);
      assert.match(byId.pairQ.evaluation.displayName, /pair/i);
      assert.match(byId.highA.evaluation.displayName, /high/i);

      const ranked = result.rankedHands.map((entry) => entry.solved);
      assert.deepEqual(Hand.winners([ranked[0], ranked[1]]), [byId.tripsA.solved]);
    },
  ],
  [
    'THREE_CARD prevents straight/flush false-positives for sequential same-suit cards',
    () => {
      const { evaluate357Hand, THREE_CARD } = require('../../shared/threeFiveSeven');
      const evalResult = evaluate357Hand(THREE_CARD, ['5s', '6s', '7s'], 'BEST_FIVE', []);

      assert.doesNotMatch(evalResult.displayName, /straight/i);
      assert.doesNotMatch(evalResult.displayName, /flush/i);
      assert.match(evalResult.displayName, /high/i);
    },
  ],

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
    '357 tables allow seven seated players',
    () => {
      const rooms = new Map();
      const { player: host, room } = game.createRoom(rooms, 'socket-host', 'Host');

      game.updateGameSettings(room, host.id, { game: '357' });
      for (let index = 1; index < 7; index += 1) {
        game.joinRoom(room, `socket-${index}`, `Player ${index}`);
      }

      assert.equal(room.players.length, 7);
      assert.equal(game.buildRoomState(room, host.id).maxPlayers, 7);
      assert.throws(
        () => game.joinRoom(room, 'socket-overflow', 'Overflow'),
        /full/,
      );
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
        room.threeFiveSeven.lastResolution?.legsByPlayerId[soloGoPlayerId],
        1,
      );
      assert.equal(
        room.threeFiveSeven.lastResolution?.payoutByPlayerId[soloGoPlayerId],
        3,
      );

      const roomState = game.buildRoomState(room, host.id);
      const winnerState = roomState.players.find((player) => player.id === soloGoPlayerId);
      assert.equal(winnerState?.legs, 1);
      assert.equal(roomState.threeFiveSeven?.legsByPlayerId[soloGoPlayerId], 1);
      assert.equal(
        roomState.threeFiveSeven?.lastResolution?.legDeltaByPlayerId[soloGoPlayerId],
        1,
      );
      assert.equal(
        roomState.threeFiveSeven?.lastResolution?.legsByPlayerId[soloGoPlayerId],
        1,
      );
      assert.equal(
        roomState.threeFiveSeven?.lastResolution?.payoutByPlayerId[soloGoPlayerId],
        3,
      );
      assert.equal(roomState.threeFiveSeven?.lastResolution?.potAfterResolution, 0);
    },
  ],

  [
    'six kings with no other GO players wins the pot and earns exactly one leg',
    () => {
      const { players, room } = setup357Room({ mode: 'HOSTEST' });
      const [hero, left, right] = players;

      forceFinalRound(
        room,
        {
          [hero.id]: ['Ks', 'Kh', 'Kd', 'Kc', '3s', '5h', '7d'],
          [left.id]: ['As', 'Qh', 'Jd', '9c', '8s', '4h', '2d'],
          [right.id]: ['Ah', 'Qs', 'Jc', '9d', '8h', '4s', '2c'],
        },
        { mode: 'HOSTEST', pot: 11 },
      );
      room.hand.currentPlayerId = hero.id;

      act(room, 'go');
      act(room, 'stay');
      act(room, 'stay');

      const resolution = room.threeFiveSeven.lastResolution;
      assert.equal(resolution?.outcome, 'solo_go');
      assert.deepEqual(resolution?.goPlayerIds, [hero.id]);
      assert.deepEqual(resolution?.winnerIds, [hero.id]);
      assert.equal(resolution?.potAwarded, 11);
      assert.equal(resolution?.potAfterResolution, 0);
      assert.equal(resolution?.legDeltaByPlayerId[hero.id], 1);
      assert.equal(resolution?.legsByPlayerId[hero.id], 1);
      assert.equal(room.threeFiveSeven.legsByPlayerId[hero.id], 1);
      assert.equal(resolution?.legDeltaByPlayerId[left.id], 0);
      assert.equal(resolution?.legDeltaByPlayerId[right.id], 0);
      assert.equal(resolution?.payoutByPlayerId[hero.id], 11);
      assert.equal(resolution?.payoutByPlayerId[left.id], 0);
      assert.equal(resolution?.payoutByPlayerId[right.id], 0);
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
