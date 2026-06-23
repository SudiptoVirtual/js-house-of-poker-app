const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/components/feed/tableInviteActions.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = new Module(filename, module); compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename)); compiled._compile(output, filename);
const {
  FEED_TABLE_INVITES_REQUIRE_SOCKET_MESSAGE,
  getJoinTableErrorMessage,
  joinFeedTableInvite,
} = compiled.exports;

test('Join Table CTA uses the preserved post table code and existing join-table flow', async () => {
  const calls = [];
  const result = await joinFeedTableInvite({
    joinTable: async (input) => calls.push({ input, type: 'join' }),
    playerName: ' Viewer ',
    post: { postKind: 'table-invite', tableContext: { tableCode: ' join42 ', seatsOpen: 2 } },
  });
  assert.deepEqual(calls, [
    { input: { name: 'Viewer', tableId: 'JOIN42' }, type: 'join' },
  ]);
  assert.deepEqual(result, { tableCode: 'JOIN42', tableId: null, tableIdentifier: 'JOIN42' });
});


test('Join Table CTA can fall back to a backend-provided table id', async () => {
  const calls = [];
  const result = await joinFeedTableInvite({
    joinTable: async (input) => calls.push({ input, type: 'join' }),
    playerName: 'Viewer',
    post: { postKind: 'table-invite', tableContext: { tableId: '64f111111111111111111111', seatsOpen: 3 } },
  });
  assert.deepEqual(calls, [
    { input: { name: 'Viewer', tableId: '64f111111111111111111111' }, type: 'join' },
  ]);
  assert.deepEqual(result, { tableCode: null, tableId: '64f111111111111111111111', tableIdentifier: '64f111111111111111111111' });
});

test('Join Table CTA rejects signed-out, full, and invalid-reference invitations', async () => {
  const base = { joinTable: async () => {}, post: { postKind: 'table-invite', tableContext: { tableCode: 'JOIN42', seatsOpen: 1 } } };
  await assert.rejects(() => joinFeedTableInvite(base), /Sign in/);
  await assert.rejects(() => joinFeedTableInvite({ ...base, playerName: 'Viewer', post: { ...base.post, tableContext: { tableCode: 'JOIN42', seatsOpen: 0 } } }), /full/);
  await assert.rejects(() => joinFeedTableInvite({ ...base, playerName: 'Viewer', post: { ...base.post, tableContext: {} } }), /valid table reference/);
});

test('Join Table CTA exposes a specific message for non-socket feed invite joins', () => {
  assert.match(FEED_TABLE_INVITES_REQUIRE_SOCKET_MESSAGE, /EXPO_PUBLIC_POKER_TRANSPORT=socket/);
});

test('Join Table CTA maps missing backend table errors to invalid invitation message', () => {
  assert.equal(
    getJoinTableErrorMessage(new Error('Table not found.')),
    'This table invitation is invalid.',
  );
  assert.equal(
    getJoinTableErrorMessage(new Error('Invalid table code or table id.')),
    'This table invitation is invalid.',
  );
});
