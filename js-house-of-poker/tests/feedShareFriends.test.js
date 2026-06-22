const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function find(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) find(child, predicate, matches);
  return matches;
}

function loadShareMenu(onShare = () => {}) {
  const state = [];
  let cursor = 0;
  const react = {
    ...require('react'),
    useEffect: (effect) => effect(),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
  };
  const rn = {
    ActivityIndicator: 'ActivityIndicator',
    Modal: 'Modal',
    Pressable: 'Pressable',
    StyleSheet: { create: (styles) => styles },
    Text: 'Text',
    View: 'View',
  };
  const filename = path.resolve(__dirname, '../src/components/feed/ShareMenu.tsx');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = compiled.require.bind(compiled);
  const mocks = {
    react,
    'react-native': rn,
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: {} },
  };
  compiled.require = (request) => Object.hasOwn(mocks, request) ? mocks[request] : original(request);
  compiled._compile(output, filename);
  return {
    render: () => {
      cursor = 0;
      return compiled.exports.ShareMenu({
        chatRoomOptions: [],
        friendOptions: [{ id: 'friend-1', label: 'Ada Lovelace' }],
        onClose() {},
        onPromote() {},
        onShare,
        post: { player: { name: 'Player One' } },
        tableOptions: [],
        visible: true,
      });
    },
  };
}

test('friend share is typed as a backend destination', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/types/feed.ts'), 'utf8');
  assert.match(source, /BackendShareDestinationId = .*'friends'/s);
  assert.match(source, /backendShareDestinations[\s\S]*'friends'/);
});

test('ShareMenu renders compact friend buttons and emits a direct friend share selection', async () => {
  let selection;
  const menu = loadShareMenu((nextSelection) => { selection = nextSelection; });
  const tree = menu.render();
  assert.ok(find(tree, (element) => element.type === 'Text' && element.props?.children === 'Friends').length > 0);
  const friendButton = find(tree, (element) => element.type === 'Pressable' && element.props?.children?.some?.((child) => child?.props?.children === 'Ada Lovelace'))[0];
  assert.ok(friendButton);
  await friendButton.props.onPress();
  assert.deepEqual(selection, { destinationId: 'friends', targetUserId: 'friend-1' });
});

test('PlayerFeedScreen saves friend shares with friend target identifiers and metadata', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/PlayerFeedScreen.tsx'), 'utf8');
  assert.match(source, /fetchFriends\(session\.token\)/);
  assert.match(source, /destinationId === 'friends'[\s\S]*targetUserId: selection\.targetUserId/);
  assert.match(source, /targetId: selection\.targetUserId[\s\S]*targetType: 'friend'/);
  assert.match(source, /metadata: \{[\s\S]*deepLink: buildFeedPostDeepLink\(targetPost\.id\)[\s\S]*postUrl: buildFeedPostUrl\(targetPost\.id\)/);
});
