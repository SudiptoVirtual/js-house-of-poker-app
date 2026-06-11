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

test('pressing Chat Invite creates a private room with the friend and navigates to it', async () => {
  const apiCalls = [];
  const navigationCalls = [];
  const { createChatRoom } = compileTypeScript('../src/services/api/chatRooms.ts', {
    '../../config/env': { env: { apiBaseUrl: 'https://example.test' } },
    './client': {
      ApiError: class ApiError extends Error {},
      apiRequest: async (route, options) => {
        apiCalls.push([route, options]);
        return { invitedPlayerIds: ['friend-1'], room: { id: 'room-9', name: options.body.name } };
      },
    },
  });
  const OnlineFriendsList = (props) => ({
    props: { accessibilityLabel: 'Chat Invite', onPress: () => props.onInviteToChat(props.players[0]) },
    type: 'Pressable',
  });
  const friend = {
    activityStatus: 'online', displayName: 'Bob Friend', id: 'friend-1', isOnline: true,
    relationshipStatus: 'friend', username: 'bob',
  };
  const react = require('react');
  const stateInitializers = [[friend], [], [], '', null, false];
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
    '../components/friends/OnlineFriendsList': { OnlineFriendsList },
    '../components/friends/PlayerSearchInput': { PlayerSearchInput: () => null },
    '../components/friends/PlayerSearchResultsList': { PlayerSearchResultsList: () => null },
    '../components/Screen': { Screen: 'Screen' },
    '../components/SectionCard': { SectionCard: 'SectionCard' },
    '../constants/routes': { routes: { ChatRoomDetail: 'ChatRoomDetail' } },
    '../context/AuthProvider': { useAuth: () => ({ currentUser: { name: 'Alice Player' }, token: 'token-1' }) },
    '../context/FriendNotificationProvider': { useFriendNotifications: () => ({ events: [] }) },
    '../context/PokerProvider': { usePoker: () => ({ roomState: null, sendTableInvite: async () => {} }) },
    '../services/api': { getApiErrorDetails: () => ({ message: 'error' }) },
    '../services/api/chatRooms': { createChatRoom },
    '../services/friends/friendRealtimeService': { friendRealtimeEvents: {} },
    '../services/friends/mergeFriendRealtimeEvent': {},
    '../theme/colors': { colors: {} },
  });

  const screen = FriendsScreen({ navigation: { navigate: (...args) => navigationCalls.push(args) } });
  const onlineFriends = findElement(screen, (element) => element.type === OnlineFriendsList);
  const chatInviteButton = OnlineFriendsList(onlineFriends.props);

  await chatInviteButton.props.onPress();

  assert.deepEqual(apiCalls, [['/api/chat-rooms', {
    body: { invitedPlayerIds: ['friend-1'], name: 'Alice Player & Bob Friend' },
    method: 'POST',
    token: 'token-1',
  }]]);
  assert.deepEqual(navigationCalls, [['ChatRoomDetail', { roomId: 'room-9' }]]);
});
