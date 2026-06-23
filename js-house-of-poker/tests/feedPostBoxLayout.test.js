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

function ActionButton() {}
function FeedAvatar() {}

const reactNativeMock = {
  Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
};

function renderFeedPostBox(props = {}) {
  const { FeedPostBox } = compileComponent('../src/components/feed/FeedPostBox.tsx', {
    react: { ...require('react'), useMemo: (factory) => factory(), useState: (initial) => [initial, () => {}] },
    'react-native': reactNativeMock,
    '@expo/vector-icons': { MaterialCommunityIcons: () => null },
    'expo-image-picker': {},
    '../ActionButton': { ActionButton },
    '../../theme/colors': { colors: mockColors },
    './FeedAvatar': { FeedAvatar },
    './attachmentWorkflow': {
      appendFeedAttachments: () => [],
      isFeedAttachmentOversized: () => false,
      MAX_FEED_ATTACHMENTS: 5,
      MAX_FEED_ATTACHMENT_SIZE_LABEL: '10 MB',
      removeFeedAttachment: () => [],
      uploadAttachmentsAndCreatePost: async () => {},
    },
  });

  return FeedPostBox({ onCreatePost: async () => ({}), onToast: () => {}, onUploadAttachment: async () => ({}), ...props });
}

test('feed composer displays its heading and updated prompt', () => {
  const composer = renderFeedPostBox();
  const heading = findElements(composer, (element) => element.type === 'Text' && element.props.accessibilityRole === 'header')[0];
  const textbox = findElements(composer, (element) => element.type === 'TextInput')[0];

  assert.equal(heading.props.children, 'Create Post');
  assert.equal(textbox.props.placeholder, "What's happening at your table today?");
});

test('feed composer uses the five-attachment workflow limit', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedPostBox.tsx'), 'utf8');
  assert.match(source, /selectionLimit: MAX_FEED_ATTACHMENTS - attachments\.length/);
  assert.match(source, /attachments\.length >= MAX_FEED_ATTACHMENTS/);
  assert.doesNotMatch(source, /MAX_ATTACHMENTS\s*=\s*4/);
});

test('feed composer keeps explicit accessible labels for composer controls', () => {
  const composer = renderFeedPostBox();
  const textbox = findElements(composer, (element) => element.type === 'TextInput')[0];
  const attachment = findElements(composer, (element) => element.type === 'Pressable' && element.props.accessibilityLabel === 'Attach media')[0];

  assert.equal(textbox.props.accessibilityLabel, 'Post content');
  assert.equal(attachment.props.accessibilityRole, 'button');
});


test('feed composer exposes an explicit table invite CTA with clearer helper copy', () => {
  const composer = renderFeedPostBox({
    canInviteToTable: true,
    currentPlayer: { id: 'player-1', name: 'Ada Lovelace', handle: '@ada' },
    isAuthenticated: true,
  });
  const tableInvite = findElements(composer, (element) => element.type === 'Pressable' && findElements(element, (child) => child.type === 'Text' && child.props.children === 'Invite to Table').length > 0)[0];

  assert.equal(tableInvite.props.accessibilityRole, 'button');
  assert.equal(tableInvite.props.disabled, false);
  assert.ok(findElements(tableInvite, (element) => element.type === 'Text' && element.props.children === 'Publish live table invite').length);
});

test('feed composer disables table invites without an authenticated current player', () => {
  const unauthenticatedComposer = renderFeedPostBox({ canInviteToTable: true });
  const unauthenticatedInvite = findElements(unauthenticatedComposer, (element) => element.type === 'Pressable' && findElements(element, (child) => child.type === 'Text' && child.props.children === 'Invite to Table').length > 0)[0];
  const authenticatedComposer = renderFeedPostBox({
    canInviteToTable: true,
    currentPlayer: { id: 'player-1', name: 'Ada Lovelace', handle: '@ada' },
    isAuthenticated: true,
  });
  const authenticatedInvite = findElements(authenticatedComposer, (element) => element.type === 'Pressable' && findElements(element, (child) => child.type === 'Text' && child.props.children === 'Invite to Table').length > 0)[0];

  assert.equal(unauthenticatedInvite.props.disabled, true);
  assert.equal(authenticatedInvite.props.disabled, false);
});

test('feed composer replaces gift clips with live table invite copy', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedPostBox.tsx'), 'utf8');

  assert.doesNotMatch(source, /gift-outline/);
  assert.doesNotMatch(source, /Gift clips/);
  assert.doesNotMatch(source, /Fans tip after post/);
  assert.match(source, /Publish live table invite/);
  assert.match(source, /Creates a feed post with a live poker table joining link\./);
});

test('feed composer keeps table invite posts on the existing submit path', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedPostBox.tsx'), 'utf8');

  assert.match(source, /onPress=\{\(\) => setIsTableInvite\(true\)\}/);
  assert.match(source, /const canSubmitTableInvite = isTableInvite && canUseTableInvite/);
  assert.match(source, /!trimmedContent && attachments\.length === 0 && !\(isTableInvite && canUseTableInvite\)/);
  assert.match(source, /onCreatePost\(isTableInvite \? \{ \.\.\.input, postType: 'table_invite' \}/);
});
