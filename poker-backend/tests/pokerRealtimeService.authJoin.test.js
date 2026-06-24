const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const GameEventLog = require('../src/models/GameEventLog');
const GameTable = require('../src/models/GameTable');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
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

test('loadRoom accepts a backend table id from feed table invites', async (t) => {
  const originalFindOne = GameTable.findOne;
  const tableId = new mongoose.Types.ObjectId();
  let findQuery = null;
  GameTable.findOne = async (query) => {
    findQuery = query;
    return {
      _id: tableId,
      actionLog: [],
      buyInAmount: 1000,
      chatMessages: [],
      currentHandId: null,
      currentHandSnapshot: null,
      gameSettings: { game: 'holdem', locked: false, lowRule: '8-or-better', mode: 'high-only', stips: {}, wildCards: [] },
      handCount: 0,
      hostUserId: new mongoose.Types.ObjectId(),
      lastDealerPlayerId: null,
      lastWinnerSummary: null,
      maxPlayers: 6,
      minPlayersToStart: 2,
      phase: 'waiting',
      players: [],
      smallBlind: 10,
      bigBlind: 20,
      status: 'waiting',
      tableCode: 'FEED7',
      tableInvites: [],
      tableName: 'Feed Table',
      variantStateSnapshot: null,
    };
  };
  t.after(() => {
    GameTable.findOne = originalFindOne;
  });

  const service = createPokerRealtimeService(createIoStub());
  const room = await service.loadRoom(String(tableId));

  assert.deepEqual(findQuery, { $or: [{ tableCode: String(tableId).toUpperCase() }, { _id: String(tableId) }] });
  assert.equal(room.id, 'FEED7');
  assert.equal(room.tableDbId, String(tableId));
  assert.equal(service.rooms.get('FEED7'), room);
});

