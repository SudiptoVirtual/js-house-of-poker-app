const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = new Module(filename, module);
  const originalLoad = compiledModule.require.bind(compiledModule);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : originalLoad(request);
  compiledModule._compile(output, filename);
  return compiledModule.exports;
}

const { toChatRoom } = loadTypeScriptModule('../src/services/api/chatRooms.ts', {
  '../../config/env': { env: { apiBaseUrl: 'http://example.test' } },
  './client': { ApiError: class ApiError extends Error {}, apiRequest: async () => ({}) },
});

test('normalizes private-member, private-creator, and public-visitor membership capabilities', () => {
  const privateMember = toChatRoom({ canLeave: true, id: 'private-member', isCreator: false, isMember: true });
  const privateCreator = toChatRoom({ canLeave: false, id: 'private-creator', isCreator: true, isMember: true });
  const publicVisitor = toChatRoom({ canLeave: false, id: 'public-room', isCreator: false, isMember: false });

  assert.deepEqual(
    [privateMember, privateCreator, publicVisitor].map(({ canLeave, isCreator, isMember }) => ({ canLeave, isCreator, isMember })),
    [
      { canLeave: true, isCreator: false, isMember: true },
      { canLeave: false, isCreator: true, isMember: true },
      { canLeave: false, isCreator: false, isMember: false },
    ],
  );
});

test('chat-room detail renders the leave action only behind canLeave', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/ChatRoomDetailScreen.tsx'), 'utf8');
  const conditionalAction = source.match(/\{room\.canLeave \? \([\s\S]*?label="Leave chat room"[\s\S]*?\) : null\}/);

  assert.ok(conditionalAction, 'Leave chat room must only render when room.canLeave is true');
});

test('direct chat detail uses a simplified non-platform-nav chat layout', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/ChatRoomDetailScreen.tsx'), 'utf8');
  const directStart = source.indexOf("if (room.chatType === 'direct')");
  const groupNavStart = source.indexOf('showPlatformNavigation', directStart);
  const directBlock = source.slice(directStart, groupNavStart);

  assert.ok(directStart > -1, 'direct chat branch must be explicit');
  assert.ok(directBlock.includes('scrollable={false}'), 'direct chat should own fixed header/list/composer layout');
  assert.ok(directBlock.includes('<FlatList'), 'direct chat should render messages in a list');
  assert.ok(directBlock.includes('variant="direct"'), 'direct chat should use the compact direct composer');
  assert.ok(directBlock.includes('Invite to a table'));
  assert.ok(directBlock.includes('Create a table'));
  assert.equal(directBlock.includes('showPlatformNavigation'), false, 'direct chat hides bottom platform navigation');
});
