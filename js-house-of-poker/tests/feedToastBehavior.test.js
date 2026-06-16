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

function createStatefulReact() {
  const values = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  return {
    react: {
      ...require('react'),
      useCallback: (callback) => callback,
      useEffect: () => {},
      useMemo: (factory) => factory(),
      useRef: (initial) => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (value) => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
      },
    },
    reset: () => { cursor = 0; refCursor = 0; },
  };
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
  ActivityIndicator: 'ActivityIndicator',
  AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' },
  Clipboard: { setString: () => {} },
  Dimensions: { get: () => ({ width: 320, height: 640 }) },
  FlatList: 'FlatList',
  Image: 'Image',
  Keyboard: { addListener: () => ({ remove() {} }) },
  Linking: { openURL: () => Promise.resolve() },
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  Share: { share: () => Promise.resolve() },
  StyleSheet: { absoluteFill: { position: 'absolute' }, create: (styles) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  UIManager: { measureLayout: () => {} },
  View: 'View',
};

function renderFeedPostBox({ uploadAttachmentsAndCreatePost, onCreatePost = async () => ({}), onToast = () => {} }) {
  const state = createStatefulReact();
  const { FeedPostBox } = compileComponent('../src/components/feed/FeedPostBox.tsx', {
    react: state.react,
    'react-native': reactNativeMock,
    '@expo/vector-icons': { MaterialCommunityIcons: () => null },
    'expo-image-picker': {},
    '../ActionButton': { ActionButton },
    '../../theme/colors': { colors: {} },
    './FeedAvatar': { FeedAvatar },
    './attachmentWorkflow': {
      appendFeedAttachments: () => [],
      isFeedAttachmentOversized: () => false,
      MAX_FEED_ATTACHMENTS: 5,
      MAX_FEED_ATTACHMENT_SIZE_LABEL: '10 MB',
      removeFeedAttachment: () => [],
      uploadAttachmentsAndCreatePost,
    },
  });
  const props = { currentPlayer: { id: 'player-1', name: 'Ada Lovelace', handle: '@ada' }, isAuthenticated: true, onCreatePost, onToast, onUploadAttachment: async () => ({}) };
  return { render: () => { state.reset(); return FeedPostBox(props); } };
}

test('FeedPostBox calls the toast callback with success tone after a successful post', async () => {
  const toasts = [];
  const composer = renderFeedPostBox({ uploadAttachmentsAndCreatePost: async () => ({}), onToast: (toast) => toasts.push(toast) });
  let tree = composer.render();
  findElements(tree, (element) => element.type === 'TextInput')[0].props.onChangeText('hello table');
  tree = composer.render();
  await findElements(tree, (element) => element.type === ActionButton)[0].props.onPress();

  assert.deepEqual(toasts.at(-1), { tone: 'success', message: 'Post published to the feed.' });
});

test('FeedPostBox calls the toast callback with error tone when upload or post creation fails', async () => {
  const toasts = [];
  const composer = renderFeedPostBox({ uploadAttachmentsAndCreatePost: async () => { throw new Error('Upload failed'); }, onToast: (toast) => toasts.push(toast) });
  let tree = composer.render();
  findElements(tree, (element) => element.type === 'TextInput')[0].props.onChangeText('hello table');
  tree = composer.render();
  await findElements(tree, (element) => element.type === ActionButton)[0].props.onPress();

  assert.deepEqual(toasts.at(-1), { tone: 'error', message: 'Upload failed' });
});

test('PlayerFeedScreen renders a bottom toast with an accessible dismiss button and no auto-hide timer', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/PlayerFeedScreen.tsx'), 'utf8');

  assert.match(source, /style=\{\[\s*styles\.toastSafeArea,\s*\{ bottom: isKeyboardVisible \? 16 : insets\.bottom \+ 84 \},\s*\]\}/);
  assert.match(source, /accessibilityRole="alert"/);
  assert.match(source, /accessibilityLabel="Dismiss feed notification"/);
  assert.match(source, /accessibilityRole="button"/);
  assert.match(source, /onPress=\{\(\) => setFeedToast\(null\)\}/);
  assert.doesNotMatch(source, /setTimeout\([^)]*setFeedToast/);
});

test('FeedPostCard disabled action feedback calls the toast callback instead of Alert.alert', () => {
  const state = createStatefulReact();
  const alertCalls = [];
  function FeedActionBar(props) { return { type: FeedActionBar, props }; }
  const { FeedPostCard } = compileComponent('../src/components/feed/FeedPostCard.tsx', {
    react: state.react,
    'react-native': { ...reactNativeMock, Alert: { alert: (...args) => alertCalls.push(args) } },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    '../../theme/colors': { colors: {} },
    './FeedActionBar': { FeedActionBar },
    './FeedPlayerHeader': { FeedPlayerHeader: () => null },
    './FeedMediaGallery': { FeedMediaGallery: () => null },
  });
  const toasts = [];
  const noop = () => {};
  const tree = FeedPostCard({
    actionsDisabled: true,
    actionsDisabledMessage: 'Please sign in.',
    post: { id: 'post-1', player: { id: 'player-1' }, content: 'post', timestamp: '', media: [], supportersCount: 0, commentCount: 0, shareCount: 0, isPromoted: false },
    onComment: noop,
    onDeleteComment: noop,
    onDeletePost: noop,
    onFetchComments: noop,
    onGiftClips: noop,
    onJoinTable: noop,
    onOpenProfile: noop,
    onPromote: noop,
    onShare: noop,
    onShowToast: (toast) => toasts.push(toast),
    onSupportChange: noop,
    onUpdateComment: noop,
    onUpdatePost: noop,
  });
  const actionBar = findElements(tree, (element) => element.type === FeedActionBar)[0];
  actionBar.props.onShare();

  assert.deepEqual(toasts, [{ tone: 'error', message: 'Please sign in.' }]);
  assert.deepEqual(alertCalls, []);
});
