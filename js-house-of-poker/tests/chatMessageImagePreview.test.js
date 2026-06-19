const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

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

function findElements(node, predicate, matches = []) {
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, matches);
    return matches;
  }
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) findElements(child, predicate, matches);
  return matches;
}

const reactNativeMock = {
  Image: 'Image', Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles) => styles },
};
const iconsMock = { MaterialCommunityIcons: () => null };
const colorsMock = { colors: { background: '#000', border: '#111', gold: '#fc0', mutedText: '#aaa', primary: '#90f', secondary: '#0ff', success: '#0f0', surface: '#222', surfaceMuted: '#333', text: '#fff' } };
const message = {
  attachments: [
    { type: 'image', url: 'first.jpg' },
    { type: 'video', url: 'clip.mp4' },
    { type: 'image', url: 'second.jpg' },
  ],
  authorId: 'other-player',
  authorName: 'Ada Lovelace',
  body: 'Check these out',
  createdAt: '2026-06-19T12:00:00.000Z',
};

test('chat image attachments are pressable and open the selected full-screen preview', () => {
  let stateValue = null;
  const setStateCalls = [];
  const reactMock = { ...require('react'), useState: (initial) => [stateValue ?? initial, (next) => { stateValue = next; setStateCalls.push(next); }] };
  const { ChatMessageItem } = compileComponent('../src/components/chatRooms/ChatMessageItem.tsx', {
    react: reactMock,
    'react-native': reactNativeMock,
    '@expo/vector-icons': iconsMock,
    '../../theme/colors': colorsMock,
    '../media/ZoomableMediaViewer': { ZoomableMediaViewer: (props) => ({ type: 'ZoomableMediaViewerMock', props }) },
    './chatRoomUtils': { formatChatTimestamp: () => '12:00 PM' },
  });

  let tree = ChatMessageItem({ chatType: 'group', currentUserId: 'local-player', message });
  const previewButtons = findElements(tree, (element) => element.type === 'Pressable' && element.props.accessibilityLabel === 'Preview image attachment');

  assert.equal(previewButtons.length, 2);
  assert.equal(previewButtons[0].props.accessibilityRole, 'imagebutton');
  let viewer = findElements(tree, (element) => element.type?.name === 'ZoomableMediaViewer')[0];
  assert.equal(viewer.props.visible, false);

  previewButtons[1].props.onPress();
  assert.deepEqual(setStateCalls, [2]);

  tree = ChatMessageItem({ chatType: 'group', currentUserId: 'local-player', message });
  viewer = findElements(tree, (element) => element.type?.name === 'ZoomableMediaViewer')[0];
  assert.equal(viewer.props.visible, true);
  assert.equal(viewer.props.uri, 'second.jpg');
});

test('zoomable media viewer provides modal dismissal and gesture support', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/media/ZoomableMediaViewer.tsx'), 'utf8');
  assert.match(source, /<Modal[\s\S]*onRequestClose=\{handleClose\}/);
  assert.match(source, /PanResponder\.create/);
  assert.match(source, /pinchDistance/);
  assert.match(source, /translateX: pan\.x/);
  assert.match(source, /accessibilityLabel="Close full-screen image preview"/);
});
