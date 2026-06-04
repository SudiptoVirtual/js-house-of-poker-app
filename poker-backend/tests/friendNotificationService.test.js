const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Notification = require("../src/models/Notification");
const {
  buildFriendNotificationData,
  createFriendRequestAcceptedNotification,
  createFriendRequestDeclinedNotification,
  createFriendRequestNotification,
  emitFriendNotificationRecords,
} = require("../src/services/friendNotificationService");

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

function createSender() {
  return {
    _id: objectId(SENDER_ID),
    avatar: "https://example.test/sender.png",
    email: "sender@example.test",
    name: "Sender Player",
  };
}

function createReceiver() {
  return {
    _id: objectId(RECEIVER_ID),
    avatar: "https://example.test/receiver.png",
    email: "receiver@example.test",
    name: "Receiver Player",
  };
}

test("Notification model supports friend notification types", () => {
  assert.ok(Notification.NOTIFICATION_TYPES.includes("friend_request"));
  assert.ok(Notification.NOTIFICATION_TYPES.includes("friend_request_accepted"));
  assert.ok(Notification.NOTIFICATION_TYPES.includes("friend_request_declined"));
});

test("buildFriendNotificationData includes request action metadata", () => {
  const data = buildFriendNotificationData({
    actionType: "friend_request",
    actions: ["accept", "decline", "view_profile"],
    request: createRequest(),
    sender: createSender(),
    responder: createReceiver(),
  });

  assert.deepEqual(data, {
    actionType: "friend_request",
    requestId: REQUEST_ID,
    senderUserId: SENDER_ID,
    senderName: "Sender Player",
    senderAvatar: "https://example.test/sender.png",
    responderUserId: RECEIVER_ID,
    responderName: "Receiver Player",
    responderAvatar: "https://example.test/receiver.png",
    status: "pending",
    actions: ["accept", "decline", "view_profile"],
  });
});

test("createFriendRequestNotification persists receiver action metadata", async (t) => {
  const originalCreate = Notification.create;
  let createdDoc = null;

  Notification.create = async function createStub(doc) {
    createdDoc = doc;
    return {
      ...doc,
      _id: objectId("507f1f77bcf86cd799439044"),
      createdAt: new Date("2026-06-04T12:00:00.000Z"),
      readAt: null,
    };
  };
  t.after(() => {
    Notification.create = originalCreate;
  });

  await createFriendRequestNotification({
    request: createRequest(),
    sender: createSender(),
    receiver: createReceiver(),
  });

  assert.equal(createdDoc.type, "friend_request");
  assert.equal(String(createdDoc.userId), RECEIVER_ID);
  assert.equal(String(createdDoc.actorUserId), SENDER_ID);
  assert.equal(createdDoc.data.actionType, "friend_request");
  assert.equal(createdDoc.data.requestId, REQUEST_ID);
  assert.deepEqual(createdDoc.data.actions, ["accept", "decline", "view_profile"]);
  assert.equal(createdDoc.data.senderUserId, SENDER_ID);
  assert.equal(createdDoc.data.senderName, "Sender Player");
  assert.equal(createdDoc.data.senderAvatar, "https://example.test/sender.png");
});

test("accepted and declined friend notifications target original sender", async (t) => {
  const originalCreate = Notification.create;
  const createdDocs = [];

  Notification.create = async function createStub(doc) {
    createdDocs.push(doc);
    return doc;
  };
  t.after(() => {
    Notification.create = originalCreate;
  });

  await createFriendRequestAcceptedNotification({
    request: createRequest("accepted"),
    sender: createSender(),
    receiver: createReceiver(),
  });
  await createFriendRequestDeclinedNotification({
    request: createRequest("declined"),
    sender: createSender(),
    receiver: createReceiver(),
  });

  assert.deepEqual(createdDocs.map((doc) => doc.type), [
    "friend_request_accepted",
    "friend_request_declined",
  ]);
  assert.deepEqual(createdDocs.map((doc) => String(doc.userId)), [SENDER_ID, SENDER_ID]);
  assert.deepEqual(createdDocs.map((doc) => String(doc.actorUserId)), [RECEIVER_ID, RECEIVER_ID]);
  assert.equal(createdDocs[0].data.actionType, "friend_request_accepted");
  assert.equal(createdDocs[0].data.status, "accepted");
  assert.deepEqual(createdDocs[0].data.actions, ["view_profile"]);
  assert.equal(createdDocs[1].data.actionType, "friend_request_declined");
  assert.equal(createdDocs[1].data.status, "declined");
});

test("emitFriendNotificationRecords emits friend and generic events to matching users", () => {
  const recipientEmits = [];
  const otherEmits = [];
  const io = {
    sockets: {
      sockets: new Map([
        ["recipient", { data: { userId: RECEIVER_ID }, emit: (event, payload) => recipientEmits.push({ event, payload }) }],
        ["other", { data: { userId: SENDER_ID }, emit: (event, payload) => otherEmits.push({ event, payload }) }],
      ]),
    },
  };

  emitFriendNotificationRecords(io, [
    new Notification({
      _id: objectId("507f1f77bcf86cd799439045"),
      actorUserId: SENDER_ID,
      body: "Sender Player sent you a friend request.",
      data: { actionType: "friend_request", requestId: REQUEST_ID },
      title: "New friend request",
      type: "friend_request",
      userId: RECEIVER_ID,
    }),
  ]);

  assert.deepEqual(recipientEmits.map((entry) => entry.event), ["friend:notification", "notification:new"]);
  assert.equal(recipientEmits[0].payload.notification.type, "friend_request");
  assert.equal(recipientEmits[0].payload.notification.data.requestId, REQUEST_ID);
  assert.equal(otherEmits.length, 0);
});
