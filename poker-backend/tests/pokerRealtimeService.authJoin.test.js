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
