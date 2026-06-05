const test = require('node:test');
const assert = require('node:assert/strict');

const ChatRoomMessage = require('../src/models/ChatRoomMessage');
const {
  ChatRoomRealtimeService,
  moderateChatRoomMessage,
  normalizeMessageText,
} = require('../src/services/chatRoomRealtimeService');

function createIoMock() {
  const emissions = [];
  return {
    emissions,
    sockets: {
      sockets: new Map(),
    },
    to(roomId) {
      return {
        emit(event, payload) {
          emissions.push({ event, payload, roomId });
        },
      };
    },
  };
}

function createSocketMock() {
  return {
    data: {},
    emit: () => undefined,
    id: 'socket-self',
    rooms: new Set(),
    to(roomId) {
      return {
        emit: () => undefined,
      };
    },
  };
}

function createService(io = createIoMock()) {
  const service = new ChatRoomRealtimeService(io, {
    authenticateSocketUser: async () => ({
      _id: '507f1f77bcf86cd799439011',
      name: 'Safety Tester',
    }),
  });

  service.findRoom = async () => ({ _id: '507f1f77bcf86cd799439012' });
  return service;
}

test('normalizeMessageText rejects non-string and enforces trimmed length limit', () => {
  assert.equal(normalizeMessageText(null), '');
  assert.equal(normalizeMessageText('  hello   world  '), 'hello world');
  assert.equal(normalizeMessageText('x'.repeat(1200)).length, 1000);
});

test('moderateChatRoomMessage returns table-chat compatible moderation statuses', () => {
  assert.equal(moderateChatRoomMessage({ text: 'friendly hello' }).status, 'accepted');
  assert.equal(moderateChatRoomMessage({ text: 'this is trash' }).status, 'pending-review');
  assert.equal(moderateChatRoomMessage({ text: 'I will kill you' }).status, 'blocked');
});

test('sendMessage persists blocked moderation audit metadata without broadcasting', async () => {
  const originalSave = ChatRoomMessage.prototype.save;
  const savedMessages = [];
  ChatRoomMessage.prototype.save = async function saveStub() {
    savedMessages.push(this);
    return this;
  };

  try {
    const io = createIoMock();
    const service = createService(io);

    await assert.rejects(
      service.sendMessage(createSocketMock(), {
        roomId: '507f1f77bcf86cd799439012',
        text: 'I will kill you',
      }),
      /not allowed in chat rooms/,
    );

    assert.equal(savedMessages.length, 1);
    assert.equal(savedMessages[0].moderation.status, 'blocked');
    assert.deepEqual(savedMessages[0].moderation.flags, ['threat_or_violent_abuse']);
    assert.equal(io.emissions.length, 0);
  } finally {
    ChatRoomMessage.prototype.save = originalSave;
  }
});

test('sendMessage persists pending-review moderation metadata and broadcasts the auditable message', async () => {
  const originalSave = ChatRoomMessage.prototype.save;
  const savedMessages = [];
  ChatRoomMessage.prototype.save = async function saveStub() {
    savedMessages.push(this);
    return this;
  };

  try {
    const io = createIoMock();
    const service = createService(io);

    const response = await service.sendMessage(createSocketMock(), {
      roomId: '507f1f77bcf86cd799439012',
      text: 'this is trash',
    });

    assert.equal(response.ok, true);
    assert.equal(savedMessages.length, 1);
    assert.equal(savedMessages[0].moderation.status, 'pending-review');
    assert.deepEqual(savedMessages[0].moderation.flags, ['targeted_harassment']);
    assert.equal(io.emissions.length, 1);
    assert.equal(io.emissions[0].event, 'chat:newMessage');
    assert.equal(io.emissions[0].payload.message.moderation.status, 'pending-review');
  } finally {
    ChatRoomMessage.prototype.save = originalSave;
  }
});

test('enforceRateLimit limits social chat per user and per room', () => {
  const service = createService();

  for (let index = 0; index < 5; index += 1) {
    service.enforceRateLimit('room-a', 'user-a');
  }

  assert.throws(
    () => service.enforceRateLimit('room-a', 'user-a'),
    /sending chat room messages too quickly/,
  );

  const roomLimitedService = createService();
  for (let index = 0; index < 60; index += 1) {
    roomLimitedService.enforceRateLimit('room-b', `user-${index}`);
  }

  assert.throws(
    () => roomLimitedService.enforceRateLimit('room-b', 'user-overflow'),
    /receiving too many messages/,
  );
});

