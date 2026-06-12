const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const feedPostPath = require.resolve('../src/models/FeedPost');
const handHistoryPath = require.resolve('../src/models/HandHistory');
const controllerPath = require.resolve('../src/controllers/feedController');
function mock(pathname, exports) { require.cache[pathname] = { id: pathname, filename: pathname, loaded: true, path: path.dirname(pathname), exports }; }
function response() { return { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } }; }
function selectable(value) { return { select: async () => value }; }

const userId = '507f1f77bcf86cd799439011';
const baseBody = { content: 'Great hand', postKind: 'share-win', tableCode: 'TABLE1', gameContext: { gameType: 'holdem', handId: 'TABLE1:12', handNumber: 12, headline: 'Shared a table win', resultLabel: 'Won 2,500 chips' }, tableContext: { gameLabel: 'holdem', tableCode: 'TABLE1', tableName: 'Friday' } };

test('Share Win creation rejects non-winners, prevents duplicates, and accepts verified winners', async (t) => {
  let handPlayers = [{ userId, chipsWon: 2500, chipsDelta: 1900 }];
  let duplicate = null;
  let createdInput = null;
  mock(handHistoryPath, { findOne: () => selectable({ gameType: 'holdem', players: handPlayers }) });
  mock(feedPostPath, {
    findOne: () => selectable(duplicate),
    create: async (input) => { createdInput = input; return { ...input, _id: 'post-1', toClient: () => ({ id: 'post-1', gameContext: input.gameContext, postKind: input.postKind, tableContext: input.tableContext }) }; },
  });
  delete require.cache[controllerPath];
  t.after(() => { delete require.cache[feedPostPath]; delete require.cache[handHistoryPath]; delete require.cache[controllerPath]; });
  const { createPost } = require('../src/controllers/feedController');

  handPlayers = [{ userId: '507f191e810c19729de860ea', chipsWon: 2500, chipsDelta: 1900 }];
  let res = response(); await createPost({ body: baseBody, user: { _id: userId, name: 'Alex' } }, res);
  assert.equal(res.statusCode, 403); assert.equal(res.payload.code, 'NOT_HAND_WINNER');

  handPlayers = [{ userId, chipsWon: 2500, chipsDelta: 1900 }]; duplicate = { _id: 'existing' };
  res = response(); await createPost({ body: baseBody, user: { _id: userId, name: 'Alex' } }, res);
  assert.equal(res.statusCode, 409); assert.equal(res.payload.code, 'DUPLICATE_WIN_SHARE');

  duplicate = null; res = response(); await createPost({ body: baseBody, user: { _id: userId, name: 'Alex' } }, res);
  assert.equal(res.statusCode, 201); assert.equal(createdInput.postKind, 'share-win'); assert.equal(createdInput.gameContext.handId, 'TABLE1:12'); assert.equal(res.payload.post.tableContext.tableCode, 'TABLE1');
});
