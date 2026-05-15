const assert = require('node:assert/strict');

const { createPokerRealtimeService } = require('../src/services/pokerRealtimeService');

function createIoMock() {
  const emissions = [];
  return {
    emissions,
    to(roomId) {
      return {
        emit(event, payload) {
          emissions.push({ event, payload, roomId });
        },
      };
    },
  };
}

function createMessage(index) {
  return {
    createdAt: index,
    id: `existing-${index}`,
    moderation: {
      flags: [],
      reason: null,
      reviewedAt: null,
      status: 'accepted',
    },
    playerId: `player-${index}`,
    playerName: `Player ${index}`,
    text: `Existing ${index}`,
    tone: 'player',
  };
}

async function sendMessageWithHistory(existingMessages, text = 'Newest message') {
  const io = createIoMock();
  const service = createPokerRealtimeService(io);
  const room = {
    chatMessages: [...existingMessages],
    id: 'ROOM1',
    players: [
      {
        id: 'player-current',
        name: 'Current Player',
      },
    ],
  };

  service.getSessionRoom = async () => ({
    room,
    session: { playerId: 'player-current' },
  });
  service.enforceTableChatRateLimit = () => {};
  service.persistRoom = async () => {};
  service.recordTableChatModerationEvent = async () => {};
  service.emitRoomState = async () => {};

  await service.sendTableChatMessage({}, { message: text });

  return { io, room };
}

const tests = [
  [
    'sendTableChatMessage appends new messages so history stays oldest-to-newest',
    async () => {
      const { io, room } = await sendMessageWithHistory(
        [1, 2, 3, 4].map(createMessage),
        'Message 5',
      );

      assert.deepEqual(
        room.chatMessages.map((message) => message.text),
        ['Existing 1', 'Existing 2', 'Existing 3', 'Existing 4', 'Message 5'],
      );
      assert.equal(io.emissions.find((entry) => entry.event === 'table:chat:message').payload.chatMessage.text, 'Message 5');
    },
  ],
  [
    'sendTableChatMessage keeps the latest 100 messages when appending',
    async () => {
      const { room } = await sendMessageWithHistory(
        Array.from({ length: 100 }, (_, index) => createMessage(index + 1)),
        'Message 101',
      );

      assert.equal(room.chatMessages.length, 100);
      assert.equal(room.chatMessages.at(0).text, 'Existing 2');
      assert.equal(room.chatMessages.at(-1).text, 'Message 101');
    },
  ],
];

(async () => {
  let failures = 0;

  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
})();
