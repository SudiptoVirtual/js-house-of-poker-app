const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadMergeRealtimePostList() {
  const filename = path.resolve(__dirname, '../src/components/feed/mergeRealtimePostList.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiledModule = new Module(filename, module);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule._compile(output, filename);
  return compiledModule.exports.mergeRealtimePostList;
}

const mergeRealtimePostList = loadMergeRealtimePostList();
const existingPost = { body: 'Older post', id: 'older-post', supportedByCurrentPlayer: false };
const serializedCreatedPost = {
  body: 'Created through POST /api/feed',
  id: 'created-post',
  supportedByCurrentPlayer: false,
};

test('a received feed:post:created serialized post is inserted at the top without a refresh', () => {
  const nextPosts = mergeRealtimePostList([existingPost], serializedCreatedPost, {
    currentUserId: 'viewer-id',
    eventUserId: 'author-id',
  });

  assert.deepEqual(nextPosts, [serializedCreatedPost, existingPost]);
});

test('the author response and matching realtime serialized post merge without duplication in either arrival order', () => {
  const options = { currentUserId: 'author-id', eventUserId: 'author-id' };
  const realtimePayloadPost = { ...serializedCreatedPost };
  const httpResponsePost = { ...serializedCreatedPost };
  const realtimeThenResponse = mergeRealtimePostList(
    mergeRealtimePostList([existingPost], realtimePayloadPost, options),
    httpResponsePost,
    options,
  );
  const responseThenRealtime = mergeRealtimePostList(
    mergeRealtimePostList([existingPost], httpResponsePost, options),
    realtimePayloadPost,
    options,
  );

  assert.deepEqual(realtimeThenResponse, [httpResponsePost, existingPost]);
  assert.deepEqual(responseThenRealtime, [realtimePayloadPost, existingPost]);
  assert.equal(realtimeThenResponse.filter((post) => post.id === serializedCreatedPost.id).length, 1);
  assert.equal(responseThenRealtime.filter((post) => post.id === serializedCreatedPost.id).length, 1);
});
