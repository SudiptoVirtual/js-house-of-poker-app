const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/screens/ChatRoomsScreen.tsx'), 'utf8');

test('chat rooms screen moves compact action row above rooms list', () => {
  const actionRowIndex = source.indexOf('styles.topActionRow');
  const roomsCardIndex = source.indexOf('<SectionCard title="Rooms">');
  const socialHubIndex = source.indexOf('title="Social chat hub"');
  const createNewRoomIndex = source.indexOf('title="Create New Room"');

  assert.notEqual(actionRowIndex, -1);
  assert.notEqual(roomsCardIndex, -1);
  assert.ok(actionRowIndex < roomsCardIndex);
  assert.equal(socialHubIndex, -1);
  assert.equal(createNewRoomIndex, -1);
});

test('chat rooms top action row exposes exactly the two requested primary actions', () => {
  assert.match(source, /label="Create room"/);
  assert.match(source, /label="Create or join table"/);
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
