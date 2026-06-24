const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenSource = fs.readFileSync(
  path.resolve(__dirname, '../src/components/feed/PlayerFeedScreen.tsx'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.resolve(__dirname, '../src/services/api/feed.ts'),
  'utf8',
);

test('feed first page requests use a limit of 10', () => {
  assert.match(screenSource, /const FEED_PAGE_SIZE = 10;/);
  assert.match(screenSource, /fetchFeedPosts\(session\?\.token \?\? null, \{\s*limit: FEED_PAGE_SIZE,/);
  assert.match(apiSource, /params\.set\('limit', String\(options\.limit\)\);/);
});

test('feed next page requests send limit and cursor', () => {
  assert.match(screenSource, /const loadMoreFeedPosts = useCallback\(async \(\) => \{/);
  assert.match(screenSource, /fetchFeedPosts\(session\?\.token \?\? null, \{\s*limit: FEED_PAGE_SIZE,\s*cursor: nextFeedCursor,/);
  assert.match(apiSource, /params\.set\('cursor', options\.cursor\);/);
  assert.match(screenSource, /onEndReached=\{loadMoreFeedPosts\}/);
  assert.match(screenSource, /onEndReachedThreshold=\{0\.4\}/);
});

test('feed next pages append without duplicating existing post ids', () => {
  assert.match(screenSource, /const existingPostIds = new Set\(currentPosts\.map\(\(post\) => post\.id\)\);/);
  assert.match(screenSource, /const newPosts = response\.posts\.filter\(\(post\) => !existingPostIds\.has\(post\.id\)\);/);
  assert.match(screenSource, /return \[\.\.\.currentPosts, \.\.\.newPosts\];/);
});