test('joinRoom notifies the table host when another user joins', async (t) => {
  const originalCreateEvent = GameEventLog.create;
  const originalCreateNotification = Notification.create;
  const originalFindById = User.findById;
  const hostId = new mongoose.Types.ObjectId();
  const joinerId = new mongoose.Types.ObjectId();
  const tableId = new mongoose.Types.ObjectId();
  const notificationDocs = [];
  const hostEmits = [];
  const joinerSocket = createConnectedSocket('socket-joiner');
  joinerSocket.data.userId = String(joinerId);
  const io = createIoStub();
  io.sockets.sockets.set('host-socket', {
    data: { userId: String(hostId) },
    emit: (event, payload) => hostEmits.push({ event, payload }),
  });
  io.sockets.sockets.set(joinerSocket.id, joinerSocket);

  GameEventLog.create = async () => ({});
  Notification.create = async (doc) => {
    notificationDocs.push(doc);
    return {
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date('2026-06-23T12:00:00.000Z'),
      readAt: null,
    };
  };
  User.findById = async (id) => ({
    _id: new mongoose.Types.ObjectId(id),
    avatar: '',
    chips: 5000,
    isBlocked: false,
    name: String(id) === String(joinerId) ? 'Joiner' : 'Host',
    playerStatus: { iconKey: 'badge-no-status', tier: 'NO_STATUS' },
    referralCode: '',
    save: async function saveStub() { return this; },
    status: 'active',
  });
  t.after(() => {
    GameEventLog.create = originalCreateEvent;
    Notification.create = originalCreateNotification;
    User.findById = originalFindById;
  });

  const service = createPokerRealtimeService(io);
  service.persistRoom = async () => undefined;
  const room = {
    actionLog: ['Host opened table.'],
    buyInAmount: 1000,
    chatMessages: [],
    currentHandDbId: null,
    gameSettings: {
      game: 'holdem',
      locked: false,
      lowRule: '8-or-better',
      mode: 'high-only',
      stips: {},
      wildCards: [],
    },
    hand: null,
    handCount: 0,
    hostId: String(hostId),
    id: 'JOIN9',
    lastDealerId: null,
    lastWinnerSummary: null,
    maxPlayers: 6,
    minPlayersToStart: 2,
    phase: 'waiting',
    players: [create357Player({ id: String(hostId), name: 'Host', seatNumber: 0, socketId: 'host-socket' })],
    smallBlind: 10,
    bigBlind: 20,
    status: 'waiting',
    tableDbId: String(tableId),
    tableInvites: [],
    tableName: 'Host Table',
    threeFiveSeven: null,
  };
  service.rooms.set(room.id, room);

  await service.joinRoom(joinerSocket, { tableId: room.id });

  assert.equal(notificationDocs.length, 1);
  assert.equal(notificationDocs[0].type, 'table_player_joined');
  assert.equal(String(notificationDocs[0].userId), String(hostId));
  assert.equal(String(notificationDocs[0].actorUserId), String(joinerId));
  assert.equal(notificationDocs[0].data.tableCode, 'JOIN9');
  assert.equal(notificationDocs[0].body, 'Joiner joined Host Table.');
  assert.ok(hostEmits.some((entry) => entry.event === 'notification:new' && entry.payload.notification.type === 'table_player_joined'));
  assert.ok(hostEmits.some((entry) => entry.event === 'table:notification'));
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

test('appendTableInviteRecords validates table access and persists chat-room invite records', async () => {
  const GameTable = require('../src/models/GameTable');
  const originalFindOne = GameTable.findOne;
  const service = createPokerRealtimeService(createIoStub());
  const savedTables = [];

  GameTable.findOne = async function findOneStub(query) {
    assert.equal(query.$or[0].tableCode, 'ROOM99');
    return {
      _id: '507f1f77bcf86cd799439099',
      createdByUserId: '507f1f77bcf86cd799439011',
      hostUserId: '507f1f77bcf86cd799439011',
      phase: 'waiting',
      players: [{ userId: '507f1f77bcf86cd799439011' }],
      save: async function saveStub() {
        savedTables.push(this);
        return this;
      },
      status: 'waiting',
      tableCode: 'ROOM99',
      tableInvites: [],
      tableName: 'Room 99',
    };
  };

  try {
    const response = await service.appendTableInviteRecords({
      message: 'Pull up a seat',
      recipients: [
        {
          _id: '507f1f77bcf86cd799439013',
          handle: 'river-runner',
          name: 'River Runner',
        },
      ],
      sender: {
        _id: '507f1f77bcf86cd799439011',
        name: 'Table Host',
      },
      source: 'chat-room',
      tableId: 'room99',
    });

    assert.equal(response.table.tableCode, 'ROOM99');
    assert.equal(response.invites.length, 1);
    assert.equal(response.invites[0].source, 'chat-room');
    assert.equal(response.invites[0].recipientAccountId, '507f1f77bcf86cd799439013');
    assert.equal(savedTables.length, 1);
    assert.equal(savedTables[0].tableInvites[0].message, 'Pull up a seat');
  } finally {
    GameTable.findOne = originalFindOne;
  }
});

test('QA chip grants let new QA accounts create and join a table without manual balance changes', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalQaStartingClips = process.env.POKER_QA_STARTING_CLIPS;
  const originalCreateEvent = GameEventLog.create;
  const originalCreateNotification = Notification.create;
  const originalCreateTable = GameTable.create;
  const originalExistsTable = GameTable.exists;
  const originalFindById = User.findById;
  const originalTransactionCreate = require('../src/models/Transaction').create;
  const Transaction = require('../src/models/Transaction');

  process.env.NODE_ENV = 'test';
  process.env.POKER_QA_STARTING_CLIPS = '25';

  const hostId = new mongoose.Types.ObjectId();
  const joinerId = new mongoose.Types.ObjectId();
  const tableId = new mongoose.Types.ObjectId();
  const users = new Map();
  const transactions = [];
  const savedUsers = [];
  const io = createIoStub();
  const hostSocket = createConnectedSocket('qa-host-socket');
  const joinerSocket = createConnectedSocket('qa-joiner-socket');
  hostSocket.data.userId = String(hostId);
  joinerSocket.data.userId = String(joinerId);
  io.sockets.sockets.set(hostSocket.id, hostSocket);
  io.sockets.sockets.set(joinerSocket.id, joinerSocket);

  function createUser(id, name) {
    return {
      _id: new mongoose.Types.ObjectId(id),
      avatar: '',
      chips: 0,
      email: `${name.toLowerCase()}@qa.local`,
      isBlocked: false,
      name,
      playerStatus: { iconKey: 'badge-no-status', tier: 'NO_STATUS' },
      referralCode: '',
      save: async function saveStub() {
        savedUsers.push({ id: String(this._id), chips: this.chips });
        return this;
      },
      status: 'active',
    };
  }

  users.set(String(hostId), createUser(hostId, 'QA Host'));
  users.set(String(joinerId), createUser(joinerId, 'QA Joiner'));

  GameEventLog.create = async () => ({});
  Notification.create = async (doc) => ({ ...doc, _id: new mongoose.Types.ObjectId(), createdAt: new Date(), readAt: null });
  Transaction.create = async (doc) => {
    transactions.push(doc);
    return { ...doc, _id: new mongoose.Types.ObjectId() };
  };
  User.findById = async (id) => users.get(String(id));
  GameTable.exists = async () => null;
  GameTable.create = async (doc) => ({
    ...doc,
    _id: tableId,
    save: async function saveStub() { return this; },
  });

  t.after(() => {
    if (originalNodeEnv == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalQaStartingClips == null) delete process.env.POKER_QA_STARTING_CLIPS;
    else process.env.POKER_QA_STARTING_CLIPS = originalQaStartingClips;
    GameEventLog.create = originalCreateEvent;
    Notification.create = originalCreateNotification;
    GameTable.create = originalCreateTable;
    GameTable.exists = originalExistsTable;
    User.findById = originalFindById;
    Transaction.create = originalTransactionCreate;
  });

  const service = createPokerRealtimeService(io);
  service.persistRoom = async () => undefined;

  const room = await service.createRoom(hostSocket, {});
  assert.equal(users.get(String(hostId)).chips, 0);
  assert.equal(room.players[0].chips, 1000);

  await service.joinRoom(joinerSocket, { tableId: room.id });

  assert.equal(users.get(String(joinerId)).chips, 0);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].chips, 1000);
  assert.equal(transactions.length, 2);
  assert.deepEqual(transactions.map((entry) => entry.type), ['adjustment', 'adjustment']);
  assert.deepEqual(transactions.map((entry) => entry.provider), ['poker_qa', 'poker_qa']);
  assert.equal(transactions[0].amount, 1000);
  assert.equal(transactions[0].meta.balanceField, 'chips');
  assert.equal(transactions[0].meta.grantClipsEquivalent, 25);
  assert.ok(savedUsers.some((entry) => entry.id === String(hostId) && entry.chips === 0));
  assert.ok(savedUsers.some((entry) => entry.id === String(joinerId) && entry.chips === 0));
});
