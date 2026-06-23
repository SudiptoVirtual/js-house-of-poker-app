const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { mockColors } = require('./mockTheme');

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

function createStatefulReact() {
  const values = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  return {
    react: {
      ...require('react'),
      useMemo: (factory) => factory(),
      useRef: (initial) => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (value) => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
      },
    },
    reset: () => {
      cursor = 0;
      refCursor = 0;
    },
  };
}

function findElements(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) findElements(child, predicate, matches);
  return matches;
}

test('FeedPostCard can expose Invite to Table for standard feed posts', () => {
  const state = createStatefulReact();
  function FeedActionBar(props) { return { type: FeedActionBar, props }; }
  const { FeedPostCard } = compileComponent('../src/components/feed/FeedPostCard.tsx', {
    react: state.react,
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      Alert: { alert() {} },
      Dimensions: { get: () => ({ height: 640, width: 320 }) },
      Modal: 'Modal',
      Pressable: 'Pressable',
      StyleSheet: { absoluteFill: { position: 'absolute' }, create: (styles) => styles },
      Text: 'Text',
      TextInput: 'TextInput',
      View: 'View',
    },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: mockColors },
    './FeedActionBar': { FeedActionBar },
    './FeedPlayerHeader': { FeedPlayerHeader: () => null },
    './FeedMediaGallery': { FeedMediaGallery: () => null },
  });
  const inviteCalls = [];
  const noop = () => {};
  const tree = FeedPostCard({
    canInviteToTable: true,
    post: {
      id: '507f1f77bcf86cd799439011',
      player: { id: 'player-1' },
      postKind: 'standard',
      postType: 'text',
      content: 'post',
      timestamp: '',
      media: [],
      supportersCount: 0,
      commentCount: 0,
      shareCount: 0,
      isPromoted: false,
    },
    onComment: noop,
    onDeleteComment: noop,
    onDeletePost: noop,
    onFetchComments: noop,
    onInviteToTable: (post) => inviteCalls.push(post.id),
    onJoinTable: noop,
    onOpenProfile: noop,
    onPromote: noop,
    onShare: noop,
    onSupportChange: noop,
    onUpdateComment: noop,
    onUpdatePost: noop,
  });
  const actionBar = findElements(tree, (element) => element.type === FeedActionBar)[0];

  assert.equal(actionBar.props.canInviteToTable, true);
  assert.equal(actionBar.props.canJoinTable, false);

  actionBar.props.onInviteToTable();
  assert.deepEqual(inviteCalls, ['507f1f77bcf86cd799439011']);
});
