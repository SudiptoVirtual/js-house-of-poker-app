const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadTypeScriptModule(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

const helpers = loadTypeScriptModule('../src/components/navigation/platformNavigation.ts', {
  '../../constants/routes': {
    routes: {
      ChatRoomDetail: 'ChatRoomDetail',
      ChatRooms: 'ChatRooms',
      Feed: 'Feed',
      Friends: 'Friends',
      Home: 'Home',
      Profile: 'Profile',
    },
  },
});

test('platform swipe routes follow Lobby, Chats, Feed, Friends, Profile', () => {
  assert.deepEqual(helpers.platformSwipeRoutes, ['Home', 'ChatRooms', 'Feed', 'Friends', 'Profile']);
});

test('swiping forward from Lobby reaches Chats, then Feed', () => {
  const chats = helpers.getAdjacentPlatformRoute('Home', 'next');
  const feed = helpers.getAdjacentPlatformRoute(chats, 'next');

  assert.equal(chats, 'ChatRooms');
  assert.equal(feed, 'Feed');
});

test('ChatRoomDetail keeps Chats as the active bottom tab without joining the swipe sequence directly', () => {
  assert.equal(helpers.getPlatformActiveRoute('ChatRoomDetail'), 'ChatRooms');
  assert.equal(helpers.isPlatformRouteActive('ChatRoomDetail', 'ChatRooms'), true);
  assert.equal(helpers.isPlatformRouteActive('ChatRoomDetail', 'Feed'), false);
  assert.equal(helpers.getAdjacentPlatformRoute('ChatRoomDetail', 'next'), null);
});
