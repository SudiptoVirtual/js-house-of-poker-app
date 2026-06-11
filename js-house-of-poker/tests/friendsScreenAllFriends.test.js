const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function compileTypeScript(relativePath, mocks = {}) {
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

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}

test('the all-friends section includes accepted friends regardless of presence and provides removal', () => {
  const onlineFriend = {
    activityStatus: 'online', displayName: 'Online Friend', id: 'friend-online', isOnline: true,
    relationshipStatus: 'friend', username: 'online',
  };
  const offlineFriend = {
    activityStatus: 'offline', displayName: 'Offline Friend', id: 'friend-offline', isOnline: false,
    relationshipStatus: 'friend', username: 'offline',
  };
  const PlayerSearchResultsList = () => null;
  const react = require('react');
  const stateInitializers = [[onlineFriend, offlineFriend], [], '', null, false];
  let stateIndex = 0;
  const { FriendsScreen } = compileTypeScript('../src/screens/FriendsScreen.tsx', {
    react: {
      ...react,
      useCallback: (callback) => callback,
      useEffect: () => {},
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value }),
      useState: (initialValue) => [stateInitializers[stateIndex++] ?? initialValue, () => {}],
    },
    'react-native': { StyleSheet: { create: (styles) => styles }, Text: 'Text' },
    '../components/friends/FriendsHeader': { FriendsHeader: () => null },
    '../components/friends/PlayerSearchInput': { PlayerSearchInput: () => null },
    '../components/friends/PlayerSearchResultsList': { PlayerSearchResultsList },
    '../components/Screen': { Screen: 'Screen' },
    '../components/SectionCard': { SectionCard: 'SectionCard' },
    '../constants/routes': { routes: {} },
    '../context/AuthProvider': { useAuth: () => ({ currentUser: null, token: 'token-1' }) },
    '../context/FriendNotificationProvider': { useFriendNotifications: () => ({ events: [], pendingRequests: [], reconcilePendingRequests: () => {} }) },
    '../context/PokerProvider': { usePoker: () => ({ roomState: null, sendTableInvite: async () => {} }) },
    '../services/api': { getApiErrorDetails: () => ({ message: 'error' }) },
    '../services/api/chatRooms': { createChatRoom: async () => ({ room: { id: 'room-1' } }) },
    '../services/friends/friendRealtimeService': { friendRealtimeEvents: {} },
    '../services/friends/mergeFriendRealtimeEvent': {},
    '../theme/colors': { colors: {} },
  });

  const screen = FriendsScreen({ navigation: { navigate: () => {} } });
  const allFriends = findElement(screen, (element) => element.type === PlayerSearchResultsList);

  assert.deepEqual(allFriends.props.players.map((player) => player.id), ['friend-online', 'friend-offline']);
  assert.equal(typeof allFriends.props.onRemoveFriend, 'function');
});
