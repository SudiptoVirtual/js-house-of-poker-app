const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function find(node, predicate, matches = []) {
  if (Array.isArray(node)) {
    for (const child of node) find(child, predicate, matches);
    return matches;
  }
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) find(child, predicate, matches);
  return matches;
}

function loadShareMenu(onShare = () => {}, friendOptions = [{ id: 'friend-1', label: 'Ada Lovelace' }]) {
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
        friendOptions,
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
  assert.ok(find(tree, (element) => element.type === 'Text' && element.props?.children === 'Send to friends').length > 0);
  const friendButton = find(tree, (element) => element.type === 'Pressable' && element.props?.children?.some?.((child) => child?.props?.children === 'Ada Lovelace'))[0];
  assert.ok(friendButton);
  await friendButton.props.onPress();
  assert.deepEqual(selection, { destinationId: 'friends', targetUserId: 'friend-1' });
});


test('ShareMenu prioritizes friends before slower share destinations', () => {
  const menu = loadShareMenu();
  const tree = menu.render();
  const orderedLabels = find(tree, (element) => element.type === 'Text')
    .map((element) => element.props?.children)
    .filter((children) => typeof children === 'string');

  const friendSectionIndex = orderedLabels.indexOf('Send to friends');
  const friendIndex = orderedLabels.indexOf('Ada Lovelace');
  const facebookIndex = orderedLabels.indexOf('Share to Facebook');
  const externalIndex = orderedLabels.indexOf('Share Externally');
  const tableIndex = orderedLabels.indexOf('Share to Table');
  const chatRoomIndex = orderedLabels.indexOf('Share to Chat Room');
  const promoteIndex = orderedLabels.indexOf('Promote for Creator');

  assert.ok(friendSectionIndex >= 0);
  assert.ok(friendIndex > friendSectionIndex);
  for (const [label, destinationIndex] of [
    ['Share to Facebook', facebookIndex],
    ['Share Externally', externalIndex],
    ['Share to Table', tableIndex],
    ['Share to Chat Room', chatRoomIndex],
    ['Promote for Creator', promoteIndex],
  ]) {
    assert.ok(destinationIndex >= 0, `${label} should be rendered`);
    assert.ok(destinationIndex > friendIndex, `${label} should appear after friends`);
  }
});


test('ShareMenu shows direct-share empty state when no friend options exist', () => {
  const menu = loadShareMenu(() => {}, []);
  const tree = menu.render();

  assert.ok(find(tree, (element) => element.type === 'Text' && element.props?.children === 'Add friends to share posts directly.').length > 0);
});

test('PlayerFeedScreen saves friend shares with friend target identifiers and metadata', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/PlayerFeedScreen.tsx'), 'utf8');
  assert.match(source, /fetchFriends\(session\.token\)/);
  assert.match(source, /destinationId === 'friends'[\s\S]*targetUserId: selection\.targetUserId/);
  assert.match(source, /targetId: selection\.targetUserId[\s\S]*targetType: 'friend'/);
  assert.match(source, /metadata: \{[\s\S]*deepLink: buildFeedPostDeepLink\(targetPost\.id\)[\s\S]*postUrl: buildFeedPostUrl\(targetPost\.id\)/);
});
