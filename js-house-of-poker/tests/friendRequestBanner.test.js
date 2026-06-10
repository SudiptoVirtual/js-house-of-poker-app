const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const bannerFixture = { id: 'request-1', senderName: 'Sam Sender' };

function loadBannerComponent() {
  const filename = path.resolve(__dirname, '../src/components/notifications/FriendRequestBanner.tsx');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const navigationCalls = [];
  let banner = bannerFixture;
  let clearBannerCalls = 0;
  const compiledModule = new Module(filename, module);
  const originalLoad = compiledModule.require.bind(compiledModule);

  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule.require = (request) => {
    const mocks = {
      '@expo/vector-icons': { MaterialCommunityIcons: 'MaterialCommunityIcons' },
      '@react-navigation/native': { useNavigation: () => ({ navigate: (route) => navigationCalls.push(route) }) },
      'react-native': { Pressable: 'Pressable', StyleSheet: { create: (styles) => styles }, Text: 'Text', View: 'View' },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '../../constants/routes': { routes: { Friends: 'Friends' } },
      '../../context/FriendNotificationProvider': {
        useFriendNotifications: () => ({
          banner,
          clearBanner: () => {
            clearBannerCalls += 1;
            banner = null;
          },
        }),
      },
      '../../theme/colors': { colors: {} },
    };

    return Object.hasOwn(mocks, request) ? mocks[request] : originalLoad(request);
  };
  compiledModule._compile(output, filename);

  return {
    FriendRequestBanner: compiledModule.exports.FriendRequestBanner,
    getClearBannerCalls: () => clearBannerCalls,
    navigationCalls,
  };
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;

  const children = Array.isArray(node.props?.children) ? node.props.children : [node.props?.children];
  for (const child of children) {
    const match = findElement(child, predicate);
    if (match) return match;
  }

  return null;
}

test('pressing View navigates without clearing the persistent banner', () => {
  const { FriendRequestBanner, getClearBannerCalls, navigationCalls } = loadBannerComponent();
  const viewButton = findElement(
    FriendRequestBanner(),
    (element) => element.type === 'Pressable' && findElement(element, (child) => child.props?.children === 'View'),
  );

  viewButton.props.onPress();
  navigationCalls.push('Profile');
  navigationCalls.push('Home');

  assert.deepEqual(navigationCalls, ['Friends', 'Profile', 'Home']);
  assert.equal(getClearBannerCalls(), 0);
  assert.ok(FriendRequestBanner(), 'banner remains visible while navigating between screens');
});

test('pressing X clears the banner', () => {
  const { FriendRequestBanner, getClearBannerCalls } = loadBannerComponent();
  const dismissButton = findElement(
    FriendRequestBanner(),
    (element) => element.props?.accessibilityLabel === 'Dismiss friend request',
  );

  dismissButton.props.onPress();

  assert.equal(getClearBannerCalls(), 1);
  assert.equal(FriendRequestBanner(), null);
});
