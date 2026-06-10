const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function compileTypeScript(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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

const realtimePayload = {
  otherUser: { email: 'sam@example.test', id: 'sender-1', name: 'Sam Sender' },
  request: { id: 'request-1' },
  requestId: 'request-1',
  status: 'pending_received',
};

test('fetchIncomingFriendRequests maps backend pending requests with their request ID', async () => {
  const calls = [];
  const { fetchIncomingFriendRequests } = compileTypeScript('../src/services/api/friends.ts', {
    './client': {
      ApiError: class ApiError extends Error {},
      apiRequest: async (route, options) => {
        calls.push([route, options]);
        return {
          requests: [{
            displayName: 'Sam Sender',
            id: 'sender-1',
            isOnline: true,
            relationshipStatus: 'pending_received',
            requestId: 'request-1',
            username: 'sam',
          }],
        };
      },
    },
  });

  const requests = await fetchIncomingFriendRequests('token-1');

  assert.deepEqual(calls, [['/api/friends/requests/incoming', { token: 'token-1' }]]);
  assert.equal(requests[0].relationshipStatus, 'request_received');
  assert.equal(requests[0].requestId, 'request-1');
  assert.equal(requests[0].id, 'sender-1');
});

test('a pending request survives accepted-friend refreshes and navigation until explicitly resolved', () => {
  const { mergeIncomingFriendRequest, mergeIncomingFriendRequests, removeIncomingFriendRequest } = compileTypeScript(
    '../src/services/friends/mergeFriendRealtimeEvent.ts',
  );
  const incomingRequests = mergeIncomingFriendRequest([], realtimePayload);
  const acceptedFriendsAfterRefresh = [];
  const incomingRequestsAfterNavigation = mergeIncomingFriendRequests(incomingRequests, []);

  assert.equal(acceptedFriendsAfterRefresh.length, 0);
  assert.equal(incomingRequestsAfterNavigation[0].requestId, 'request-1');
  assert.deepEqual(removeIncomingFriendRequest(incomingRequestsAfterNavigation, 'request-1', 'sender-1'), []);
});

test('pull-to-refresh can reconcile incoming requests from the backend without a search', () => {
  const { mergeIncomingFriendRequests } = compileTypeScript('../src/services/friends/mergeFriendRealtimeEvent.ts');
  const refreshedIncomingRequests = [{
    activityStatus: 'online',
    displayName: 'Sam Sender',
    id: 'sender-1',
    isOnline: true,
    relationshipStatus: 'request_received',
    requestId: 'request-1',
    username: 'sam',
  }];

  const previousRealtimeRequest = { ...refreshedIncomingRequests[0], id: 'stale-sender', requestId: 'stale-request' };
  const reconciledRequests = refreshedIncomingRequests;
  const nonReconcilingLoad = mergeIncomingFriendRequests([previousRealtimeRequest], refreshedIncomingRequests);

  assert.equal(reconciledRequests[0].requestId, 'request-1');
  assert.equal(reconciledRequests.some((player) => player.requestId === 'stale-request'), false);
  assert.equal(nonReconcilingLoad.some((player) => player.requestId === 'stale-request'), true);
});
