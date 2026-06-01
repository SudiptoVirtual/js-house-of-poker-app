const test = require('node:test');
const assert = require('node:assert/strict');

const { createPokerRealtimeService } = require('../src/services/pokerRealtimeService');

function createSocketStub() {
  return {
    data: {},
    handshake: {
      auth: {},
      headers: {},
    },
  };
}


function createIoStub() {
  return {
    sockets: {
      sockets: new Map(),
    },
    to: () => ({ emit: () => undefined }),
  };
}

function createConnectedSocket(id) {
  const emitted = [];

  return {
    ...createSocketStub(),
    emitted,
    id,
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    join: () => undefined,
  };
}

function create357Player({ id, name, seatNumber, socketId }) {
  return {
    avatar: '',
    chips: 1000,
    id,
    isConnected: true,
    name,
    pendingRemoval: false,
    playerStatus: 'NO_STATUS',
    referralCode: '',
    seatNumber,
    socketId,
    statusIcon: 'badge-no-status',
    statusSnapshot: {
      invitePriority: 0,
      lastUpdatedAt: null,
      recentHands: 0,
      recentScore: 0,
      reputation: 0,
      sharkWins: 0,
      strongTableWins: 0,
      windowSize: 20,
    },
    userId: id,
  };
}

function latestRoomState(socket) {
  return socket.emitted
    .filter((entry) => entry.event === 'room:state')
    .at(-1)?.payload;
}

test('Valid table code + no token is blocked with clear auth error (Option A)', async () => {
  const service = createPokerRealtimeService({ to: () => ({ emit: () => undefined }) });
  const socket = createSocketStub();

  await assert.rejects(
    service.joinRoom(socket, { tableId: 'ABC123' }),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message, 'Authentication token is required for realtime play.');
      return true;
    },
  );
});

test('357 solo GO resolution awards and persists configured legs for the solo GO player', async () => {
  const io = createIoStub();
  const service = createPokerRealtimeService(io);
  service.persistRoom = async () => undefined;

  const winnerId = 'player-go';
  const stayId = 'player-stay';
  const winnerSocket = createConnectedSocket('socket-go');
  const staySocket = createConnectedSocket('socket-stay');
  io.sockets.sockets.set(winnerSocket.id, winnerSocket);
  io.sockets.sockets.set(staySocket.id, staySocket);

  const room = {
    actionLog: ['357 test table opened.'],
    buyInAmount: 1000,
    chatMessages: [],
    currentHandDbId: null,
    gameSettings: {
      game: '357',
      locked: false,
      lowRule: '8-or-better',
      mode: 'THREE_CARD',
      stips: {
        bestFiveCards: false,
        hostestWithTheMostest: false,
        suitedBeatsUnsuited: false,
        wildCards: false,
      },
      wildCards: [],
    },
    hand: null,
    handCount: 0,
    hostId: winnerId,
    id: 'T357SOLO',
    lastDealerId: null,
    lastWinnerSummary: null,
    maxPlayers: 7,
    minPlayersToStart: 2,
    players: [
      create357Player({
        id: winnerId,
        name: 'Solo Go',
        seatNumber: 0,
        socketId: winnerSocket.id,
      }),
      create357Player({
        id: stayId,
        name: 'Only Stay',
        seatNumber: 1,
        socketId: staySocket.id,
      }),
    ],
    smallBlind: 0,
    bigBlind: 0,
    status: 'waiting',
    phase: 'waiting',
    tableDbId: null,
    tableInvites: [],
    tableName: '357 Solo GO Test',
    threeFiveSeven: null,
  };

  service.rooms.set(room.id, room);
  service.sessions.set(winnerSocket.id, {
    playerId: winnerId,
    roomId: room.id,
  });
  service.sessions.set(staySocket.id, {
    playerId: stayId,
    roomId: room.id,
  });

  await service.startGame(winnerSocket);
  assert.equal(room.hand.phase, 'decide_3');

  await service.performAction(winnerSocket, 'STAY');
  await service.performAction(staySocket, 'STAY');
  assert.equal(room.hand.phase, 'decide_5');

  await service.performAction(winnerSocket, 'STAY');
  await service.performAction(staySocket, 'STAY');
  assert.equal(room.hand.phase, 'decide_7');

  room.threeFiveSeven.penaltyModel.soloGoLegAward = 2;
  const previousWinnerLegs = room.threeFiveSeven.legsByPlayerId[winnerId];
  await service.performAction(winnerSocket, 'GO');
  await service.performAction(staySocket, 'STAY');

  const lastResolution = room.threeFiveSeven.lastResolution;
  assert.equal(lastResolution.outcome, 'solo_go');
  assert.deepEqual(lastResolution.winnerIds, [winnerId]);
  assert.equal(lastResolution.legDeltaByPlayerId[winnerId], 2);
  assert.equal(
    room.threeFiveSeven.legsByPlayerId[winnerId],
    previousWinnerLegs + 2,
  );

  const emittedWinnerState = latestRoomState(winnerSocket);
  assert.equal(emittedWinnerState.threeFiveSeven.lastResolution.outcome, 'solo_go');
  assert.equal(emittedWinnerState.threeFiveSeven.legsByPlayerId[winnerId], 2);
  assert.equal(
    emittedWinnerState.threeFiveSeven.lastResolution.legDeltaByPlayerId[winnerId],
    2,
  );
  assert.equal(
    emittedWinnerState.players.find((player) => player.id === winnerId).legs,
    2,
  );

  assert.equal(room.handCount, 2);
  assert.equal(room.hand.phase, 'decide_3');
  assert.equal(room.threeFiveSeven.lastResolution.outcome, 'solo_go');
  assert.equal(room.threeFiveSeven.legsByPlayerId[winnerId], 2);
  assert.equal(
    room.actionLog.some((message) => /earns 2 legs\./.test(message)),
    true,
  );

  const nextCycleState = latestRoomState(staySocket);
  assert.equal(nextCycleState.handNumber, 2);
  assert.equal(nextCycleState.phase, 'decide_3');
  assert.equal(nextCycleState.threeFiveSeven.lastResolution.outcome, 'solo_go');
  assert.equal(nextCycleState.threeFiveSeven.legsByPlayerId[winnerId], 2);
  assert.equal(
    nextCycleState.threeFiveSeven.lastResolution.legDeltaByPlayerId[winnerId],
    2,
  );
  assert.equal(
    nextCycleState.players.find((player) => player.id === winnerId).legs,
    2,
  );
});
