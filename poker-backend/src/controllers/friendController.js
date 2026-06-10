const mongoose = require("mongoose");

const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const {
  createFriendRequestAcceptedNotification,
  createFriendRequestDeclinedNotification,
  createFriendRequestNotification,
  emitFriendNotificationRecords,
} = require("../services/friendNotificationService");
const {
  emitFriendRequestAccepted,
  emitFriendRequestCreated,
  emitFriendRequestDeclined,
} = require("../sockets/friendSocket");

function normalizeObjectId(value) {
  const normalized = String(value || "").trim();

  if (!/^[a-f\d]{24}$/i.test(normalized) || !mongoose.Types.ObjectId.isValid(normalized)) {
    return null;
  }

  return normalized;
}

function areSameObjectId(first, second) {
  return String(first) === String(second);
}

function isBlockedAccount(user) {
  return Boolean(user?.isBlocked || user?.status === "blocked" || user?.status === "suspended");
}

function getFriendIds(user) {
  return new Set((user?.friends || []).map((friendId) => String(friendId)));
}

function serializeRequest(request) {
  if (!request) {
    return null;
  }

  return {
    id: String(request._id),
    senderUserId: String(request.senderUserId),
    receiverUserId: String(request.receiverUserId),
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

function emitFriendNotification(notificationRecord) {
  return emitFriendNotificationRecords(undefined, [notificationRecord]);
}

async function safelyCreateAndEmitFriendNotification(createNotification) {
  try {
    const notificationRecord = await createNotification();
    emitFriendNotification(notificationRecord);
    return notificationRecord;
  } catch (error) {
    console.error("Friend notification failed", error);
    return null;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSearchQuery(req) {
  return String(req.query?.q || req.query?.query || "").trim();
}

function buildSearchFilter(query, currentUserId) {
  const safeQuery = escapeRegExp(query);
  const containsQuery = new RegExp(safeQuery, "i");
  const emailPrefixQuery = new RegExp(`^${safeQuery}`, "i");

  return {
    _id: { $ne: currentUserId },
    isBlocked: { $ne: true },
    status: { $nin: ["blocked", "suspended"] },
    $or: [
      { name: containsQuery },
      { username: containsQuery },
      { handle: containsQuery },
      { displayName: containsQuery },
      { email: emailPrefixQuery },
      { phone: containsQuery },
    ],
  };
}

function serializeSearchPlayer(user, relationship) {
  const request = serializeRequest(relationship?.request);

  return {
    ...serializeFriend(user),
    displayName: user.displayName || user.name,
    handle: user.handle,
    relationshipStatus: relationship?.status || "not_friends",
    requestId: request?.id || null,
    request,
    username: user.username || user.handle || (user.email ? user.email.split("@")[0] : undefined),
  };
}

function buildRelationshipMap(currentUserId, currentUser, users, requests) {
  const friendIds = getFriendIds(currentUser);
  const relationships = new Map();

  for (const user of users) {
    const userId = String(user._id);

    relationships.set(userId, {
      status: friendIds.has(userId) ? "friend" : "not_friends",
      request: null,
    });
  }

  for (const request of requests) {
    const otherUserId = areSameObjectId(request.senderUserId, currentUserId)
      ? String(request.receiverUserId)
      : String(request.senderUserId);

    if (!relationships.has(otherUserId) || relationships.get(otherUserId).status === "friend") {
      continue;
    }

    const status = areSameObjectId(request.senderUserId, currentUserId)
      ? "request_sent"
      : "request_received";

    relationships.set(otherUserId, { status, request });
  }

  return relationships;
}

function serializeFriend(user) {
  return {
    id: String(user._id),
    userId: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    isOnline: Boolean(user.isOnline),
    status: user.status,
    playerStatus: user.playerStatus?.tier || "NO_STATUS",
    statusIcon: user.playerStatus?.iconKey || "badge-no-status",
  };
}

function buildStatusPayload(status, request = null) {
  const serializedRequest = serializeRequest(request);

  return {
    status,
    requestId: serializedRequest?.id || null,
    request: serializedRequest,
  };
}

async function getFriendshipStatus(currentUserId, otherUserId) {
  const [currentUser, otherUser] = await Promise.all([
    User.findById(currentUserId).select("friends isBlocked status"),
    User.findById(otherUserId).select("friends isBlocked status"),
  ]);

  if (!otherUser) {
    return { error: { code: 404, message: "User not found" } };
  }

  if (isBlockedAccount(otherUser)) {
    return { payload: buildStatusPayload("blocked") };
  }

  const pairKey = FriendRequest.buildFriendPairKey(currentUserId, otherUserId);
  const blockedRequest = await FriendRequest.findOne({ pairKey, status: "blocked" })
    .sort({ updatedAt: -1 })
    .select("senderUserId receiverUserId status createdAt updatedAt");

  if (blockedRequest) {
    return { payload: buildStatusPayload("blocked", blockedRequest) };
  }

  if (
    getFriendIds(currentUser).has(String(otherUserId)) ||
    getFriendIds(otherUser).has(String(currentUserId))
  ) {
    return { payload: buildStatusPayload("friends") };
  }

  const pendingRequest = await FriendRequest.findOne({ pairKey, status: "pending" })
    .sort({ createdAt: -1 })
    .select("senderUserId receiverUserId status createdAt updatedAt");

  if (pendingRequest) {
    const status = areSameObjectId(pendingRequest.senderUserId, currentUserId)
      ? "pending_sent"
      : "pending_received";

    return { payload: buildStatusPayload(status, pendingRequest) };
  }

  return { payload: buildStatusPayload("none") };
}

async function assertCanCreateRequest(senderUserId, receiverUserId) {
  const [sender, receiver] = await Promise.all([
    User.findById(senderUserId).select("friends isBlocked status"),
    User.findById(receiverUserId).select("friends isBlocked status"),
  ]);

  if (!receiver) {
    return { code: 404, message: "Receiver user not found" };
  }

  if (isBlockedAccount(sender)) {
    return { code: 403, message: "Your account is blocked" };
  }

  if (isBlockedAccount(receiver)) {
    return { code: 403, message: "Cannot send a friend request to this account" };
  }

  if (
    getFriendIds(sender).has(String(receiverUserId)) ||
    getFriendIds(receiver).has(String(senderUserId))
  ) {
    return { code: 409, message: "Users are already friends" };
  }

  const blockedRequest = await FriendRequest.exists({
    pairKey: FriendRequest.buildFriendPairKey(senderUserId, receiverUserId),
    status: "blocked",
  });

  if (blockedRequest) {
    return { code: 403, message: "Friend requests are blocked between these users" };
  }

  return null;
}

const requestFriend = async (req, res) => {
  try {
    const senderUserId = req.user._id;
    const receiverUserId = normalizeObjectId(req.body.receiverUserId || req.body.userId);

    if (!receiverUserId) {
      return res.status(400).json({ message: "A valid receiverUserId is required" });
    }

    if (areSameObjectId(senderUserId, receiverUserId)) {
      return res.status(400).json({ message: "You cannot send a friend request to yourself" });
    }

    const validationError = await assertCanCreateRequest(senderUserId, receiverUserId);
    if (validationError) {
      return res.status(validationError.code).json({ message: validationError.message });
    }

    const pairKey = FriendRequest.buildFriendPairKey(senderUserId, receiverUserId);
    const existingPending = await FriendRequest.findOne({ pairKey, status: "pending" });

    if (existingPending) {
      const status = areSameObjectId(existingPending.senderUserId, senderUserId)
        ? "pending_sent"
        : "pending_received";

      return res.status(409).json({
        message: "A pending friend request already exists",
        ...buildStatusPayload(status, existingPending),
      });
    }

    const request = await FriendRequest.create({
      senderUserId,
      receiverUserId,
      status: "pending",
    });

    const [sender, receiver] = await Promise.all([
      User.findById(request.senderUserId).select("name email avatar"),
      User.findById(request.receiverUserId).select("name email avatar"),
    ]);

    await safelyCreateAndEmitFriendNotification(() =>
      createFriendRequestNotification({ request, sender: sender || req.user, receiver })
    );
    emitFriendRequestCreated({ request, sender: sender || req.user, receiver });

    return res.status(201).json({
      message: "Friend request sent",
      ...buildStatusPayload("pending_sent", request),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "A pending friend request already exists" });
    }

    return res.status(500).json({ message: "Error sending friend request", error: error.message });
  }
};

async function findPendingRequestForReceiver(currentUserId, body) {
  if (body.requestId !== undefined) {
    const requestId = normalizeObjectId(body.requestId);

    if (!requestId) {
      return { error: { code: 400, message: "A valid requestId is required" } };
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      receiverUserId: currentUserId,
      status: "pending",
    });

    return { request };
  }

  const rawSenderUserId = body.senderUserId || body.userId;
  const senderUserId = normalizeObjectId(rawSenderUserId);

  if (!senderUserId) {
    return { error: { code: 400, message: "A valid requestId or senderUserId is required" } };
  }

  const request = await FriendRequest.findOne({
    pairKey: FriendRequest.buildFriendPairKey(currentUserId, senderUserId),
    receiverUserId: currentUserId,
    senderUserId,
    status: "pending",
  });

  return { request };
}

const acceptFriend = async (req, res) => {
  try {
    const { error: requestError, request } = await findPendingRequestForReceiver(req.user._id, req.body);

    if (requestError) {
      return res.status(requestError.code).json({ message: requestError.message });
    }

    if (!request) {
      return res.status(404).json({ message: "Pending friend request not found" });
    }

    const [sender, receiver] = await Promise.all([
      User.findById(request.senderUserId).select("friends isBlocked status name email avatar"),
      User.findById(request.receiverUserId).select("friends isBlocked status name email avatar"),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "Friend request user not found" });
    }

    if (isBlockedAccount(sender) || isBlockedAccount(receiver)) {
      return res.status(403).json({ message: "Cannot accept this friend request" });
    }

    const blockedRequest = await FriendRequest.exists({
      pairKey: request.pairKey,
      status: "blocked",
    });

    if (blockedRequest) {
      return res.status(403).json({ message: "Friend requests are blocked between these users" });
    }

    request.status = "accepted";
    await request.save();

    await Promise.all([
      User.updateOne(
        { _id: request.senderUserId },
        { $addToSet: { friends: request.receiverUserId } }
      ),
      User.updateOne(
        { _id: request.receiverUserId },
        { $addToSet: { friends: request.senderUserId } }
      ),
    ]);

    await safelyCreateAndEmitFriendNotification(() =>
      createFriendRequestAcceptedNotification({ request, sender, receiver })
    );
    emitFriendRequestAccepted({ request, sender, receiver });

    return res.status(200).json({
      message: "Friend request accepted",
      ...buildStatusPayload("friends", request),
    });
  } catch (error) {
    return res.status(500).json({ message: "Error accepting friend request", error: error.message });
  }
};

const declineFriend = async (req, res) => {
  try {
    const { error: requestError, request } = await findPendingRequestForReceiver(req.user._id, req.body);

    if (requestError) {
      return res.status(requestError.code).json({ message: requestError.message });
    }

    if (!request) {
      return res.status(404).json({ message: "Pending friend request not found" });
    }

    request.status = "declined";
    await request.save();

    const [sender, receiver] = await Promise.all([
      User.findById(request.senderUserId).select("name email avatar"),
      User.findById(request.receiverUserId).select("name email avatar"),
    ]);

    await safelyCreateAndEmitFriendNotification(() =>
      createFriendRequestDeclinedNotification({ request, sender, receiver: receiver || req.user })
    );
    emitFriendRequestDeclined({ request, sender, receiver: receiver || req.user });

    return res.status(200).json({
      message: "Friend request declined",
      ...buildStatusPayload("none", request),
    });
  } catch (error) {
    return res.status(500).json({ message: "Error declining friend request", error: error.message });
  }
};

const searchPlayers = async (req, res) => {
  try {
    const query = getSearchQuery(req);

    if (!query) {
      return res.status(200).json({ count: 0, players: [], query });
    }

    const currentUserId = req.user._id;
    const users = await User.find(buildSearchFilter(query, currentUserId))
      .select("name username handle displayName email avatar isOnline status playerStatus phone")
      .limit(25)
      .lean();

    const pairKeys = users.map((user) => FriendRequest.buildFriendPairKey(currentUserId, user._id));
    const pendingRequests = pairKeys.length
      ? await FriendRequest.find({ pairKey: { $in: pairKeys }, status: "pending" })
          .sort({ createdAt: -1 })
          .select("senderUserId receiverUserId status createdAt updatedAt")
          .lean()
      : [];
    const relationships = buildRelationshipMap(currentUserId, req.user, users, pendingRequests);
    const players = users.map((user) =>
      serializeSearchPlayer(user, relationships.get(String(user._id)))
    );

    return res.status(200).json({
      count: players.length,
      players,
      query,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error searching players", error: error.message });
  }
};

const getFriendStatus = async (req, res) => {
  try {
    const userId = normalizeObjectId(req.params.userId);

    if (!userId) {
      return res.status(400).json({ message: "A valid userId is required" });
    }

    if (areSameObjectId(req.user._id, userId)) {
      return res.status(400).json({ message: "Cannot fetch friend status for yourself" });
    }

    const { error, payload } = await getFriendshipStatus(req.user._id, userId);

    if (error) {
      return res.status(error.code).json({ message: error.message });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching friend status", error: error.message });
  }
};

const getIncomingFriendRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiverUserId: req.user._id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "senderUserId",
        select: "name username handle displayName email avatar isOnline status playerStatus",
      })
      .lean();

    const players = requests
      .filter((request) => request.senderUserId)
      .map((request) => {
        const sender = request.senderUserId;
        const serializedRequest = serializeRequest({ ...request, senderUserId: sender._id });

        return {
          ...serializeFriend(sender),
          displayName: sender.displayName || sender.name,
          handle: sender.handle,
          relationshipStatus: "pending_received",
          requestId: serializedRequest.id,
          request: serializedRequest,
          username:
            sender.username ||
            sender.handle ||
            (sender.email ? sender.email.split("@")[0] : undefined),
        };
      });

    return res.status(200).json({
      count: players.length,
      requests: players,
      status: "pending_received",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching incoming friend requests",
      error: error.message,
    });
  }
};

const getFriendList = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("friends")
      .populate({
        path: "friends",
        match: { isBlocked: { $ne: true }, status: { $nin: ["blocked", "suspended"] } },
        select: "name email avatar isOnline status playerStatus",
      });

    const friends = (user?.friends || []).filter(Boolean).map(serializeFriend);

    return res.status(200).json({
      count: friends.length,
      friends,
      status: "friends",
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching friend list", error: error.message });
  }
};

module.exports = {
  acceptFriend,
  declineFriend,
  getFriendList,
  getFriendStatus,
  getIncomingFriendRequests,
  requestFriend,
  searchPlayers,
};
