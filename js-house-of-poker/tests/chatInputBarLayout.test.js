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

test('chat composer aligns the input and actions in a single full-width row', () => {
  const composer = renderChatInputBar();
  const [row] = getChildren(composer);
  const [input, actions] = getChildren(row);

  assert.equal(composer.type, 'View');
  assert.equal(composer.props.style.alignItems, 'stretch');
  assert.equal(row.type, 'View');
  assert.equal(row.props.style.alignItems, 'center');
  assert.equal(row.props.style.flexDirection, 'row');
  assert.equal(row.props.style.width, '100%');
  assert.equal(input.type, 'TextInput');
  assert.equal(input.props.style.flex, 1);
  assert.equal(input.props.style.width, undefined);
  assert.equal(actions.type, 'View');
  assert.equal(actions.props.style.flexDirection, 'row');
  assert.equal(actions.props.style.justifyContent, 'flex-end');
  assert.equal(actions.props.style.width, undefined);
  assert.equal(actions.props.children.length, 4);
});

test('single-row chat composer stays within the previous height envelope', () => {
  const composer = renderChatInputBar();
  const [row] = getChildren(composer);
  const [input] = getChildren(row);
  const chromeHeight = (composer.props.style.borderWidth * 2)
    + (composer.props.style.paddingVertical * 2)
    + composer.props.style.gap;
  const restingHeight = chromeHeight + Math.max(input.props.style.minHeight, ACTION_HEIGHT);
  const maxHeight = chromeHeight + Math.max(input.props.style.maxHeight, ACTION_HEIGHT);

  assert.ok(restingHeight <= PREVIOUS_RESTING_HEIGHT * 1.03);
  assert.ok(maxHeight <= PREVIOUS_MAX_HEIGHT * 1.03);
  assert.equal(restingHeight, 42);
  assert.equal(maxHeight, 90);
});

test('non-AI composer icons are at least 15% smaller than their previous sizes', () => {
  const composer = renderChatInputBar();
  const row = getChildren(composer)[0];
  const actions = getChildren(row)[1];
  const [emojiButton, giftButton, , sendButton] = getChildren(actions);

  assert.ok(emojiButton.props.children.props.size <= 18 * 0.85);
  assert.ok(giftButton.props.children.props.size <= 18 * 0.85);
  assert.ok(sendButton.props.children.props.size <= 17 * 0.85);
});

test('direct chat composer keeps compact actions beside the taller input', () => {
  const composer = renderChatInputBar({ variant: 'direct' });
  const [row] = getChildren(composer);
  const [attachButton, giftButton, aiPrimeButton, input, sendButton] = getChildren(row);

  assert.equal(flattenStyle(composer.props.style).borderWidth, 0);
  assert.equal(row.props.style.flexDirection, 'row');
  assert.equal(row.props.style.alignItems, 'center');
  assert.equal(row.props.style.gap, 6);
  assert.equal(getChildren(row).length, 5);
  assert.equal(attachButton.type, 'Pressable');
  assert.equal(giftButton.props.accessibilityLabel, 'Send Gift Clips');
  assert.equal(aiPrimeButton.type, AIPrimeButton);
  assert.equal(aiPrimeButton.props.compact, true);
  assert.equal(input.type, 'TextInput');
  assert.equal(sendButton.type, 'Pressable');
  assert.equal(input.props.style.minHeight, 42);
  assert.equal(input.props.style.maxHeight, 109);
  assert.equal(flattenStyle(attachButton.props.style({ pressed: false })).height, 32);
  assert.equal(flattenStyle(giftButton.props.style({ pressed: false })).height, 32);
  assert.equal(flattenStyle(sendButton.props.style({ pressed: false })).width, 32);
});
