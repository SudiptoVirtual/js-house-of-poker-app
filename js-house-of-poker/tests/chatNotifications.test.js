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

const helpers = loadTypeScriptModule('../src/services/chatRooms/chatNotifications.ts');
const messagePayload = {
  message: { authorName: 'Sam Sender', body: 'Shuffle up?', id: 'message-1', roomId: 'room-1' },
  notification: { data: { roomName: 'Friday Night', senderDisplayName: 'Sam Sender' }, id: 'notification-1', messageId: 'message-1' },
  roomId: 'room-1',
  type: 'chat_message',
  unreadCount: 3,
};
const invitePayload = {
  notification: { body: 'Alex invited you.', data: { roomName: 'High Rollers', senderDisplayName: 'Alex' }, id: 'invite-1' },
  room: { title: 'High Rollers' },
  roomId: 'room-2',
  senderPlayerName: 'Alex',
  type: 'chat_room_invite',
};

test('real-time message and room-invite payloads normalize into banner content', () => {
  assert.deepEqual(helpers.normalizeChatNotification(messagePayload), {
    body: 'Shuffle up?', dedupeKey: 'notification:notification-1', id: 'notification-1', roomId: 'room-1', roomName: 'Friday Night', senderName: 'Sam Sender', type: 'chat_message',
  });
  assert.equal(helpers.normalizeChatNotification(invitePayload).roomName, 'High Rollers');
  assert.equal(helpers.normalizeChatNotification(invitePayload).senderName, 'Alex');
});

test('persisted notification IDs and message IDs deduplicate queued banners without replacing earlier arrivals', () => {
  const first = helpers.normalizeChatNotification(messagePayload);
  const second = helpers.normalizeChatNotification(invitePayload);
  const duplicateViaOtherEvent = helpers.normalizeChatNotification({ ...invitePayload, type: undefined, notification: { ...invitePayload.notification, type: 'chat_room_invite' } });
  const queue = helpers.enqueueChatNotification(helpers.enqueueChatNotification([], first), second);

  assert.deepEqual(queue.map(({ id }) => id), ['notification-1', 'invite-1']);
  assert.equal(helpers.enqueueChatNotification(queue, duplicateViaOtherEvent), queue);
});

test('message banners are suppressed in the currently open room while unread state resolves to zero', () => {
  const notification = helpers.normalizeChatNotification(messagePayload);

  assert.equal(helpers.shouldShowChatNotification(notification, 'room-1'), false);
  assert.equal(helpers.getNextChatUnreadCount(7, messagePayload.unreadCount, true), 0);
  assert.equal(helpers.shouldShowChatNotification(notification, 'room-elsewhere'), true);
  assert.equal(helpers.getNextChatUnreadCount(2, undefined, false), 3);
});

test('room invitations remain visible even while their room is open', () => {
  const notification = helpers.normalizeChatNotification(invitePayload);
  assert.equal(helpers.shouldShowChatNotification(notification, 'room-2'), true);
});

test('chat banner Open action clears the current banner and navigates to its ChatRoomDetail', () => {
  const navigationCalls = [];
  let clearCalls = 0;
  const banner = helpers.normalizeChatNotification(messagePayload);
  const { ChatNotificationBanner } = loadTypeScriptModule('../src/components/notifications/ChatNotificationBanner.tsx', {
    '@expo/vector-icons': { MaterialCommunityIcons: 'MaterialCommunityIcons' },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => navigationCalls.push(args) }) },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: (styles) => styles }, Text: 'Text', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../constants/routes': { routes: { ChatRoomDetail: 'ChatRoomDetail' } },
    '../../context/ChatNotificationProvider': { useChatNotifications: () => ({ banner, clearBanner: () => { clearCalls += 1; }, queueLength: 1 }) },
    '../../theme/colors': { colors: {} },
  });
  const tree = ChatNotificationBanner();
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
    return children.map((child) => find(child, predicate)).find(Boolean) ?? null;
  };
  const open = find(tree, (node) => node.type === 'Pressable' && find(node, (child) => child.props?.children === 'Open'));

  open.props.onPress();
  assert.equal(clearCalls, 1);
  assert.deepEqual(navigationCalls, [['ChatRoomDetail', { roomId: 'room-1' }]]);
});

test('global provider authenticates one session socket and subscribes to both chat notification events', async () => {
  const subscriptions = [];
  const authCalls = [];
  let connectCalls = 0;
  let destroyCalls = 0;
  let cleanup;
  const socketManager = {
    connect: async () => { connectCalls += 1; },
    destroy: () => { destroyCalls += 1; },
    on: (eventName) => { subscriptions.push(eventName); return () => {}; },
    setAuth: (auth) => authCalls.push(auth),
  };
  const { ChatNotificationProvider } = loadTypeScriptModule('../src/context/ChatNotificationProvider.tsx', {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useCallback: (callback) => callback,
      useContext: () => null,
      useEffect: (effect) => { cleanup = effect(); },
      useMemo: (factory) => factory(),
      useRef: (current) => ({ current }),
      useState: (initial) => [initial, () => {}],
    },
    '../config/env': { env: { poker: { socketUrl: 'https://socket.example.test' } } },
    './AuthProvider': { useAuth: () => ({ token: 'session-token' }) },
    '../services/chatRooms/chatNotifications': helpers,
    '../services/chatRooms/events': { chatRoomSocketEvents: { messageNotification: 'chat:messageNotification', roomInvited: 'chat:roomInvited' } },
    '../services/socket/socketManager': { createSocketManager: () => socketManager },
  });

  ChatNotificationProvider({ children: 'child' });
  await Promise.resolve();

  assert.deepEqual(authCalls, [{ token: 'session-token' }]);
  assert.deepEqual(subscriptions, ['chat:messageNotification', 'chat:roomInvited']);
  assert.equal(connectCalls, 1);
  cleanup();
  assert.equal(destroyCalls, 1);
});
