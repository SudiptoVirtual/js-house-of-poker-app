const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('node:path');

const controllerPath = require.resolve('../src/controllers/chatRoomController');
const notificationServicePath = require.resolve('../src/services/chatRoomNotificationService');
const presenceServicePath = require.resolve('../src/services/chatRoomPresenceService');

function installMockModule(resolvedPath, exports) {
  require.cache[resolvedPath] = { id: resolvedPath, filename: resolvedPath, loaded: true, path: path.dirname(resolvedPath), exports };
}

function createResponseRecorder() {
  return {
    body: null,
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('creating a private chat room adds an eligible online friend and sends their invite notification', async (t) => {
  const senderId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439051');
  const friendId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439052');
  const roomId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439053');
  const sender = { _id: senderId, name: 'Alice Player' };
  const friend = { _id: friendId, isOnline: true, name: 'Bob Friend' };
  const notificationCalls = [];
  const socketEvents = [];

  installMockModule(notificationServicePath, {
    createChatRoomInviteNotifications: async (input) => {
      notificationCalls.push(input);
      return [{ body: 'Alice Player invited you to Alice Player & Bob Friend.', userId: String(friendId) }];
    },
    serializeNotification: (notification) => notification,
  });
  installMockModule(presenceServicePath, {
    getChatRoomPresenceService: () => ({ getPresenceSnapshot: () => ({ activePlayerCount: 0, players: [] }) }),
  });
  delete require.cache[controllerPath];

  const ChatRoom = require('../src/models/ChatRoom');
  const ChatRoomMessage = require('../src/models/ChatRoomMessage');
  const User = require('../src/models/User');
  const originals = {
    chatRoomCreate: ChatRoom.create,
    chatRoomExists: ChatRoom.exists,
    messageFind: ChatRoomMessage.find,
    userFind: User.find,
    userFindById: User.findById,
  };
  t.after(() => {
    Object.assign(ChatRoom, { create: originals.chatRoomCreate, exists: originals.chatRoomExists });
    ChatRoomMessage.find = originals.messageFind;
    Object.assign(User, { find: originals.userFind, findById: originals.userFindById });
    delete require.cache[controllerPath];
    delete require.cache[notificationServicePath];
    delete require.cache[presenceServicePath];
    require('../src/sockets/socketRegistry').setIO(null);
  });

  User.findById = () => ({ select: async () => ({ friends: [friendId] }) });
  User.find = (filter) => {
    if (filter.referredByUserId) return { select: async () => [] };
    assert.deepEqual(filter._id.$in, [String(friendId)]);
    assert.equal(filter.isOnline, true);
    return { select: () => ({ sort: async () => [friend] }) };
  };
  ChatRoom.exists = async () => null;
  ChatRoom.create = async (input) => ({
    ...input,
    _id: roomId,
    toRoomListItem: () => ({ id: String(roomId), name: input.name, participantStates: input.participantStates }),
  });
  ChatRoomMessage.find = () => ({ sort: () => ({ limit: async () => [] }) });
  require('../src/sockets/socketRegistry').setIO({
    sockets: { sockets: new Map([['friend-socket', { data: { userId: String(friendId) }, emit: (event, payload) => socketEvents.push({ event, payload }) }]]) },
  });

  const { createChatRoom } = require('../src/controllers/chatRoomController');
  const response = createResponseRecorder();
  await createChatRoom({
    body: { invitedPlayerIds: [String(friendId)], name: 'Alice Player & Bob Friend' },
    user: sender,
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.invitedPlayerIds, [String(friendId)]);
  assert.deepEqual(response.body.room.participantStates.map(({ userId }) => String(userId)), [String(senderId), String(friendId)]);
  assert.equal(notificationCalls.length, 1);
  assert.deepEqual(notificationCalls[0].recipientUserIds, [String(friendId)]);
  assert.equal(notificationCalls[0].room._id, roomId);
  assert.equal(notificationCalls[0].sender, sender);
  assert.ok(socketEvents.some(({ event, payload }) => event === 'chat:roomInvited' && payload.roomId === String(roomId)));
});
