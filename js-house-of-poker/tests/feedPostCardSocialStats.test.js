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
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
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

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node === 'object') return textContent(node.props?.children);
  return '';
}

function renderFeedPostCard(props) {
  const state = createStatefulReact();
  const rn = {
    ActivityIndicator: 'ActivityIndicator',
    Alert: { alert() {} },
    Dimensions: { get: () => ({ height: 640, width: 320 }) },
    Modal: 'Modal',
    Pressable: 'Pressable',
    StyleSheet: { absoluteFill: { position: 'absolute' }, create: (styles) => styles },
    Text: 'Text',
    TextInput: 'TextInput',
    View: 'View',
  };
  const { FeedPostCard } = compileComponent('../src/components/feed/FeedPostCard.tsx', {
    react: state.react,
    'react-native': rn,
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: mockColors },
    './FeedActionBar': { FeedActionBar: () => null },
    './FeedPlayerHeader': { FeedPlayerHeader: () => null },
    './FeedMediaGallery': { FeedMediaGallery: () => null },
  });

  return {
    render: () => {
      state.reset();
      return FeedPostCard(props);
    },
  };
}

test('profile-history feed cards show social counts and open comments without poker metadata', async () => {
  const post = {
    authorUserId: 'owner',
    commentCount: 3,
    content: 'Latest table update',
    id: '507f1f77bcf86cd799439011',
    isPromoted: false,
    isTableRelated: true,
    media: [],
    player: { handle: '@owner', id: 'owner', name: 'Owner', status: 'Online' },
    postKind: 'table-invite',
    postType: 'table_invite',
    shareCount: 4,
    supportersCount: 12,
    tableContext: {
      gameLabel: "Texas Hold'em",
      seatsOpen: 2,
      tableCode: 'TABLE1',
      tableName: 'Friday Table',
    },
    timestamp: '',
  };
  const comments = [{
    authorUserId: 'viewer',
    body: 'Nice hand',
    createdAt: null,
    deletedAt: null,
    id: 'comment-1',
    isDeleted: false,
    moderationStatus: 'visible',
    parentCommentId: null,
    player: { handle: '@viewer', id: 'viewer', name: 'Viewer', status: 'Online' },
    postId: post.id,
    postKind: post.postKind,
  }];
  let fetchCount = 0;
  const noop = () => {};
  const card = renderFeedPostCard({
    currentUserId: 'owner',
    onComment: noop,
    onDeleteComment: noop,
    onDeletePost: noop,
    onFetchComments: async () => {
      fetchCount += 1;
      return { comments, post };
    },
    onGiftClips: noop,
    onJoinTable: noop,
    onOpenProfile: noop,
    onPromote: noop,
    onShare: noop,
    onSupportChange: noop,
    onUpdateComment: noop,
    onUpdatePost: noop,
    post,
    variant: 'ownerHistory',
  });

  let tree = card.render();
  const initialTexts = findElements(tree, (element) => element.type === 'Text').map(textContent);

  assert.ok(initialTexts.includes('12'));
  assert.ok(initialTexts.includes('Supports'));
  assert.ok(initialTexts.includes('3'));
  assert.ok(initialTexts.includes('Comments'));
  assert.ok(initialTexts.includes('4'));
  assert.ok(initialTexts.includes('Shares'));
  assert.equal(initialTexts.includes('Wins'), false);
  assert.equal(initialTexts.includes('Tables'), false);
  assert.equal(initialTexts.includes('Invites'), false);
  assert.equal(initialTexts.includes('Clips'), false);

  const commentsStat = findElements(
    tree,
    (element) => element.type === 'Pressable' && textContent(element).includes('Comments'),
  )[0];
  commentsStat.props.onPress();
  await Promise.resolve();
  await Promise.resolve();

  tree = card.render();
  const openTexts = findElements(tree, (element) => element.type === 'Text').map(textContent);
  assert.equal(fetchCount, 1);
  assert.ok(openTexts.includes('@viewer'));
  assert.ok(openTexts.includes('Nice hand'));
  assert.equal(
    findElements(tree, (element) => element.type === 'TextInput' && element.props?.placeholder === 'Add a table-side comment...').length,
    0,
  );
});
