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

const colors = {
  background: '#05060a',
  border: '#263044',
  gold: '#ffc95e',
  mutedText: '#8892a6',
  primary: '#8b5cff',
  secondary: '#8fffe0',
  success: '#4df3c7',
  surface: '#111827',
  surfaceMuted: '#182033',
  text: '#f8fafc',
};

const reactMock = { ...require('react'), useState: (initial) => [initial, () => {}] };

const reactNativeMock = {
  StyleSheet: { create: (styles) => styles },
  Text: 'Text',
  View: 'View',
};

function renderChatMessageItem(props) {
  const { ChatMessageItem } = compileComponent('../src/components/chatRooms/ChatMessageItem.tsx', {
    react: reactMock,
    'react-native': reactNativeMock,
    '@expo/vector-icons': { MaterialCommunityIcons: 'MaterialCommunityIcons' },
    '../../theme/colors': { colors },
    '../media/MediaVideo': { MediaVideo: (props) => ({ type: 'MediaVideoMock', props }) },
    '../media/ZoomableMediaViewer': { ZoomableMediaViewer: (props) => ({ type: 'ZoomableMediaViewerMock', props }) },
    './chatRoomUtils': { formatChatTimestamp: () => '9:41 AM' },
  });

  return ChatMessageItem({
    currentUserId: 'me',
    message: {
      id: 'message-1',
      roomId: 'room-1',
      authorId: 'friend',
      authorName: 'Ava Chen',
      body: 'Ready for a heads-up table?',
      createdAt: '2026-06-16T09:41:00.000Z',
      tone: 'player',
    },
    players: [],
    ...props,
  });
}

function styleObject(style) {
  return (Array.isArray(style) ? style : [style]).filter(Boolean).reduce((merged, item) => ({ ...merged, ...item }), {});
}

test('direct chat aligns current user bubbles right without repeated author chrome', () => {
  const item = renderChatMessageItem({
    chatType: 'direct',
    message: {
      id: 'message-2',
      roomId: 'room-1',
      authorId: 'me',
      authorName: 'Local Player',
      body: 'Send the invite.',
      createdAt: '2026-06-16T09:41:00.000Z',
      tone: 'player',
    },
  });
  const bubble = item.props.children[1];
  const body = bubble.props.children[1];
  const footer = bubble.props.children[4];

  assert.equal(item.type, 'View');
  assert.equal(styleObject(item.props.style).justifyContent, 'flex-end');
  assert.equal(styleObject(bubble.props.style).maxWidth, '78%');
  assert.equal(styleObject(bubble.props.style).borderBottomRightRadius, 6);
  assert.equal(bubble.props.children[0], null);
  assert.equal(body.props.children, 'Send the invite.');
  assert.match(footer.props.children.props.children.join(''), /Sent/);
});

test('direct chat aligns recipient bubbles left and keeps them compact', () => {
  const item = renderChatMessageItem({ chatType: 'direct' });
  const bubble = item.props.children[1];

  assert.equal(styleObject(item.props.style).justifyContent, 'flex-start');
  assert.equal(styleObject(bubble.props.style).maxWidth, '78%');
  assert.equal(styleObject(bubble.props.style).borderBottomLeftRadius, 6);
  assert.equal(bubble.props.children[0], null);
});

test('room chat keeps participant identity visible with avatar and message header', () => {
  const item = renderChatMessageItem({ chatType: 'group' });
  const [avatar, bubble] = item.props.children;
  const header = bubble.props.children[0];

  assert.equal(avatar.type, 'View');
  assert.equal(avatar.props.children.props.children, 'AC');
  assert.equal(header.type, 'View');
  assert.equal(header.props.children[0].props.children, 'Ava Chen');
  assert.equal(header.props.children[1].props.children, '9:41 AM');
});

test('system messages render as distinct centered metadata pills', () => {
  const item = renderChatMessageItem({
    chatType: 'public',
    message: {
      id: 'system-1',
      roomId: 'room-1',
      authorId: null,
      authorName: 'HouseBot',
      body: 'Ava Chen joined the room.',
      createdAt: '2026-06-16T09:41:00.000Z',
      kind: 'system',
      tone: 'system',
    },
  });
  const pill = item.props.children;

  assert.equal(styleObject(item.props.style).justifyContent, 'center');
  assert.equal(styleObject(pill.props.style).borderColor, colors.primary);
  assert.equal(pill.props.children[0].props.children, 'Ava Chen joined the room.');
});

test('gift clip messages preserve gift card rendering in rooms', () => {
  const item = renderChatMessageItem({
    chatType: 'group',
    message: {
      id: 'gift-1',
      roomId: 'room-1',
      authorId: 'friend',
      authorName: 'Ava Chen',
      body: 'For the river call.',
      createdAt: '2026-06-16T09:41:00.000Z',
      giftClip: {
        amount: 2500,
        message: 'For the river call.',
        recipientTransactionId: null,
        recipientUserId: 'me',
        senderTransactionId: null,
        transactionId: null,
        transactionIds: { recipient: null, sender: null },
      },
      kind: 'gift_clip',
      tone: 'player',
    },
    players: [{ id: 'me', userId: 'me', displayName: 'Local Player' }],
  });
  const [avatar, bubble] = item.props.children;
  const card = bubble.props.children[1];

  assert.equal(avatar.props.children.type, 'MaterialCommunityIcons');
  assert.equal(styleObject(bubble.props.style).borderColor, colors.gold);
  assert.equal(card.props.children[1].props.children.join(''), '2,500 Clips');
  assert.equal(card.props.children[2].props.children.join(''), 'Ava Chen → Local Player');
});
