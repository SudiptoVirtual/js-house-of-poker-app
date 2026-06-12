const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const FeedPost = require('../src/models/FeedPost');
const GameTable = require('../src/models/GameTable');
const HandHistory = require('../src/models/HandHistory');
const controllerPath = require.resolve('../src/controllers/feedController');

const authorId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const tableId = new mongoose.Types.ObjectId();
const postId = new mongoose.Types.ObjectId();
const media = { metadata: { size: 100 }, mimeType: 'image/jpeg', type: 'image', url: 'https://cdn.example.com/post.jpg' };
const gameContext = { gameType: 'holdem', handId: `TABLE1:4`, handNumber: 4, headline: 'A win', resultLabel: 'Won 100 chips' };
function response() { return { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } }; }
function selectable(value) { return { select: async () => value }; }
function serialized(input) { return { id: String(postId), postKind: input.postKind, postType: input.postType }; }

function buildEditablePost(overrides = {}) {
  return {
    _id: postId,
    authorUserId: authorId,
    body: 'hello',
    gameContext: null,
    media: [],
    postKind: 'standard',
    postType: 'text',
    tableCode: '',
    tableContext: null,
    tableId: null,
    async save() {},
    toClient() { return { id: String(postId), postKind: this.postKind, postType: this.postType }; },
    ...overrides,
  };
}

test('post type validation accepts each valid type and rejects missing or unverified required data', async (t) => {
  const originals = { create: FeedPost.create, feedFindOne: FeedPost.findOne, tableFindOne: GameTable.findOne, handFindOne: HandHistory.findOne };
  let created;
  FeedPost.create = async (input) => { created = input; return { ...input, _id: postId, toClient: () => serialized(input) }; };
  FeedPost.findOne = (query) => selectable(null);
  GameTable.findOne = async () => ({ _id: tableId, maxPlayers: 6, players: [], status: 'waiting', tableCode: 'TABLE1' });
  HandHistory.findOne = () => selectable({ gameType: 'holdem', players: [{ userId: authorId, chipsWon: 100 }] });
  delete require.cache[controllerPath];
  t.after(() => { Object.assign(FeedPost, { create: originals.create, findOne: originals.feedFindOne }); GameTable.findOne = originals.tableFindOne; HandHistory.findOne = originals.handFindOne; delete require.cache[controllerPath]; });
  const { createPost } = require('../src/controllers/feedController');
  const invoke = async (body) => { const res = response(); await createPost({ body, user: { _id: authorId, name: 'Author' } }, res); return res; };

  for (const body of [
    { content: 'hello', postType: 'text' },
    { media: [media], postType: 'media' },
    { postType: 'table_invite', tableId: String(tableId) },
    { gameContext, postType: 'win_share', tableCode: 'TABLE1' },
  ]) {
    const res = await invoke(body);
    assert.equal(res.statusCode, 201, JSON.stringify(res.payload));
    assert.equal(res.payload.post.postType, body.postType);
    assert.equal(created.postType, body.postType);
  }

  assert.equal((await invoke({ postType: 'text' })).statusCode, 400);
  assert.equal((await invoke({ content: 'caption only', postType: 'media' })).statusCode, 400);
  GameTable.findOne = async () => null;
  assert.equal((await invoke({ postType: 'table_invite', tableCode: 'MISSING' })).payload.code, 'INVALID_TABLE_INVITE');
  HandHistory.findOne = () => selectable(null);
  assert.equal((await invoke({ gameContext, postType: 'win_share', tableCode: 'TABLE1' })).payload.code, 'INVALID_GAME_RESULT');
  assert.equal((await invoke({ content: 'bad', postType: 'unsupported' })).payload.code, 'INVALID_POST_TYPE');
});

test('table invite authorization and update ownership/type validation are enforced', async (t) => {
  const originals = { feedFindOne: FeedPost.findOne, tableFindOne: GameTable.findOne };
  GameTable.findOne = async () => ({ _id: tableId, chatRoomLaunchContext: { visibility: 'private' }, maxPlayers: 6, players: [], status: 'waiting', tableCode: 'TABLE1' });
  FeedPost.findOne = () => selectable(null);
  delete require.cache[controllerPath];
  t.after(() => { FeedPost.findOne = originals.feedFindOne; GameTable.findOne = originals.tableFindOne; delete require.cache[controllerPath]; });
  const { createPost, updatePost } = require('../src/controllers/feedController');
  let res = response();
  await createPost({ body: { postType: 'table_invite', tableCode: 'TABLE1' }, user: { _id: authorId, name: 'Author' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'TABLE_INVITE_FORBIDDEN');

  const editable = buildEditablePost();
  FeedPost.findOne = async () => editable;
  res = response(); await updatePost({ body: { content: 'changed' }, params: { postId: String(postId) }, user: { _id: otherId } }, res);
  assert.equal(res.statusCode, 403);
  res = response(); await updatePost({ body: { postType: 'media' }, params: { postId: String(postId) }, user: { _id: authorId } }, res);
  assert.equal(res.statusCode, 400); assert.equal(res.payload.code, 'POST_TYPE_IMMUTABLE');
  res = response(); await updatePost({ body: { content: '' }, params: { postId: String(postId) }, user: { _id: authorId } }, res);
  assert.equal(res.statusCode, 400); assert.equal(res.payload.code, 'INVALID_POST_TYPE_PAYLOAD');
});

test('FeedPost serializes the postType discriminant', () => {
  const post = new FeedPost({ _id: postId, authorSnapshot: { handle: '@author', name: 'Author' }, authorUserId: authorId, body: 'hello', postType: 'text' });
  assert.equal(post.toClient().postType, 'text');
});
