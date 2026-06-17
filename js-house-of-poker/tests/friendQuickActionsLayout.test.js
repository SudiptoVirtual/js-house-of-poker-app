const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const MIN_SUPPORTED_VIEWPORT_WIDTH = 320;

function compileComponent(relativePath, mocks) {
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

function findElements(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) findElements(child, predicate, matches);
  return matches;
}

function flattenStyle(style) {
  return (Array.isArray(style) ? style : [style]).filter(Boolean).reduce((result, item) => ({ ...result, ...item }), {});
}

function ActionButton() {}
function FriendQuickActions() {}
function InviteToChatButton() {}
function InviteToTableButton() {}

const reactNativeMock = {
  Animated: {
    loop: () => ({ start() {}, stop() {} }),
    sequence: () => ({}),
    spring: () => ({ start() {} }),
    timing: () => ({}),
    Value: class Value {},
    View: 'Animated.View',
  },
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { absoluteFillObject: {}, create: (styles) => styles },
  Text: 'Text',
  View: 'View',
};

function loadFriendQuickActions(confirmRemoveFriend = () => {}) {
  return compileComponent('../src/components/friends/FriendQuickActions.tsx', {
    react: { ...require('react'), useState: () => [null, () => {}] },
    'react-native': reactNativeMock,
    '../ActionButton': { ActionButton },
    '../confirmDestructiveAction': { confirmRemoveFriend },
    './InviteToChatButton': { InviteToChatButton },
    './InviteToTableButton': { InviteToTableButton },
    './SendFriendRequestButton': { SendFriendRequestButton: () => null },
  }).FriendQuickActions;
}

const requestPlayer = {
  activityStatus: 'online', displayName: 'Sam Sender', id: 'sender-1', isOnline: false,
  relationshipStatus: 'request_received', username: 'sam',
};

function renderRequestActions(onRespondToRequest = () => {}) {
  const QuickActions = loadFriendQuickActions();
  return QuickActions({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {}, onRespondToRequest,
    onSendFriendRequest: () => {}, onStartDirectChat: () => {}, onViewProfile: () => {}, player: requestPlayer, showFriendRequestAction: true,
  });
}

function renderFriendActions() {
  const QuickActions = loadFriendQuickActions();
  return QuickActions({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {}, onRemoveFriend: () => {},
    onSendFriendRequest: () => {}, onStartDirectChat: () => {}, onViewProfile: () => {},
    player: { ...requestPlayer, relationshipStatus: 'friend' },
  });
}

test('an offline friend renders distinct direct chat and chat-room invite actions without online-only table invites', () => {
  const tree = renderFriendActions();
  const removeActions = findElements(tree, (element) => element.type === ActionButton && element.props.label === 'Remove friend');
  const directChatActions = findElements(tree, (element) => element.type === ActionButton && element.props.label === 'Chat');
  const chatRoomInviteActions = findElements(tree, (element) => element.type === InviteToChatButton);

  assert.equal(removeActions.length, 1);
  assert.equal(directChatActions.length, 1);
  assert.equal(chatRoomInviteActions.length, 1);
  assert.equal(chatRoomInviteActions[0].props.label, 'Chat Invite');
  assert.equal(directChatActions[0].props.fullWidth, true);
  assert.deepEqual(directChatActions[0].props.containerStyle, { flex: 1, minWidth: 0 });
  assert.equal(chatRoomInviteActions[0].props.fullWidth, undefined);
  assert.deepEqual(chatRoomInviteActions[0].props.containerStyle, { flex: 1, minWidth: 0 });
  assert.notEqual(directChatActions[0].props.onPress, chatRoomInviteActions[0].props.onPress);
  assert.equal(findElements(tree, (element) => element.type === InviteToTableButton).length, 0);
});

test('an online friend renders direct chat, chat-room invite, and table invite actions', () => {
  const QuickActions = loadFriendQuickActions();
  const friend = { ...requestPlayer, isOnline: true, relationshipStatus: 'friend' };
  const tree = QuickActions({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {}, onRemoveFriend: () => {},
    onSendFriendRequest: () => {}, onStartDirectChat: () => {}, onViewProfile: () => {}, player: friend,
  });
  const directChatActions = findElements(tree, (element) => element.type === ActionButton && element.props.label === 'Chat');
  const chatRoomInviteActions = findElements(tree, (element) => element.type === InviteToChatButton);

  assert.equal(directChatActions.length, 1);
  assert.equal(chatRoomInviteActions.length, 1);
  assert.equal(chatRoomInviteActions[0].props.label, 'Chat Invite');
  assert.equal(directChatActions[0].props.fullWidth, true);
  assert.deepEqual(directChatActions[0].props.containerStyle, { flex: 1, minWidth: 0 });
  assert.equal(chatRoomInviteActions[0].props.fullWidth, undefined);
  assert.deepEqual(chatRoomInviteActions[0].props.containerStyle, { flex: 1, minWidth: 0 });
  assert.notEqual(directChatActions[0].props.onPress, chatRoomInviteActions[0].props.onPress);
  assert.equal(findElements(tree, (element) => element.type === InviteToTableButton).length, 1);
});

