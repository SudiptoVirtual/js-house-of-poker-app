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