test('createTableFromChatRoom validates context, persists launch metadata, and emits acknowledgement payload', async () => {
  const ChatRoom = require('../src/models/ChatRoom');
  const ChatRoomMessage = require('../src/models/ChatRoomMessage');
  const Notification = require('../src/models/Notification');
  const originalUpdateOne = ChatRoom.updateOne;
  const originalFindById = ChatRoom.findById;
  const originalInsertMany = Notification.insertMany;
  const originalSave = ChatRoomMessage.prototype.save;
  const updates = [];
  const savedMessages = [];
  ChatRoom.updateOne = async function updateOneStub(query, update) {
    updates.push({ query, update });
    return { acknowledged: true };
  };
  ChatRoom.findById = function findByIdStub() {
    return {
      select: async () => ({ participantStates: [] }),
    };
  };
  Notification.insertMany = async function insertManyStub(docs) {
    return docs.map((doc, index) => ({ _id: `notification-${index}`, ...doc }));
  };
  ChatRoomMessage.prototype.save = async function saveStub() {
    this._id = this._id || '507f1f77bcf86cd799439015';
    this.createdAt = this.createdAt || new Date('2026-01-01T00:00:00.000Z');
    savedMessages.push(this);
    return this;
  };

  try {
    const io = createIoMock();
    const launcherEmits = [];
    const recipientEmits = [];
    io.sockets.sockets = new Map([
      [
        'recipient-1',
        {
          data: { userId: '507f1f77bcf86cd799439013' },
          emit(event, payload) {
            recipientEmits.push({ event, payload });
          },
          id: 'recipient-1',
        },
      ],
    ]);
    const service = createService(io);
    service.findRoom = async () => ({
      _id: '507f1f77bcf86cd799439012',
      isPublic: false,
      name: 'Strategy Lab',
      participantStates: [{ userId: '507f1f77bcf86cd799439011' }],
    });

    const pokerRealtimeService = {
      async createRoomFromChatRoom(socket, payload, context) {
        assert.equal(payload.roomId, undefined);
        assert.equal(payload.tableId, undefined);
        assert.deepEqual(payload.gameSettings, { game: '357', mode: 'HOSTEST' });
        assert.equal(String(context.chatRoomId), '507f1f77bcf86cd799439012');
        assert.equal(String(context.launchedByUserId), '507f1f77bcf86cd799439011');
        assert.deepEqual(context.invitedPlayerIds, ['507f1f77bcf86cd799439013']);
        assert.equal(context.visibility, 'private');
        return {
          id: 'ABCD12',
          tableDbId: '507f1f77bcf86cd799439014',
          tableName: payload.tableName,
        };
      },
    };

    const socket = createSocketMock();
    socket.data = { userId: '507f1f77bcf86cd799439011' };
    socket.emit = (event, payload) => launcherEmits.push({ event, payload });
    socket.to = (roomId) => ({
      emit(event, payload) {
        io.emissions.push({ event, payload, roomId, via: 'socket.to' });
      },
    });
    const response = await service.createTableFromChatRoom(socket, {
      chatRoomId: '507f1f77bcf86cd799439012',
      gameSettings: { game: '357', mode: 'HOSTEST' },
      invitedPlayerIds: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439013'],
      tableName: 'Strategy Lab Table',
      tableTier: 'private-study',
      visibility: 'private',
    }, pokerRealtimeService);

    assert.equal(response.ok, true);
    assert.equal(response.tableCode, 'ABCD12');
    assert.equal(response.tableDbId, '507f1f77bcf86cd799439014');
    assert.deepEqual(response.invitedPlayerIds, ['507f1f77bcf86cd799439013']);
    assert.equal(response.createdAt, response.launchedAt);
    assert.deepEqual(response.gameSettings, { game: '357', mode: 'HOSTEST' });
    assert.deepEqual(response.deliveredPlayerIds, ['507f1f77bcf86cd799439013']);
    assert.equal(savedMessages.length, 1);
    assert.equal(savedMessages[0].tone, 'system');
    assert.equal(savedMessages[0].launchContext.tableCode, 'ABCD12');
    const launchUpdate = updates.find((update) => update.update.$push?.tableLaunches);
    assert.equal(launchUpdate.update.$push.tableLaunches.$each[0].tableCode, 'ABCD12');
    assert.deepEqual(launchUpdate.update.$push.tableLaunches.$each[0].gameSettings, { game: '357', mode: 'HOSTEST' });
    assert.equal(launcherEmits[0].event, 'table:launchFromChatRoom');
    assert.equal(launcherEmits[0].payload.sender, true);
    assert.equal(recipientEmits[0].event, 'table:launchFromChatRoom');
    assert.equal(io.emissions.some((emission) => emission.event === 'chat:newMessage'), true);
  } finally {
    ChatRoom.updateOne = originalUpdateOne;
    ChatRoom.findById = originalFindById;
    Notification.insertMany = originalInsertMany;
    ChatRoomMessage.prototype.save = originalSave;
  }
});

