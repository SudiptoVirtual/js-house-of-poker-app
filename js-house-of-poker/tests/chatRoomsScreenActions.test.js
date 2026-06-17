const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/ChatRoomsScreen.tsx'), 'utf8');
const screenSource = fs.readFileSync(path.resolve(__dirname, '../src/components/Screen.tsx'), 'utf8');

test('chat rooms screen renders search before the scrollable chat list and filters by room title', () => {
  const searchBoxIndex = source.indexOf('styles.searchBox');
  const flatListIndex = source.indexOf('        <FlatList');
  const socialHubIndex = source.indexOf('title="Social chat hub"');
  const createNewRoomIndex = source.indexOf('title="Create New Room"');

  assert.notEqual(searchBoxIndex, -1);
  assert.notEqual(flatListIndex, -1);
  assert.ok(searchBoxIndex < flatListIndex);
  assert.match(source, /const \[roomSearchQuery, setRoomSearchQuery\] = useState\(''\);/);
  assert.match(source, /onChangeText=\{setRoomSearchQuery\}/);
  assert.match(source, /room\.title\.toLowerCase\(\)\.includes\(normalizedRoomSearchQuery\)/);
  assert.match(source, /data=\{filteredRooms\}/);
  assert.match(source, /renderItem=\{renderChatRoomItem\}/);
  assert.equal(socialHubIndex, -1);
  assert.equal(createNewRoomIndex, -1);
});

test('chat rooms action menu is in the screen header above search', () => {
  const screenIndex = source.indexOf('<Screen');
  const searchBoxIndex = source.indexOf('styles.searchBox');
  const headerRightIndex = source.indexOf('headerRight={(', screenIndex);
  const openActionsIndex = source.indexOf('Open chat room actions', screenIndex);

  assert.notEqual(screenIndex, -1);
  assert.notEqual(searchBoxIndex, -1);
  assert.notEqual(headerRightIndex, -1);
  assert.notEqual(openActionsIndex, -1);
  assert.ok(screenIndex < headerRightIndex);
  assert.ok(headerRightIndex < openActionsIndex);
  assert.ok(openActionsIndex < searchBoxIndex);
  assert.match(source, /title="Chats"/);
  assert.match(source, /scrollable=\{false\}/);
});

test('chat rooms action menu opens left of the measured action button', () => {
  assert.match(source, /const actionButtonRef = useRef<View>\(null\);/);
  assert.match(source, /actionButton\.measureInWindow/);
  assert.match(source, /moreMenuAnchor\.x - width - ACTION_MENU_GAP/);
  assert.match(source, /top: Math\.max\(ACTION_MENU_MIN_EDGE, moreMenuAnchor\.y\)/);
  assert.match(source, /style=\{\[styles\.dropdownCard, dropdownCardPosition\]\}/);
});

test('screen supports non-scroll content so chat rooms can own list scrolling', () => {
  assert.match(screenSource, /scrollable\?: boolean;/);
  assert.match(screenSource, /scrollable = true/);
  assert.match(screenSource, /\{scrollable \? \(/);
  assert.match(screenSource, /styles\.staticContent/);
  assert.match(screenSource, /styles\.staticBody/);
  assert.match(screenSource, /topSafeAreaScale\?: number;/);
  assert.match(screenSource, /useSafeAreaInsets/);
  assert.match(screenSource, /const hasHeaderCopy = Boolean\(eyebrow \|\| title \|\| subtitle\);/);
  assert.match(screenSource, /const hasHeader = hasHeaderCopy \|\| Boolean\(headerRight\);/);
});

test('chat rooms reduces top safe-area space above the screen label', () => {
  assert.match(source, /topSafeAreaScale=\{0\.2754\}/);
});

test('chat rooms show a floating back-to-top button after scrolling', () => {
  assert.match(source, /const \[isBackToTopVisible, setIsBackToTopVisible\] = useState\(false\);/);
  assert.match(source, /contentOffset\.y > 24/);
  assert.match(source, /scrollToOffset\(\{ animated: true, offset: 0 \}\)/);
  assert.match(source, /onScroll=\{handleChatListScroll\}/);
  assert.match(source, /accessibilityLabel="Back to top"/);
});

test('chat rooms menu exposes room and table actions', () => {
  assert.match(source, />Create room<\/Text>/);
  assert.match(source, />Create a table<\/Text>/);
  assert.match(source, />Join a table<\/Text>/);
  assert.match(source, /isCreateRoomDialogVisible/);
  assert.match(source, /isTableDialogVisible/);
});

test('chat rooms dialogs keep room creation and table navigation flows available', () => {
  assert.match(source, /<Modal[\s\S]*visible=\{isCreateRoomDialogVisible\}/);
  assert.match(source, /placeholder="Room name"/);
  assert.match(source, /activeFriends\.map/);
  assert.match(source, /void handleCreateRoom\(\);/);
  assert.match(source, /<Modal[\s\S]*visible=\{isTableDialogVisible\}/);
  assert.match(source, /placeholder="Table code"/);
  assert.match(source, /navigation\.navigate\(routes\.Home\)/);
  assert.match(source, /navigation\.navigate\(routes\.Game, \{ tableCode \}\)/);
});
