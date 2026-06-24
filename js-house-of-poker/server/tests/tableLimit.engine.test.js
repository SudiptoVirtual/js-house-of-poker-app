const assert = require('node:assert/strict');

const pokerGame = require('../game');

function createBettingRoom(maxBetClips = 100) {
  const rooms = new Map();
  const { player: host, room } = pokerGame.createRoom(rooms, 'host', 'Host', { maxBetClips });
  const guest = pokerGame.joinRoom(room, 'guest', 'Guest').player;
  room.players.forEach((player) => {
    player.chips = 50000;
  });
  pokerGame.startHand(room, host.id);
  room.hand.currentBet = 0;
  room.hand.minRaise = pokerGame.BIG_BLIND;
  Object.values(room.hand.players).forEach((handPlayer) => {
    handPlayer.betThisRound = 0;
    handPlayer.hasActed = false;
    handPlayer.allIn = false;
    handPlayer.totalContribution = 0;
  });
  room.hand.currentPlayerId = host.id;
  return { host, room };
}

for (const clips of [1, 5, 20, 50, 99, 100]) {
  const { host, room } = createBettingRoom(100);
  pokerGame.performAction(room, host.id, 'bet', clips * pokerGame.CLIP_TO_CHIP_RATE);
  assert.equal(room.hand.players[host.id].betThisRound, clips * pokerGame.CLIP_TO_CHIP_RATE);
}

{
  const { host, room } = createBettingRoom(100);
  assert.throws(
    () => pokerGame.performAction(room, host.id, 'bet', 101 * pokerGame.CLIP_TO_CHIP_RATE),
    /100-clip.*max per betting action/,
  );
}

{
  const { host, room } = createBettingRoom(100);
  assert.throws(
    () => pokerGame.performAction(room, host.id, 'all-in'),
    /100-clip.*max per betting action/,
  );
}

console.log('table limit regression passed');