test('inviteRoomPlayers persists selected chat room invites and emits per-player statuses', async () => {
  const ChatRoom = require('../src/models/ChatRoom');
  const Notification = require('../src/models/Notification');
  const User = require('../src/models/User');
  const originalChatRoomUpdateOne = ChatRoom.updateOne;
  const originalChatRoomFindById = ChatRoom.findById;
  const originalNotificationInsertMany = Notification.insertMany;
  const originalMessageSave = ChatRoomMessage.prototype.save;
  const originalUserFind = User.find;
  const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
  const updates = [];
  const referralUpdates = [];
  const savedSystemMessages = [];

  ChatRoom.updateOne = async function updateOneStub(query, update) {
    updates.push({ query, update });
    return { acknowledged: true };
  };
  ChatRoom.findById = function findByIdStub() {
    return {
      select: async () => ({ participantStates: [] }),
    };
  };
  Notification.insertMany = async function insertManyStub(docs) {
    return docs.map((doc, index) => ({ _id: `invite-notification-${index}`, ...doc }));
  };
  User.find = async function findStub() {
    return [
      {
        _id: '507f1f77bcf86cd799439013',
        email: 'casey@example.test',
        name: 'Casey Cards',
      },
      {
        _id: '507f1f77bcf86cd799439014',
        email: 'riley@example.test',
        name: 'Riley River',
      },
    ];
  };
  User.findByIdAndUpdate = async function findByIdAndUpdateStub(id, update) {
    referralUpdates.push({ id, update });
    return { acknowledged: true };
  };
  ChatRoomMessage.prototype.save = async function saveStub() {
    this._id = this._id || 'invite-system-message';
    savedSystemMessages.push(this);
    return this;
  };

  try {
    const recipientEmits = [];
    const senderEmits = [];
    const io = createIoMock();
    io.sockets.sockets = new Map([
      [
        'recipient-1',
        {
          data: { userId: '507f1f77bcf86cd799439013' },
          emit(event, payload) {
            recipientEmits.push({ event, payload, socketId: 'recipient-1' });
          },
        },
      ],
      [
        'recipient-2',
        {
          data: { userId: '507f1f77bcf86cd799439014' },
          emit(event, payload) {
            recipientEmits.push({ event, payload, socketId: 'recipient-2' });
          },
        },
      ],
    ]);
    const service = new ChatRoomRealtimeService(io, {
      authenticateSocketUser: async () => ({
        _id: '507f1f77bcf86cd799439011',
        name: 'Invite Sender',
      }),
      presenceService: {
        getPresenceSnapshot() {
          return {
            inviteEligibility: {
              eligiblePlayerIds: [
                '507f1f77bcf86cd799439013',
                '507f1f77bcf86cd799439014',
              ],
              invitedPlayerIds: [],
            },
            players: [
              { userId: '507f1f77bcf86cd799439013' },
              { userId: '507f1f77bcf86cd799439014' },
            ],
          };
        },
      },
    });
    service.findRoom = async () => ({
      _id: '507f1f77bcf86cd799439012',
      isPublic: false,
      participantStates: [
        { userId: '507f1f77bcf86cd799439011' },
        { userId: '507f1f77bcf86cd799439013' },
        { userId: '507f1f77bcf86cd799439014' },
      ],
    });

    const socket = {
      data: { userId: '507f1f77bcf86cd799439011' },
      emit(event, payload) {
        senderEmits.push({ event, payload });
      },
    };
    const pokerRealtimeService = {
      async appendTableInviteRecords({ message, recipients, sender, source, tableId }) {
        assert.equal(message, 'Join my table');
        assert.deepEqual(recipients.map((recipient) => String(recipient._id)), [
          '507f1f77bcf86cd799439013',
          '507f1f77bcf86cd799439014',
        ]);
        assert.equal(String(sender._id), '507f1f77bcf86cd799439011');
        assert.equal(source, 'chat-room');
        assert.equal(tableId, 'TABLE1');
        return {
          invites: recipients.map((recipient, index) => ({
            createdAt: 123 + index,
            giftBuyInChips: 0,
            giftBuyInClips: 0,
            id: `invite-${index}`,
            message,
            recipientAccountId: String(recipient._id),
            recipientHandle: recipient.name,
            recipientLabel: recipient.name,
            senderPlayerId: '507f1f77bcf86cd799439011',
            senderPlayerName: 'Invite Sender',
            source,
            status: 'pending',
          })),
          table: {
            tableCode: 'TABLE1',
            tableDbId: '507f1f77bcf86cd799439015',
            tableId: 'TABLE1',
            tableName: 'Invite Table',
          },
        };
      },
    };

    const response = await service.inviteRoomPlayers(socket, {
      chatRoomId: '507f1f77bcf86cd799439012',
      message: '  Join   my table  ',
      playerIds: [
        '507f1f77bcf86cd799439013',
        '507f1f77bcf86cd799439014',
        '507f1f77bcf86cd799439014',
      ],
      tableId: 'TABLE1',
    }, pokerRealtimeService);

    assert.equal(response.ok, true);
    assert.deepEqual(response.invitedPlayerIds, [
      '507f1f77bcf86cd799439013',
      '507f1f77bcf86cd799439014',
    ]);
    assert.deepEqual(response.results.map((result) => result.status), ['invited', 'invited']);
    const playerInviteEmits = recipientEmits.filter((emit) => emit.event === 'table:playerInvited');
    assert.equal(playerInviteEmits.length, 2);
    assert.equal(playerInviteEmits[0].event, 'table:playerInvited');
    assert.equal(playerInviteEmits[0].payload.inviteId, 'invite-0');
    assert.equal(senderEmits.length, 1);
    assert.equal(senderEmits[0].payload.sender, true);
    const inviteHistoryUpdate = updates.find((update) => update.update.$push?.tableInviteHistory);
    assert.equal(inviteHistoryUpdate.update.$push.tableInviteHistory.$each[0].tableCode, 'TABLE1');
    assert.equal(referralUpdates[0].update.$inc['referralStats.invitesSent'], 2);
    assert.equal(savedSystemMessages.length, 1);
    assert.equal(savedSystemMessages[0].tone, 'system');
  } finally {
    ChatRoom.updateOne = originalChatRoomUpdateOne;
    ChatRoom.findById = originalChatRoomFindById;
    Notification.insertMany = originalNotificationInsertMany;
    ChatRoomMessage.prototype.save = originalMessageSave;
    User.find = originalUserFind;
    User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
  }
});

