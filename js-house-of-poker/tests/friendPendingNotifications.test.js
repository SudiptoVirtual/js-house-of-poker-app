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

const mergeHelpers = loadTypeScriptModule('../src/services/friends/mergeFriendRealtimeEvent.ts');

const request = {
  activityStatus: 'offline', displayName: 'Sam Sender', id: 'sender-1', isOnline: false,
  relationshipStatus: 'request_received', requestId: 'request-1', username: 'sam',
};
const realtimePayload = {
  otherUser: { email: 'new@example.test', id: 'sender-2', name: 'New Sender' },
  requestId: 'request-2',
};

function createProviderHarness() {
  let token = 'session-token';
  let contextValue;
  let realtimeOptions;
  let fetchedRequests = [request];
  let fetchCalls = 0;
  let hookIndex = 0;
  let effectIndex = 0;
  const states = [];
  const refs = [];
  const callbacks = [];
  const effects = [];
  const depsEqual = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const react = {
    createContext: () => ({ Provider: ({ children, value }) => { contextValue = value; return children; } }),
    useCallback: (callback, deps) => {
      const index = hookIndex++;
      if (!callbacks[index] || !depsEqual(callbacks[index].deps, deps)) callbacks[index] = { callback, deps };
      return callbacks[index].callback;
    },
    useContext: () => null,
    useEffect: (effect, deps) => {
      const index = effectIndex++;
      if (!effects[index] || !depsEqual(effects[index].deps, deps)) {
        effects[index]?.cleanup?.();
        effects[index] = { cleanup: effect(), deps };
      }
    },
    useMemo: (factory) => factory(),
    useRef: (initial) => {
      const index = hookIndex++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = hookIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
  };
  const { FriendNotificationProvider } = loadTypeScriptModule('../src/context/FriendNotificationProvider.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => typeof type === 'function' ? type(props) : ({ props, type }) },
    './AuthProvider': { useAuth: () => ({ token }) },
    '../services/api/friends': { fetchIncomingFriendRequests: async () => { fetchCalls += 1; return fetchedRequests; } },
    '../services/friends/mergeFriendRealtimeEvent': mergeHelpers,
    '../services/friends/friendRealtimeService': {
      friendRealtimeEvents: { requestAccepted: 'accepted', requestDeclined: 'declined', requestReceived: 'received' },
      subscribeFriendRealtime: (options) => { realtimeOptions = options; return () => {}; },
    },
  });
  const render = () => {
    hookIndex = 0;
    effectIndex = 0;
    FriendNotificationProvider({ children: 'child' });
    return contextValue;
  };
  return {
    fetchCalls: () => fetchCalls,
    options: () => realtimeOptions,
    render,
    setFetchedRequests: (requests) => { fetchedRequests = requests; },
    setToken: (nextToken) => { token = nextToken; },
  };
}

test('provider loads pending requests, merges realtime receipts by request ID, and removes accepted or declined requests', async () => {
  const harness = createProviderHarness();
  harness.render();
  await Promise.resolve();
  let value = harness.render();
  assert.equal(value.pendingRequestCount, 1);

  harness.options().onEvent(realtimePayload, 'received');
  harness.options().onEvent(realtimePayload, 'received');
  value = harness.render();
  assert.equal(value.pendingRequestCount, 2, 'duplicate request IDs count once');

  harness.options().onEvent({ requestId: 'request-2' }, 'accepted');
  value = harness.render();
  assert.deepEqual(value.pendingRequests.map(({ requestId }) => requestId), ['request-1']);

  harness.options().onEvent({ requestId: 'request-1' }, 'declined');
  assert.equal(harness.render().pendingRequestCount, 0);
});

test('provider resets on logout and reconciles pending requests after reconnect', async () => {
  const harness = createProviderHarness();
  harness.render();
  await Promise.resolve();
  harness.render();
  harness.setFetchedRequests([{ ...request, id: 'sender-3', requestId: 'request-3' }]);
  harness.options().onReconnect();
  await Promise.resolve();
  assert.deepEqual(harness.render().pendingRequests.map(({ requestId }) => requestId), ['request-3']);
  assert.equal(harness.fetchCalls(), 2);

  harness.setToken(null);
  harness.render();
  assert.equal(harness.render().pendingRequestCount, 0);
});

test('friends navigation badge uses the existing capped badge label', () => {
  const { MainPlatformNavigation } = loadTypeScriptModule('../src/components/navigation/MainPlatformNavigation.tsx', {
    '@expo/vector-icons': { MaterialCommunityIcons: () => null },
    '@react-navigation/native': { useNavigation: () => ({ navigate: () => {} }), useRoute: () => ({ name: 'Home' }) },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: (styles) => styles }, Text: 'Text', View: 'View' },
    '../../constants/routes': { routes: { ChatRoomDetail: 'ChatRoomDetail', ChatRooms: 'ChatRooms', Feed: 'Feed', Friends: 'Friends', Home: 'Home', Profile: 'Profile' } },
    '../../context/ChatNotificationProvider': { useChatNotifications: () => ({ totalUnreadMessageCount: 0 }) },
    '../../context/FeedNotificationProvider': { useFeedNotifications: () => ({ unreadCount: 0 }) },
    '../../context/FriendNotificationProvider': { useFriendNotifications: () => ({ pendingRequestCount: 12 }) },
    '../../theme/colors': { colors: {} },
  });
  assert.match(JSON.stringify(MainPlatformNavigation()), /9\+/);
});

test('friend realtime subscription requests reconciliation only after a reconnect', () => {
  let connectionHandler;
  let reconnectCalls = 0;
  let connectionUnsubscribeCalls = 0;
  const socketManager = {
    connect: async () => {},
    destroy: () => {},
    on: () => () => {},
    onConnection: (handler) => { connectionHandler = handler; return () => { connectionUnsubscribeCalls += 1; }; },
    setAuth: () => {},
  };
  const { subscribeFriendRealtime } = loadTypeScriptModule('../src/services/friends/friendRealtimeService.ts', {
    '../../config/env': { env: { poker: { socketUrl: 'https://socket.example.test' } } },
    '../socket/socketManager': { createSocketManager: () => socketManager },
  });
  const cleanup = subscribeFriendRealtime({
    onEvent: () => {}, onReconnect: () => { reconnectCalls += 1; }, token: 'session-token',
  });

  connectionHandler({ status: 'connected' });
  assert.equal(reconnectCalls, 0);
  connectionHandler({ status: 'disconnected' });
  connectionHandler({ status: 'connected' });
  assert.equal(reconnectCalls, 1);
  cleanup();
  assert.equal(connectionUnsubscribeCalls, 1);
});
