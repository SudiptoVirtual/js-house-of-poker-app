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
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View',
  StyleSheet: { absoluteFillObject: { position: 'absolute' }, create: (styles) => styles },
};
const iconsMock = { MaterialCommunityIcons: () => null };
const colorsMock = { colors: { background: '#000', border: '#111', mutedText: '#aaa', secondary: '#0ff', white: '#fff', radii: { lg: 16 }, spacing: { 4: 4, 8: 8, 12: 12 } } };
class ApiError extends Error { constructor(message, status, payload) { super(message); this.status = status; this.payload = payload; } }
const clientMock = { ApiError, apiRequest: async () => null, parseApiPayload: (text) => { try { return JSON.parse(text); } catch { return text; } } };

const image = { altText: 'Final table', durationMs: null, height: 600, metadata: {}, mimeType: 'image/jpeg', type: 'image', url: 'image.jpg', width: 800 };
const video = { altText: 'Winning hand', durationMs: 65000, height: 1080, metadata: {}, mimeType: 'video/mp4', thumbnailUrl: 'thumb.jpg', type: 'video', url: 'video.mp4', width: 1920 };

test('image attachments render with preserved aspect ratio, loading state, and accessible preview', () => {
  const { FeedMediaGallery } = compileComponent('../src/components/feed/FeedMediaGallery.tsx', {
    react: { ...require('react'), useState: (initial) => [initial, () => {}] },
    'react-native': reactNativeMock,
    '@expo/vector-icons': iconsMock,
    '../../theme/colors': colorsMock,
    './FeedVideo': { FeedVideo: () => null },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => ({ pause() {} }) },
    '../media/ZoomableMediaViewer': { ZoomableMediaViewer: (props) => ({ type: 'ZoomableMediaViewerMock', props }) },
  });
  const gallery = FeedMediaGallery({ media: [image] });
  const feedImageElement = findElements(gallery, (element) => element.type?.name === 'FeedImage')[0];
  const tree = feedImageElement.type(feedImageElement.props);

  const imageShell = findElements(tree, (element) => element.type === 'Pressable' && element.props.accessibilityRole === 'imagebutton')[0];
  assert.equal(imageShell.props.style[1].aspectRatio, 4 / 3);
  assert.equal(findElements(tree, (element) => element.type === 'ActivityIndicator').length, 1);
  assert.equal(findElements(gallery, (element) => element.type?.name === 'ZoomableMediaViewer')[0].props.visible, false);
  assert.match(imageShell.props.accessibilityHint, /full-screen preview/);
});

test('video-only galleries render video attachments without reading a missing first image', () => {
  const feedVideoCalls = [];
  const { FeedMediaGallery } = compileComponent('../src/components/feed/FeedMediaGallery.tsx', {
    react: { ...require('react'), useState: (initial) => [initial, () => {}] },
    'react-native': reactNativeMock,
    '@expo/vector-icons': iconsMock,
    '../../theme/colors': colorsMock,
    './FeedVideo': { FeedVideo: (props) => { feedVideoCalls.push(props); return { type: 'FeedVideoMock', props }; } },
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: () => ({ pause() {} }) },
    '../media/ZoomableMediaViewer': { ZoomableMediaViewer: (props) => ({ type: 'ZoomableMediaViewerMock', props }) },
  });

  const gallery = FeedMediaGallery({ media: [video], isActive: true });

  const feedVideoElement = findElements(gallery, (element) => element.type?.name === 'FeedVideo')[0];

  assert.equal(feedVideoElement.props.media, video);
  assert.equal(feedVideoElement.props.isActive, true);
  assert.equal(typeof feedVideoElement.props.onOpenFullScreen, 'function');
  assert.equal(findElements(gallery, (element) => element.type?.name === 'FeedImage').length, 0);
  feedVideoElement.type(feedVideoElement.props);
  assert.equal(feedVideoCalls.length, 1);
});

