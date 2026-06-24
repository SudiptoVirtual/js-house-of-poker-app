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

function renderFunctionElement(node) {
  return typeof node?.type === 'function' ? node.type(node.props) : node;
}

function findElements(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  const renderedNode = renderFunctionElement(node);
  if (renderedNode !== node) return findElements(renderedNode, predicate, matches);
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) findElements(child, predicate, matches);
  return matches;
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (typeof node === 'object') {
    const renderedNode = renderFunctionElement(node);
    return textContent(renderedNode === node ? node.props?.children : renderedNode);
  }
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
  const React = state.react;
  const { FeedPostCard } = compileComponent('../src/components/feed/FeedPostCard.tsx', {
    react: React,
    'react-native': rn,
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: mockColors },
    './FeedActionBar': {
      FeedActionBar: ({ onComment }) => React.createElement(
        'View',
        { testID: 'feed-action-bar' },
        React.createElement('Text', null, 'Support'),
        React.createElement('Pressable', { onPress: onComment }, React.createElement('Text', null, 'Comments')),
        React.createElement('Text', null, 'Share'),
      ),
    },
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

test('feed cards render only the bottom FeedActionBar social actions', async () => {
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
    currentUserId: 'viewer',
    onComment: noop,
    onDeleteComment: noop,
    onDeletePost: noop,
    onFetchComments: async () => {
      fetchCount += 1;
      return { comments, post };
    },
    onInviteToTable: noop,
    onJoinTable: noop,
    onOpenProfile: noop,
    onPromote: noop,
    onShare: noop,
    onSupportChange: noop,
    onUpdateComment: noop,
    onUpdatePost: noop,
    post,
    variant: 'feed',
  });

  let tree = card.render();
  const initialTexts = findElements(tree, (element) => element.type === 'Text').map(textContent);

  assert.equal(findElements(tree, (element) => element.props?.testID === 'feed-action-bar').length, 1);
  assert.equal(initialTexts.filter((text) => text === 'Support').length, 1);
  assert.equal(initialTexts.filter((text) => text === 'Comments').length, 1);
  assert.equal(initialTexts.filter((text) => text === 'Share').length, 1);
  assert.equal(initialTexts.includes('12'), false);
  assert.equal(initialTexts.includes('Supports'), false);
  assert.equal(initialTexts.includes('3'), false);
  assert.equal(initialTexts.includes('4'), false);
  assert.equal(initialTexts.includes('Shares'), false);

  const commentsAction = findElements(
    tree,
    (element) => element.type === 'Pressable' && textContent(element) === 'Comments',
  )[0];
  commentsAction.props.onPress();
  await Promise.resolve();
  await Promise.resolve();

  tree = card.render();
  const openTexts = findElements(tree, (element) => element.type === 'Text').map(textContent);
  assert.equal(fetchCount, 1);
  assert.ok(openTexts.includes('@viewer'));
  assert.ok(openTexts.includes('Nice hand'));
});