test('inviteRoomPlayers returns per-player failures for ineligible selections', async () => {
  const User = require('../src/models/User');
  const originalUserFind = User.find;
  User.find = async function findStub() {
    throw new Error('User lookup should not run for ineligible players.');
  };

  try {
    const service = new ChatRoomRealtimeService(createIoMock(), {
      authenticateSocketUser: async () => ({
        _id: '507f1f77bcf86cd799439011',
        name: 'Invite Sender',
      }),
      presenceService: {
        getPresenceSnapshot() {
          return {
            inviteEligibility: {
              eligiblePlayerIds: [],
              invitedPlayerIds: [],
            },
            players: [{ userId: '507f1f77bcf86cd799439013' }],
          };
        },
      },
    });
    service.findRoom = async () => ({
      _id: '507f1f77bcf86cd799439012',
      isPublic: true,
      participantStates: [{ userId: '507f1f77bcf86cd799439013' }],
    });
    const response = await service.inviteRoomPlayers(createSocketMock(), {
      chatRoomId: '507f1f77bcf86cd799439012',
      playerIds: ['507f1f77bcf86cd799439013', 'invalid-id'],
      tableId: 'TABLE1',
    }, {
      appendTableInviteRecords() {
        throw new Error('Invite persistence should not run for ineligible players.');
      },
    });

    assert.equal(response.ok, false);
    assert.deepEqual(response.results.map((result) => result.reason), [
      'not-eligible',
      'invalid-player-id',
    ]);
  } finally {
    User.find = originalUserFind;
  }
});