test('feed videos expose full-screen preview state and render a native-controls modal', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedMediaGallery.tsx'), 'utf8');
  assert.match(source, /previewVideoIndex/);
  assert.match(source, /onOpenFullScreen=\{\(\) => setPreviewVideoIndex\(index\)\}/);
  assert.match(source, /isActive=\{isActive && previewVideoIndex === null\}/);
  assert.match(source, /<Modal[\s\S]*visible=\{visible\}/);
  assert.match(source, /<VideoView[\s\S]*contentFit="contain"[\s\S]*nativeControls/);
  assert.match(source, /player\.pause\(\)/);
  assert.match(source, /onClose=\{\(\) => setPreviewVideoIndex\(null\)\}/);
});

test('feed video keeps play and mute controls separate from the full-screen affordance', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedVideo.tsx'), 'utf8');
  assert.match(source, /onOpenFullScreen\?: \(\) => void/);
  assert.match(source, /accessibilityLabel="Open video full screen"/);
  assert.match(source, /onPress=\{togglePlayback\}/);
  assert.match(source, /setIsMuted\(\(current\) => !current\)/);
  assert.match(source, /name="arrow-expand"/);
});

test('two-, four-, and five-image posts use compact cover-image collages', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedMediaGallery.tsx'), 'utf8');
  assert.match(source, /images\.length === 2 \|\| images\.length === 4/);
  assert.match(source, /images\.slice\(1\)/);
  assert.match(source, /height: 240/);
  assert.match(source, /resizeMode=\{collage \? 'cover' : 'contain'\}/);
});

test('gallery-level preview selects thumbnails and uses the shared zoomable viewer', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedMediaGallery.tsx'), 'utf8');
  assert.match(source, /setPreviewIndex\(index\)/);
  assert.match(source, /images\[previewIndex\]\.url/);
  assert.match(source, /<ZoomableMediaViewer/);
  assert.match(source, /onClose=\{\(\) => setPreviewIndex\(null\)\}/);
  const viewer = fs.readFileSync(path.resolve(__dirname, '../src/components/media/ZoomableMediaViewer.tsx'), 'utf8');
  assert.match(viewer, /resizeMode="contain"/);
  assert.match(viewer, /PanResponder\.create/);
});

test('active-video selection chooses one visible video nearest the upper-middle target', () => {
  const { selectActiveVideoPostId } = compileComponent('../src/components/feed/feedVideoSelection.ts');
  const selected = selectActiveVideoPostId([
    { postId: 'image-top', hasVideo: false, isViewable: true },
    { postId: 'upper-video', hasVideo: true, isViewable: true },
    { postId: 'lower-video', hasVideo: true, isViewable: true },
    { postId: 'offscreen-video', hasVideo: true, isViewable: false },
  ]);
  assert.equal(selected, 'upper-video');
  assert.equal(selectActiveVideoPostId([{ postId: 'offscreen-video', hasVideo: true, isViewable: false }]), null);
});

test('active video autoplays while off-screen videos pause and reset to muted', () => {
  const calls = [];
  const player = { loop: false, muted: false, pause: () => calls.push('pause'), play: () => calls.push('play') };
  const reactMock = { ...require('react'), useEffect: (effect) => effect(), useState: (initial) => [initial, () => {}] };
  const { FeedVideo } = compileComponent('../src/components/feed/FeedVideo.tsx', {
    react: reactMock, 'react-native': reactNativeMock, '@expo/vector-icons': iconsMock, '../../theme/colors': colorsMock,
    'expo-video': { VideoView: 'VideoView', useVideoPlayer: (_source, setup) => { setup(player); return player; } },
  });

  FeedVideo({ isActive: true, media: video });
  FeedVideo({ isActive: false, media: video });
  assert.deepEqual(calls, ['play', 'pause']);
  assert.equal(player.muted, true);
});