test('Remove friend waits for destructive confirmation before invoking the removal handler', () => {
  const confirmationCalls = [];
  const removalCalls = [];
  const QuickActions = loadFriendQuickActions((friendName, onConfirm) => confirmationCalls.push({ friendName, onConfirm }));
  const friend = { ...requestPlayer, relationshipStatus: 'friend' };
  const tree = QuickActions({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {},
    onRemoveFriend: (player) => removalCalls.push(player.id), onSendFriendRequest: () => {},
    onStartDirectChat: () => {}, onViewProfile: () => {}, player: friend,
  });
  const removeAction = findElements(tree, (element) => element.type === ActionButton && element.props.label === 'Remove friend')[0];

  removeAction.props.onPress();
  assert.equal(confirmationCalls[0].friendName, 'Sam Sender');
  assert.deepEqual(removalCalls, []);

  confirmationCalls[0].onConfirm();
  assert.deepEqual(removalCalls, ['sender-1']);
});

test('a friend returned through player search exposes the forwarded Remove friend action', () => {
  const QuickActions = loadFriendQuickActions();
  const onRemoveFriend = () => {};
  const searchFriend = { ...requestPlayer, relationshipStatus: 'friend' };
  const { PlayerSearchResultCard } = compileComponent('../src/components/friends/PlayerSearchResultCard.tsx', {
    'react-native': reactNativeMock,
    '../../theme/colors': { colors: {} },
    './FriendQuickActions': { FriendQuickActions: QuickActions },
    './PlayerAvatar': { PlayerAvatar: () => null },
    './PlayerStatusBadge': { PlayerStatusBadge: () => null },
    './RelationshipStatusBadge': { RelationshipStatusBadge: () => null },
  });
  const card = PlayerSearchResultCard({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {}, onRemoveFriend,
    onRespondToRequest: () => {}, onSendFriendRequest: () => {}, onStartDirectChat: () => {}, onViewProfile: () => {}, player: searchFriend,
  });
  const quickActionsElement = findElements(card, (element) => element.type === QuickActions)[0];
  const quickActions = QuickActions(quickActionsElement.props);
  const removeActions = findElements(quickActions, (element) => element.type === ActionButton && element.props.label === 'Remove friend');

  assert.equal(quickActionsElement.props.onRemoveFriend, onRemoveFriend);
  assert.equal(removeActions.length, 1);
});

test('Accept and Decline render as equal-width side-by-side request actions at the minimum viewport width', () => {
  const tree = renderRequestActions();
  const requestButtons = findElements(tree, (element) => element.type === ActionButton && ['Accept', 'Decline'].includes(element.props.label));
  const requestRow = findElements(tree, (element) => {
    const style = flattenStyle(element.props?.style);
    return element.type === 'View' && style.flexDirection === 'row' && style.gap === 8;
  }).at(-1);

  assert.deepEqual(requestButtons.map((button) => button.props.label), ['Accept', 'Decline']);
  assert.ok(requestRow, 'request actions use a dedicated horizontal row');
  const cardInnerWidth = MIN_SUPPORTED_VIEWPORT_WIDTH - (14 * 2);
  assert.equal((cardInnerWidth - requestRow.props.style.gap) / 2, 142);

  for (const button of requestButtons) {
    assert.equal(button.props.fullWidth, undefined);
    assert.equal(button.props.compact, true);
    assert.deepEqual(button.props.containerStyle, { flex: 1, minWidth: 0 });
    assert.equal(typeof button.props.onPress, 'function', `${button.props.label} remains pressable`);
  }
});

test('Decline keeps the existing reject API response internally', () => {
  const responses = [];
  const tree = renderRequestActions((_player, response) => responses.push(response));
  const decline = findElements(tree, (element) => element.type === ActionButton && element.props.label === 'Decline')[0];
  decline.props.onPress();
  assert.deepEqual(responses, ['reject']);
});

test('compact ActionButton content can shrink without label or icon overflow', () => {
  const react = require('react');
  const { ActionButton: RealActionButton } = compileComponent('../src/components/ActionButton.tsx', {
    react: { ...react, useEffect: () => {}, useMemo: (factory) => factory(), useRef: (value) => ({ current: value }) },
    'react-native': reactNativeMock,
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '@expo/vector-icons': { MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) },
    '../theme/colors': { colors: { border: '#000', text: '#fff' } },
  });
  const tree = RealActionButton({ compact: true, icon: 'account-cancel-outline', label: 'Decline', onPress: () => {} });
  const pressable = findElements(tree, (element) => element.type === 'Pressable')[0];
  const content = findElements(tree, (element) => element.type === 'View')[0];
  const label = findElements(tree, (element) => element.type === 'Text')[0];

  assert.equal(flattenStyle(pressable.props.style({ pressed: false })).minWidth, 0);
  assert.equal(flattenStyle(content.props.style).minWidth, 0);
  assert.equal(flattenStyle(label.props.style).flexShrink, 1);
});

test('PlayerSearchResultCard preserves the expected narrow-width content area', () => {
  const { PlayerSearchResultCard } = compileComponent('../src/components/friends/PlayerSearchResultCard.tsx', {
    'react-native': reactNativeMock,
    '../../theme/colors': { colors: {} },
    './FriendQuickActions': { FriendQuickActions },
    './PlayerAvatar': { PlayerAvatar: () => null },
    './PlayerStatusBadge': { PlayerStatusBadge: () => null },
    './RelationshipStatusBadge': { RelationshipStatusBadge: () => null },
  });
  const card = PlayerSearchResultCard({
    hasActiveTable: false, onInviteToChatRoom: () => {}, onInviteToTable: () => {}, onRespondToRequest: () => {},
    onSendFriendRequest: () => {}, onStartDirectChat: () => {}, onViewProfile: () => {}, player: requestPlayer,
  });

  assert.equal(card.props.style.padding, 14);
  assert.equal(MIN_SUPPORTED_VIEWPORT_WIDTH - (card.props.style.padding * 2), 292);
});
