const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { mockColors } = require('./mockTheme');

function compileComponent(relativePath, mocks = {}) {
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

function SupportButton(props) {
  return { type: SupportButton, props };
}
function CommentButton() {}
function JoinTableButton() {}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return undefined;
}

function buildPost(overrides = {}) {
  return {
    commentCount: 0,
    content: 'Support this hand',
    id: 'feed_post_1',
    isPromoted: false,
    isTableRelated: false,
    media: [],
    player: { handle: '@dealer', id: 'player_1', name: 'Dealer', status: 'Online' },
    postKind: 'standard',
    postType: 'text',
    reactionCounts: { support: 0 },
    shareCount: 0,
    supportedByCurrentPlayer: false,
    supportersCount: 0,
    timestamp: '2026-06-24T00:00:00.000Z',
    ...overrides,
  };
}

const { mergeSupportResponsePost } = compileComponent('../src/components/feed/mergeSupportResponsePost.ts');

test('support response merge keeps the next viewer support state while using backend counts', () => {
  const currentPost = buildPost({ reactionCounts: { support: 1 }, supportedByCurrentPlayer: true, supportersCount: 1 });
  const staleResponsePost = buildPost({ reactionCounts: { support: 7 }, supportedByCurrentPlayer: false, supportersCount: 7 });

  const mergedPost = mergeSupportResponsePost(currentPost, staleResponsePost, true);

  assert.equal(mergedPost.supportedByCurrentPlayer, true);
  assert.equal(mergedPost.reactionCounts.support, 7);
  assert.equal(mergedPost.supportersCount, 7);
});

test('merged support response renders SupportButton as supported immediately', () => {
  const { FeedActionBar } = compileComponent('../src/components/feed/FeedActionBar.tsx', {
    react: require('react'),
    'react-native': {
      ActivityIndicator: 'ActivityIndicator',
      Pressable: 'Pressable',
      StyleSheet: { create: (styles) => styles },
      Text: 'Text',
      View: 'View',
    },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: mockColors },
    './CommentButton': { CommentButton },
    './InviteToTableButton': { JoinTableButton },
    './SupportButton': { SupportButton },
  });
  const mergedPost = mergeSupportResponsePost(
    buildPost({ supportedByCurrentPlayer: true, supportersCount: 1 }),
    buildPost({ supportedByCurrentPlayer: false, supportersCount: 7, reactionCounts: { support: 7 } }),
    true,
  );

  const actionBar = FeedActionBar({
    isSupported: Boolean(mergedPost.supportedByCurrentPlayer),
    onComment: () => {},
    onInviteToTable: () => {},
    onJoinTable: () => {},
    onPromote: () => {},
    onShare: () => {},
    onSupport: () => {},
    supportersCount: mergedPost.supportersCount,
  });

  const supportButton = findElement(actionBar, (element) => element.type === SupportButton);

  assert.equal(supportButton.props.isSupported, true);
  assert.equal(supportButton.props.supportersCount, 7);
});
