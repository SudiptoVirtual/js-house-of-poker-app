const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const PREVIOUS_RESTING_HEIGHT = 66;
const PREVIOUS_MAX_HEIGHT = 130;
const ACTION_HEIGHT = 36;

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

function AIPrimeButton() {}

const reactNativeMock = {
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles) => styles },
  TextInput: 'TextInput',
  View: 'View',
};

function flattenStyle(style) {
  return (Array.isArray(style) ? style : [style]).filter(Boolean).reduce((result, item) => ({ ...result, ...item }), {});
}

function getChildren(node) {
  return (Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]).filter(Boolean);
}

function renderChatInputBar(props = {}) {
  const { ChatInputBar } = compileComponent('../src/components/chatRooms/ChatInputBar.tsx', {
    react: { ...require('react'), useState: (initialValue) => [initialValue, () => {}] },
    'react-native': reactNativeMock,
    '@expo/vector-icons': { MaterialCommunityIcons: () => null },
    'expo-image-picker': {
      launchImageLibraryAsync: async () => ({ assets: [], canceled: true }),
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
    },
    './AIPrimeButton': { AIPrimeButton },
    '../../theme/colors': { colors: {} },
  });

  return ChatInputBar({
    draft: '',
    onChangeDraft: () => {},
    onOpenAIPrime: () => {},
    onOpenGiftClips: () => {},
    onSend: () => {},
    ...props,
  });
}

test('chat composer uses a full-width input row above right-aligned actions', () => {
  const composer = renderChatInputBar();
  const [input, actions] = getChildren(composer);

  assert.equal(composer.type, 'View');
  assert.equal(composer.props.style.alignItems, 'stretch');
  assert.equal(input.type, 'TextInput');
  assert.equal(input.props.style.flex, undefined);
  assert.equal(input.props.style.width, '100%');
  assert.equal(actions.type, 'View');
  assert.equal(actions.props.style.flexDirection, 'row');
  assert.equal(actions.props.style.justifyContent, 'flex-end');
  assert.equal(actions.props.style.width, '100%');
  assert.equal(actions.props.children.length, 4);
});

test('two-row chat composer stays within the previous height envelope', () => {
  const composer = renderChatInputBar();
  const [input, actions] = getChildren(composer);
  const chromeHeight = (composer.props.style.borderWidth * 2)
    + (composer.props.style.paddingVertical * 2)
    + composer.props.style.gap
    + actions.props.style.borderTopWidth
    + actions.props.style.paddingTop
    + ACTION_HEIGHT;
  const restingHeight = chromeHeight + input.props.style.minHeight;
  const maxHeight = chromeHeight + input.props.style.maxHeight;

  assert.ok(restingHeight <= PREVIOUS_RESTING_HEIGHT * 1.03);
  assert.ok(maxHeight <= PREVIOUS_MAX_HEIGHT * 1.03);
  assert.equal(restingHeight, 65);
  assert.equal(maxHeight, 129);
});

test('non-AI composer icons are at least 15% smaller than their previous sizes', () => {
  const composer = renderChatInputBar();
  const actions = getChildren(composer)[1];
  const [emojiButton, giftButton, , sendButton] = getChildren(actions);

  assert.ok(emojiButton.props.children.props.size <= 18 * 0.85);
  assert.ok(giftButton.props.children.props.size <= 18 * 0.85);
  assert.ok(sendButton.props.children.props.size <= 17 * 0.85);
});

test('direct chat composer uses one compact row without gift or AI controls', () => {
  const composer = renderChatInputBar({ variant: 'direct' });
  const [row] = getChildren(composer);
  const [attachButton, input, sendButton] = getChildren(row);

  assert.equal(flattenStyle(composer.props.style).borderWidth, 0);
  assert.equal(row.props.style.flexDirection, 'row');
  assert.equal(row.props.style.gap, 6);
  assert.equal(getChildren(row).length, 3);
  assert.equal(attachButton.type, 'Pressable');
  assert.equal(input.type, 'TextInput');
  assert.equal(sendButton.type, 'Pressable');
  assert.equal(input.props.style.minHeight, 26);
  assert.equal(input.props.style.maxHeight, 109);
  assert.equal(flattenStyle(attachButton.props.style({ pressed: false })).height, 32);
  assert.equal(flattenStyle(sendButton.props.style({ pressed: false })).width, 32);
  assert.equal(getChildren(row).some((child) => child.type === AIPrimeButton), false);
  assert.equal(getChildren(row).some((child) => child.props?.accessibilityLabel === 'Send Gift Clips'), false);
});
