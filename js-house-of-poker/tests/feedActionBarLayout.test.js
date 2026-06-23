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

function CommentButton() {}
function JoinTableButton() {}
function SupportButton() {}

function renderFeedActionBar(props = {}) {
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
  const noop = () => {};

  return FeedActionBar({
    isSupported: false,
    onComment: noop,
    onInviteToTable: noop,
    onJoinTable: noop,
    onPromote: noop,
    onShare: noop,
    onSupport: noop,
    supportersCount: 0,
    ...props,
  });
}

test('feed action bar places a dedicated Invite to Table button beside Promote', () => {
  const actionBar = renderFeedActionBar({ canInviteToTable: true });
  const inviteButton = findElements(
    actionBar,
    (element) => element.type === 'Pressable' && textContent(element).includes('Invite to Table'),
  )[0];
  const allText = findElements(actionBar, (element) => element.type === 'Text').map(textContent);

  assert.equal(inviteButton.props.accessibilityRole, 'button');
  assert.ok(allText.includes('Promote'));
  assert.ok(allText.includes('Invite to Table'));
  assert.equal(allText.includes('Gift Clips'), false);
});
