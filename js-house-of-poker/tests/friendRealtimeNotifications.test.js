const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadHelpers() {
  const filename = path.resolve(__dirname, '../src/services/friends/mergeFriendRealtimeEvent.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = new Module(filename, module);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule._compile(output, filename);
  return compiledModule.exports;
}

const { buildFriendRequestBanner, mergeIncomingFriendRequest } = loadHelpers();
const payload = {
  otherUser: { email: 'sam@example.test', id: 'sender-1', name: 'Sam Sender' },
  request: { id: 'request-1' },
  requestId: 'request-1',
  status: 'pending_received',
};

test('a received friend request produces the recipient toast content', () => {
  assert.deepEqual(buildFriendRequestBanner(payload), { id: 'request-1', senderName: 'Sam Sender' });
});

test('Friends screen realtime merge inserts an incoming request immediately and deduplicates by request id', () => {
  const first = mergeIncomingFriendRequest([], payload);
  const duplicate = mergeIncomingFriendRequest(first, payload);

  assert.equal(first[0].relationshipStatus, 'request_received');
  assert.equal(first[0].requestId, 'request-1');
  assert.equal(duplicate.length, 1);
});
