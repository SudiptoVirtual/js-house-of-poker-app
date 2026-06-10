const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');

const controllerPath = require.resolve('../src/controllers/friendController');
const notificationServicePath = require.resolve('../src/services/friendNotificationService');
function installMockModule(resolvedPath, exports) { require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, path: path.dirname(resolvedPath), exports }; }
function selectable(value) { return { select: async () => value }; }

test('receiver authenticated socket gets friends:request_received after POST /api/friends/request', async (t) => {
  installMockModule(notificationServicePath, { createFriendRequestAcceptedNotification: async () => null, createFriendRequestDeclinedNotification: async () => null, createFriendRequestNotification: async () => null, emitFriendNotificationRecords: () => false });
  delete require.cache[controllerPath];
  t.after(() => { delete require.cache[controllerPath]; delete require.cache[notificationServicePath]; });
  const senderId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439041');
  const receiverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439042');
  const requestId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439043');
  const sender = { _id: senderId, friends: [], name: 'Sender' };
  const receiver = { _id: receiverId, friends: [], name: 'Receiver' };
  const User = require('../src/models/User');
  const FriendRequest = require('../src/models/FriendRequest');
  const originals = { findById: User.findById, exists: FriendRequest.exists, findOne: FriendRequest.findOne, create: FriendRequest.create };
  t.after(() => { User.findById = originals.findById; FriendRequest.exists = originals.exists; FriendRequest.findOne = originals.findOne; FriendRequest.create = originals.create; });
  User.findById = (id) => selectable(String(id) === String(senderId) ? sender : receiver);
  FriendRequest.exists = async () => null;
  FriendRequest.findOne = async () => null;
  FriendRequest.create = async (input) => ({ _id: requestId, ...input, createdAt: new Date(), updatedAt: new Date() });
  const emitted = [];
  const { setIO } = require('../src/sockets/socketRegistry');
  setIO({ to(room) { return { emit(event, payload) { emitted.push({ event, payload, room }); } }; } });
  t.after(() => setIO(null));
  const { requestFriend } = require('../src/controllers/friendController');
  const app = express();
  app.use(express.json());
  app.post('/api/friends/request', (req, _res, next) => { req.user = sender; next(); }, requestFriend);
  const server = app.listen(0);
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/friends/request`, { body: JSON.stringify({ receiverUserId: String(receiverId) }), headers: { 'content-type': 'application/json' }, method: 'POST' });
  assert.equal(response.status, 201);
  const received = emitted.find(({ event, room }) => event === 'friends:request_received' && room === `user:${receiverId}`);
  assert.ok(received, 'authenticated receiver room should receive friends:request_received');
  assert.equal(received.payload.requestId, String(requestId));
  assert.equal(received.payload.otherUser.name, 'Sender');
});
