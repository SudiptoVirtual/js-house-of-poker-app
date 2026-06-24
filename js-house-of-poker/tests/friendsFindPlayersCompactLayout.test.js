const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readSource(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

test('Friends screen passes compact layout styles to the Find players SectionCard', () => {
  const source = readSource('../src/screens/FriendsScreen.tsx');
  const findPlayersCard = source.match(/<SectionCard[\s\S]*?title="Find players"[\s\S]*?>/);

  assert.ok(findPlayersCard, 'Find players SectionCard should be present');
  assert.match(findPlayersCard[0], /style=\{styles\.findPlayersCard\}/);
  assert.match(findPlayersCard[0], /contentStyle=\{styles\.findPlayersContent\}/);
  assert.match(findPlayersCard[0], /titleStyle=\{styles\.findPlayersTitle\}/);
  assert.match(source, /findPlayersCard:\s*\{[\s\S]*?gap:\s*8,[\s\S]*?padding:\s*12,[\s\S]*?\}/);
  assert.match(source, /findPlayersContent:\s*\{[\s\S]*?gap:\s*8,[\s\S]*?\}/);
  assert.match(source, /findPlayersTitle:\s*\{[\s\S]*?fontSize:\s*17,[\s\S]*?lineHeight:\s*22,[\s\S]*?\}/);
});

test('PlayerSearchInput uses a compact input height instead of the previous 44px minimum', () => {
  const source = readSource('../src/components/friends/PlayerSearchInput.tsx');

  assert.doesNotMatch(source, /minHeight:\s*44\b/);
  assert.match(source, /minHeight:\s*34\b/);
});
