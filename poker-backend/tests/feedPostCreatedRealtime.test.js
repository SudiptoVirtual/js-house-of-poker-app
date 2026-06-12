const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');

const express = require('express');
const { Server } = require('socket.io');
const requireClientDependency = createRequire(require.resolve('../../js-house-of-poker/package.json'));
const { io: createSocketClient } = requireClientDependency('socket.io-client');

const feedPostModelPath = require.resolve('../src/models/FeedPost');
const feedControllerPath = require.resolve('../src/controllers/feedController');
const feedRealtimeServicePath = require.resolve('../src/services/feedRealtimeService');

function installMockModule(resolvedPath, exports) {
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    path: path.dirname(resolvedPath),
    exports,
  };
}

function waitForSocketEvent(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), 2000);

    socket.once(eventName, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

function connectAndJoinFeed(url, token) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(url, {
      auth: { token },
      transports: ['websocket'],
    });
    const timeout = setTimeout(() => reject(new Error('Timed out joining the global feed')), 2000);

    socket.on('connect_error', reject);
    socket.on('feed:joined', (payload) => {
      clearTimeout(timeout);
      resolve({ payload, socket });
    });
    socket.on('connect', () => socket.emit('feed:join', { token }));
  });
}

test('POST /api/feed broadcasts the serialized created post to other authenticated global-feed sockets', async (t) => {
  const authorId = '507f1f77bcf86cd799439011';
  const viewerId = '507f191e810c19729de860ea';
  const postId = '507f1f77bcf86cd799439012';
  const usersByToken = new Map([
    ['author-token', { _id: authorId, name: 'Author Player', username: 'author' }],
    ['viewer-token', { _id: viewerId, name: 'Viewer Player', username: 'viewer' }],
  ]);
  let serializeCallCount = 0;
  const serializedPost = {
    author: { id: authorId, name: 'Author Player' },
    body: 'Realtime from REST',
    id: postId,
    postType: 'text',
    supportedByCurrentPlayer: false,
  };

  installMockModule(feedPostModelPath, {
    create: async () => ({
      _id: postId,
      authorUserId: authorId,
      toClient: () => {
        serializeCallCount += 1;
        return serializedPost;
      },
    }),
  });
  delete require.cache[feedControllerPath];
  delete require.cache[feedRealtimeServicePath];
  t.after(() => {
    delete require.cache[feedPostModelPath];
    delete require.cache[feedControllerPath];
    delete require.cache[feedRealtimeServicePath];
  });

  const { createPost } = require('../src/controllers/feedController');
  const { createFeedRealtimeService, FEED_GLOBAL_ROOM } = require('../src/services/feedRealtimeService');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const realtimeService = createFeedRealtimeService(io, {
    authenticateSocketUser: async (socket, payload) => {
      const user = usersByToken.get(payload.token || socket.handshake.auth.token);
      if (!user) throw new Error('Not authorized');
      return user;
    },
  });

  io.on('connection', (socket) => {
    socket.on('feed:join', (payload) => void realtimeService.join(socket, payload));
  });
  app.use(express.json());
  app.post('/api/feed', (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    req.user = usersByToken.get(token);
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });
    return createPost(req, res, next);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await io.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const authorConnection = await connectAndJoinFeed(url, 'author-token');
  const viewerConnection = await connectAndJoinFeed(url, 'viewer-token');
  t.after(() => {
    authorConnection.socket.close();
    viewerConnection.socket.close();
  });

  assert.equal(authorConnection.payload.roomIds.includes(FEED_GLOBAL_ROOM), true);
  assert.equal(viewerConnection.payload.roomIds.includes(FEED_GLOBAL_ROOM), true);

  const receivedByViewer = waitForSocketEvent(viewerConnection.socket, 'feed:post:created');
  const response = await fetch(`${url}/api/feed`, {
    body: JSON.stringify({ content: serializedPost.body }),
    headers: {
      authorization: 'Bearer author-token',
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const responseBody = await response.json();
  const eventPayload = await receivedByViewer;

  assert.equal(response.status, 201);
  assert.equal(serializeCallCount, 1);
  assert.deepEqual(eventPayload, {
    ok: true,
    post: serializedPost,
    postType: 'text',
    userId: authorId,
  });
  assert.strictEqual(responseBody.post.id, eventPayload.post.id);
  assert.deepEqual(responseBody.post, eventPayload.post);
});
