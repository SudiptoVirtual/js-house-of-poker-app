const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

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

function renderFeedPostBox() {
  const { FeedPostBox } = compileComponent('../src/components/feed/FeedPostBox.tsx', {
    react: { ...require('react'), useMemo: (factory) => factory(), useState: (initial) => [initial, () => {}] },
    'react-native': reactNativeMock,
    '@expo/vector-icons': { MaterialCommunityIcons: () => null },
    'expo-image-picker': {},
    '../ActionButton': { ActionButton },
    '../../theme/colors': { colors: {} },
    './FeedAvatar': { FeedAvatar },
    './attachmentWorkflow': {
      appendFeedAttachments: () => [],
      MAX_FEED_ATTACHMENTS: 5,
      removeFeedAttachment: () => [],
      uploadAttachmentsAndCreatePost: async () => {},
    },
  });

  return FeedPostBox({ onCreatePost: async () => ({}), onToast: () => {}, onUploadAttachment: async () => ({}) });
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
