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

function loadFriendQuickActions() {
  return compileComponent('../src/components/friends/FriendQuickActions.tsx', {
    react: { ...require('react'), useState: () => [null, () => {}] },
    'react-native': reactNativeMock,
    '../ActionButton': { ActionButton },
    './InviteToChatButton': { InviteToChatButton: () => null },
    './InviteToTableButton': { InviteToTableButton: () => null },
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
    hasActiveTable: false, onInviteToChat: () => {}, onInviteToTable: () => {}, onRespondToRequest,
    onSendFriendRequest: () => {}, onViewProfile: () => {}, player: requestPlayer, showFriendRequestAction: true,
  });
}

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
    hasActiveTable: false, onInviteToChat: () => {}, onInviteToTable: () => {}, onRespondToRequest: () => {},
    onSendFriendRequest: () => {}, onViewProfile: () => {}, player: requestPlayer,
  });

  assert.equal(card.props.style.padding, 14);
  assert.equal(MIN_SUPPORTED_VIEWPORT_WIDTH - (card.props.style.padding * 2), 292);
});
