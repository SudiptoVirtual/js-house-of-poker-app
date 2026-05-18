const { THREE_FIVE_SEVEN_TABLE } = require('../../../shared/threeFiveSeven');

const players = Object.freeze([
  Object.freeze({ id: 'qa-seat-1', name: 'Ari', seatIndex: 0, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-2', name: 'Blake', seatIndex: 1, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-3', name: 'Casey', seatIndex: 2, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-4', name: 'Devon', seatIndex: 3, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-5', name: 'Ellis', seatIndex: 4, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-6', name: 'Finley', seatIndex: 5, stack: 1000 }),
  Object.freeze({ id: 'qa-seat-7', name: 'Gray', seatIndex: 6, stack: 1000 }),
]);

const baseCardsByPlayerId = Object.freeze({
  'qa-seat-1': Object.freeze(['As', 'Ad', 'Kh', 'Qc', 'Jd', '4c', '2d']),
  'qa-seat-2': Object.freeze(['Ks', 'Kd', 'Qh', 'Jc', 'Td', '4d', '2c']),
  'qa-seat-3': Object.freeze(['Qs', 'Qd', 'Jh', 'Tc', '9d', '5d', '2h']),
  'qa-seat-4': Object.freeze(['Js', 'Jd', 'Th', '9c', '8d', '4h', '2s']),
  'qa-seat-5': Object.freeze(['Ts', 'Td', '9h', '8c', '6d', '4s', '2h']),
  'qa-seat-6': Object.freeze(['9s', '9d', '8h', '6c', '5c', '4d', '2c']),
  'qa-seat-7': Object.freeze(['8s', '8d', '6h', '5s', '4c', '3d', '2s']),
});

const tiedWinnerCardsByPlayerId = Object.freeze({
  ...baseCardsByPlayerId,
  'qa-seat-2': Object.freeze(['Ah', 'Ac', 'Ks', 'Qd', 'Jc', '4d', '2c']),
});

const basePot = players.length * THREE_FIVE_SEVEN_TABLE.anteClips;
const unitToWinner = THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips;
const unitToPot = THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips;

const stayAll = Object.freeze(Object.fromEntries(players.map((player) => [player.id, 'STAY'])));

function decisions(goPlayerIds) {
  return Object.freeze(
    Object.fromEntries(
      players.map((player) => [player.id, goPlayerIds.includes(player.id) ? 'GO' : 'STAY']),
    ),
  );
}

const scenarios = Object.freeze([
  Object.freeze({
    id: '357-seven-seated-opening-state',
    title: '7 seated players at a 357 table',
    purpose: 'Smoke-test seven compact seat indicators before any reveal or payout.',
    players,
    round: 3,
    mode: 'HOSTEST',
    wildRanks: Object.freeze(['3']),
    potBeforeResolution: basePot,
    cardsByPlayerId: baseCardsByPlayerId,
    decisionsByPlayerId: stayAll,
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze([]),
      outcome: 'pre-resolution-seat-layout',
      potAfterResolution: basePot,
      summary: 'Seven players are seated with compact indicators visible; no GO reveal has resolved yet.',
    }),
  }),
  Object.freeze({
    id: '357-solo-go-earns-one-leg',
    title: 'Exactly one GO player earns a leg',
    purpose: 'Verify a solo GO reveal awards the carried pot and increments only that player by one leg.',
    players,
    round: 7,
    mode: 'BEST_FIVE',
    wildRanks: Object.freeze(['7']),
    potBeforeResolution: basePot,
    cardsByPlayerId: baseCardsByPlayerId,
    decisionsByPlayerId: decisions(['qa-seat-1']),
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze(['qa-seat-1']),
      winnerIds: Object.freeze(['qa-seat-1']),
      loserIds: Object.freeze([]),
      outcome: 'solo_go',
      payoutByPlayerId: Object.freeze({ 'qa-seat-1': basePot }),
      legDeltaByPlayerId: Object.freeze({ 'qa-seat-1': 1 }),
      potAfterResolution: 0,
      summary: 'Ari went GO alone, wins 7 clips from the pot, and earns exactly 1 leg.',
    }),
  }),
  Object.freeze({
    id: '357-two-go-one-winner-loser-pays-winner-and-pot',
    title: 'Two GO players, one winner, loser pays winner and pot',
    purpose: 'Verify one losing GO player pays the winner side and also adds the pot penalty.',
    players,
    round: 7,
    mode: 'BEST_FIVE',
    wildRanks: Object.freeze(['7']),
    potBeforeResolution: basePot,
    cardsByPlayerId: baseCardsByPlayerId,
    decisionsByPlayerId: decisions(['qa-seat-1', 'qa-seat-2']),
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze(['qa-seat-1', 'qa-seat-2']),
      winnerIds: Object.freeze(['qa-seat-1']),
      loserIds: Object.freeze(['qa-seat-2']),
      outcome: 'showdown',
      payoutByPlayerId: Object.freeze({ 'qa-seat-1': unitToWinner, 'qa-seat-2': 0 }),
      potPenaltyTotal: unitToPot,
      winnerPenaltyTotal: unitToWinner,
      potAfterResolution: basePot + unitToPot,
      summary: 'Ari beat Blake; Blake pays 2 clips to Ari and 2 clips to the pot.',
    }),
  }),
  Object.freeze({
    id: '357-three-go-one-winner',
    title: 'Three GO players with one winner',
    purpose: 'Verify two losing GO players both pay the winner side and the pot.',
    players,
    round: 7,
    mode: 'BEST_FIVE',
    wildRanks: Object.freeze(['7']),
    potBeforeResolution: basePot,
    cardsByPlayerId: baseCardsByPlayerId,
    decisionsByPlayerId: decisions(['qa-seat-1', 'qa-seat-2', 'qa-seat-3']),
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze(['qa-seat-1', 'qa-seat-2', 'qa-seat-3']),
      winnerIds: Object.freeze(['qa-seat-1']),
      loserIds: Object.freeze(['qa-seat-2', 'qa-seat-3']),
      outcome: 'showdown',
      payoutByPlayerId: Object.freeze({ 'qa-seat-1': unitToWinner * 2, 'qa-seat-2': 0, 'qa-seat-3': 0 }),
      potPenaltyTotal: unitToPot * 2,
      winnerPenaltyTotal: unitToWinner * 2,
      potAfterResolution: basePot + (unitToPot * 2),
      summary: 'Ari beat Blake and Casey; both losers pay 2 clips to Ari and 2 clips to the pot.',
    }),
  }),
  Object.freeze({
    id: '357-tied-go-winners-split-loser-payments',
    title: 'Tied GO winners split loser payments',
    purpose: 'Verify tied winners split the winner-side penalty while the loser still pays the pot penalty.',
    players,
    round: 7,
    mode: 'BEST_FIVE',
    wildRanks: Object.freeze(['7']),
    potBeforeResolution: basePot,
    cardsByPlayerId: tiedWinnerCardsByPlayerId,
    decisionsByPlayerId: decisions(['qa-seat-1', 'qa-seat-2', 'qa-seat-3']),
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze(['qa-seat-1', 'qa-seat-2', 'qa-seat-3']),
      winnerIds: Object.freeze(['qa-seat-1', 'qa-seat-2']),
      loserIds: Object.freeze(['qa-seat-3']),
      outcome: 'showdown_tie',
      splitWinnerPayout: true,
      payoutByPlayerId: Object.freeze({ 'qa-seat-1': 1, 'qa-seat-2': 1, 'qa-seat-3': 0 }),
      potPenaltyTotal: unitToPot,
      winnerPenaltyTotal: unitToWinner,
      potAfterResolution: basePot + unitToPot,
      summary: 'Ari and Blake tie; Casey pays 2 clips split 1/1 to the winners and 2 clips to the pot.',
    }),
  }),
  Object.freeze({
    id: '357-no-go-pot-carries',
    title: 'No GO players, pot carries',
    purpose: 'Verify an all-STAY reveal pays nobody and leaves the pot available for the next cycle.',
    players,
    round: 7,
    mode: 'BEST_FIVE',
    wildRanks: Object.freeze(['7']),
    potBeforeResolution: basePot,
    cardsByPlayerId: baseCardsByPlayerId,
    decisionsByPlayerId: stayAll,
    expected: Object.freeze({
      seatedPlayerCount: 7,
      goPlayerIds: Object.freeze([]),
      winnerIds: Object.freeze([]),
      loserIds: Object.freeze([]),
      outcome: 'no_go',
      payoutByPlayerId: Object.freeze({}),
      potAfterResolution: basePot,
      summary: 'No GO players. Pot carries forward at 7 clips.',
    }),
  }),
]);

module.exports = {
  basePot,
  players,
  scenarios,
};
