const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { setIO } = require("../src/sockets/socketRegistry");
const {
  FRIEND_SOCKET_EVENTS,
  emitFriendRequestAccepted,
  emitFriendRequestCreated,
  emitFriendRequestDeclined,
  getUserRoom,
  joinUserRoom,
} = require("../src/sockets/friendSocket");

const SENDER_ID = "507f1f77bcf86cd799439041";
const RECEIVER_ID = "507f1f77bcf86cd799439042";
const REQUEST_ID = "507f1f77bcf86cd799439043";

function objectId(value) {
  return new mongoose.Types.ObjectId(value);
}

function createRequest(status = "pending") {
  return {
    _id: objectId(REQUEST_ID),
    receiverUserId: objectId(RECEIVER_ID),
    senderUserId: objectId(SENDER_ID),
    status,
  };
}

function createUser(id, name) {
  return {
    _id: objectId(id),
    avatar: `https://example.test/${name}.png`,
    email: `${name}@example.test`,
    name,
  };
}

function createIoRecorder() {
  const emitted = [];

  return {
    emitted,
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ event, payload, room });
        },
      };
    },
  };
}

test("joinUserRoom joins a stable user room on authenticated sockets", (t) => {
  const joinedRooms = [];
  const socket = {
    data: {},
    join(room) {
      joinedRooms.push(room);
    },
  };

  t.after(() => setIO(null));

  assert.equal(getUserRoom(SENDER_ID), `user:${SENDER_ID}`);
  assert.equal(joinUserRoom(socket, SENDER_ID), `user:${SENDER_ID}`);
  assert.deepEqual(joinedRooms, [`user:${SENDER_ID}`]);
  assert.equal(socket.data.userRoom, `user:${SENDER_ID}`);
});

test("friend request realtime events emit request and status updates to both user rooms", (t) => {
  const io = createIoRecorder();
  setIO(io);
  t.after(() => setIO(null));

  emitFriendRequestCreated({
    receiver: createUser(RECEIVER_ID, "receiver"),
    request: createRequest(),
    sender: createUser(SENDER_ID, "sender"),
  });

  assert.deepEqual(
    io.emitted.map(({ event, room }) => `${room}:${event}`),
    [
      `user:${SENDER_ID}:${FRIEND_SOCKET_EVENTS.requestSent}`,
      `user:${RECEIVER_ID}:${FRIEND_SOCKET_EVENTS.requestReceived}`,
      `user:${SENDER_ID}:${FRIEND_SOCKET_EVENTS.statusUpdated}`,
      `user:${RECEIVER_ID}:${FRIEND_SOCKET_EVENTS.statusUpdated}`,
    ]
  );
  assert.equal(io.emitted[0].payload.status, "pending_sent");
  assert.equal(io.emitted[0].payload.otherUserId, RECEIVER_ID);
  assert.equal(io.emitted[1].payload.status, "pending_received");
  assert.equal(io.emitted[1].payload.otherUserId, SENDER_ID);
  assert.equal(io.emitted[1].payload.requestId, REQUEST_ID);
});

test("friend accept and decline realtime events emit status updates without table events", (t) => {
  const io = createIoRecorder();
  setIO(io);
  t.after(() => setIO(null));

  const sender = createUser(SENDER_ID, "sender");
  const receiver = createUser(RECEIVER_ID, "receiver");

  emitFriendRequestAccepted({ receiver, request: createRequest("accepted"), sender });
  emitFriendRequestDeclined({ receiver, request: createRequest("declined"), sender });

  assert.equal(io.emitted.length, 8);
  assert.equal(io.emitted.filter(({ event }) => event === FRIEND_SOCKET_EVENTS.requestAccepted).length, 2);
  assert.equal(io.emitted.filter(({ event }) => event === FRIEND_SOCKET_EVENTS.requestDeclined).length, 2);
  assert.equal(io.emitted.filter(({ event }) => event === FRIEND_SOCKET_EVENTS.statusUpdated).length, 4);
  assert.equal(io.emitted.some(({ event }) => event.startsWith("table:") || event.startsWith("room:")), false);
  assert.deepEqual([...new Set(io.emitted.map(({ payload }) => payload.status))], ["friends", "none"]);
});