test('feed focus and app-background state gate the single active video passed to cards', () => {
  const screen = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/PlayerFeedScreen.tsx'), 'utf8');
  const card = fs.readFileSync(path.resolve(__dirname, '../src/components/feed/FeedPostCard.tsx'), 'utf8');
  assert.match(card, /<FeedMediaGallery[\s\S]*media=\{post\.media\}/);
  assert.match(screen, /setIsFeedFocused\(true\)/);
  assert.match(screen, /return \(\) => setIsFeedFocused\(false\)/);
  assert.match(screen, /AppState\.addEventListener\('change'/);
  assert.match(screen, /isActive=\{isFeedFocused && isAppActive && activeVideoPostId === item\.id\}/);
});

test('media upload turns HTML and non-JSON responses into status-aware upload errors', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    { blob: async () => ({ bytes: true }) },
    { ok: false, status: 413, text: async () => '<html>Request too large</html>' },
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });
  const { uploadFeedMedia } = compileComponent('../src/services/api/feed.ts', {
    '../../config/env': { env: { apiBaseUrl: 'https://api.example.com' } },
    './client': clientMock,
  });

  await assert.rejects(
    uploadFeedMedia({ fileSize: 50 * 1024 * 1024 + 1, mimeType: 'video/mp4', name: 'clip.mp4', uri: 'file:///clip.mp4' }, 'token'),
    /This attachment exceeds the 50 MB upload-size limit\. The selected file is 50\.1 MB\./,
  );
});

test('media upload uses backend size details and tolerates picker assets without fileSize', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    { blob: async () => ({ bytes: true }) },
    { ok: false, status: 413, text: async () => JSON.stringify({ actualBytes: 63 * 1024 * 1024, code: 'INVALID_MEDIA_SIZE', limitLabel: '60 MB', maxBytes: 60 * 1024 * 1024, message: 'Attachment too large.' }) },
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });
  const { uploadFeedMedia } = compileComponent('../src/services/api/feed.ts', {
    '../../config/env': { env: { apiBaseUrl: 'https://api.example.com' } },
    './client': clientMock,
  });
  await assert.rejects(uploadFeedMedia({ mimeType: 'image/jpeg', name: 'photo.jpg', uri: 'file:///photo.jpg' }, 'token'), /Attachment too large\./);
});

test('attachment workflow accepts the exact size limit and rejects one byte above it before upload', async () => {
  const workflow = compileComponent('../src/components/feed/attachmentWorkflow.ts', {
    '../../services/api/feed': { MAX_FEED_ATTACHMENT_BYTES: 50 * 1024 * 1024, MAX_FEED_ATTACHMENT_SIZE_LABEL: '50 MB' },
  });
  assert.equal(workflow.isFeedAttachmentOversized({ fileSize: workflow.MAX_FEED_ATTACHMENT_BYTES }), false);
  assert.equal(workflow.isFeedAttachmentOversized({ fileSize: workflow.MAX_FEED_ATTACHMENT_BYTES + 1 }), true);
  assert.equal(workflow.MAX_FEED_ATTACHMENT_SIZE_LABEL, '50 MB');
  assert.equal(workflow.isFeedAttachmentOversized({}), false);
  let uploads = 0;
  await assert.rejects(
    workflow.uploadAttachmentsAndCreatePost(
      [{ fileSize: 50 * 1024 * 1024 + 1, id: 'large', mimeType: 'video/mp4', name: 'large.mp4', type: 'video', uri: 'file:///large.mp4' }],
      '',
      async () => { uploads += 1; },
      async () => null,
    ),
    /Attachments must be no larger than 50 MB\./,
  );
  assert.equal(uploads, 0);
});

test('media upload normalizes React Native MOV video metadata', async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (!options) return { blob: async () => ({ bytes: true }) };
    return { ok: true, status: 201, text: async () => JSON.stringify({ media: video }) };
  };
  t.after(() => { global.fetch = originalFetch; });
  const { uploadFeedMedia } = compileComponent('../src/services/api/feed.ts', {
    '../../config/env': { env: { apiBaseUrl: 'https://api.example.com' } },
    './client': clientMock,
  });

  await uploadFeedMedia({ mimeType: 'video/mov', name: 'camera.mov', uri: 'file:///camera.mov' }, 'token');
  assert.equal(requests[0].url, 'file:///camera.mov');
  assert.equal(requests[1].options.headers['Content-Type'], 'video/quicktime');
  assert.equal(requests[1].options.headers['X-File-Name'], 'camera.mov');
});
