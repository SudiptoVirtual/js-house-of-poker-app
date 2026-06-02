function normalizeRoomId(value) {
  return String(value || "").trim();
}

function normalizeUserId(user) {
  return String(user?._id || user?.userId || user?.id || "").trim();
}

function getDisplayName(user) {
  return user?.displayName || user?.name || user?.username || user?.email || "Player";
}

function getAvatar(user) {
  return user?.avatar || user?.avatarUrl || user?.photoURL || user?.profileImageUrl || "";
}

function getAvatarInitials(displayName) {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P"
  );
}

function serializeDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return date.toISOString();
}

function buildPresencePlayer(entry, inviteEligibility = {}) {
  const socketIds = [...entry.socketIds];
  const socketId = socketIds[socketIds.length - 1] || null;
  const displayName = entry.displayName;

  return {
    avatar: entry.avatar,
    avatarInitials: getAvatarInitials(displayName),
    chipStackLabel: "",
    displayName,
    handle: entry.handle || displayName,
    id: entry.userId,
    inviteEligible: Boolean(inviteEligibility.eligibleByUserId?.get(entry.userId) ?? entry.isOnline),
    inviteEligibilityReason: inviteEligibility.reasonByUserId?.get(entry.userId) || null,
    isConnected: entry.isOnline,
    isOnline: entry.isOnline,
    joinedAt: serializeDate(entry.joinedAt),
    lastSeenAt: serializeDate(entry.lastSeenAt),
    socketCount: socketIds.length,
    socketId,
    socketIds,
    status: entry.isOnline ? "available" : "away",
    userId: entry.userId,
  };
}

class ChatRoomPresenceService {
  constructor() {
    this.presenceByRoomId = new Map();
    this.roomIdsBySocketId = new Map();
  }

  addPresence(roomId, user, socket) {
    const roomKey = normalizeRoomId(roomId);
    const userId = normalizeUserId(user);
    const socketId = socket?.id ? String(socket.id) : "";

    if (!roomKey) {
      throw new Error("Chat room id is required.");
    }

    if (!userId) {
      throw new Error("Authenticated user id is required for chat room presence.");
    }

    if (!socketId) {
      throw new Error("Socket id is required for chat room presence.");
    }

    const now = new Date();
    const presence = this.presenceByRoomId.get(roomKey) || new Map();
    const displayName = getDisplayName(user);
    const existing = presence.get(userId);

    if (existing) {
      existing.avatar = getAvatar(user) || existing.avatar;
      existing.displayName = displayName;
      existing.handle = user?.handle || user?.username || existing.handle || displayName;
      existing.isOnline = true;
      existing.lastSeenAt = now;
      existing.socketIds.add(socketId);
    } else {
      presence.set(userId, {
        avatar: getAvatar(user),
        displayName,
        handle: user?.handle || user?.username || displayName,
        isOnline: true,
        joinedAt: now,
        lastSeenAt: now,
        socketIds: new Set([socketId]),
        userId,
      });
    }

    this.presenceByRoomId.set(roomKey, presence);
    this.trackSocketRoom(socketId, roomKey);
    return this.getPresenceSnapshot(roomKey);
  }

  trackSocketRoom(socketId, roomId) {
    const socketKey = String(socketId || "").trim();
    const roomKey = normalizeRoomId(roomId);

    if (!socketKey || !roomKey) {
      return;
    }

    const roomIds = this.roomIdsBySocketId.get(socketKey) || new Set();
    roomIds.add(roomKey);
    this.roomIdsBySocketId.set(socketKey, roomIds);
  }

  untrackSocketRoom(socketId, roomId) {
    const socketKey = String(socketId || "").trim();
    const roomKey = normalizeRoomId(roomId);
    const roomIds = this.roomIdsBySocketId.get(socketKey);

    if (!roomIds) {
      return;
    }

    roomIds.delete(roomKey);

    if (roomIds.size === 0) {
      this.roomIdsBySocketId.delete(socketKey);
    }
  }

  removePresence(roomId, socket, { keepOffline = false } = {}) {
    const roomKey = normalizeRoomId(roomId);
    const socketId = socket?.id ? String(socket.id) : String(socket || "").trim();
    const presence = this.presenceByRoomId.get(roomKey);

    if (!roomKey || !socketId || !presence) {
      return this.getPresenceSnapshot(roomKey);
    }

    const now = new Date();

    [...presence.entries()].forEach(([userId, entry]) => {
      if (!entry.socketIds.has(socketId)) {
        return;
      }

      entry.socketIds.delete(socketId);
      entry.lastSeenAt = now;

      if (entry.socketIds.size === 0) {
        if (keepOffline) {
          entry.isOnline = false;
        } else {
          presence.delete(userId);
        }
      }
    });

    if (presence.size === 0) {
      this.presenceByRoomId.delete(roomKey);
    }

    this.untrackSocketRoom(socketId, roomKey);
    return this.getPresenceSnapshot(roomKey);
  }

  removeSocketFromAllRooms(socket, options = {}) {
    const socketId = socket?.id ? String(socket.id) : String(socket || "").trim();
    const roomIds = [...(this.roomIdsBySocketId.get(socketId) || [])];

    roomIds.forEach((roomId) => {
      this.removePresence(roomId, socketId, options);
    });

    this.roomIdsBySocketId.delete(socketId);
    return roomIds;
  }

  getPresenceSnapshot(roomId, { excludedUserIds = [], invitedPlayerIds = [] } = {}) {
    const roomKey = normalizeRoomId(roomId);
    const presence = this.presenceByRoomId.get(roomKey);
    const excludedIds = new Set(excludedUserIds.map(String));
    const invitedIds = new Set(invitedPlayerIds.map(String));
    const eligibleByUserId = new Map();
    const reasonByUserId = new Map();

    const players = presence
      ? [...presence.values()]
          .sort((left, right) => left.displayName.localeCompare(right.displayName))
          .map((entry) => {
            let eligible = entry.isOnline;
            let reason = eligible ? null : "offline";

            if (excludedIds.has(entry.userId)) {
              eligible = false;
              reason = "excluded";
            } else if (invitedIds.has(entry.userId)) {
              eligible = false;
              reason = "already-invited";
            }

            eligibleByUserId.set(entry.userId, eligible);
            reasonByUserId.set(entry.userId, reason);

            return buildPresencePlayer(entry, { eligibleByUserId, reasonByUserId });
          })
      : [];

    const inviteEligiblePlayerIds = players
      .filter((player) => player.inviteEligible)
      .map((player) => player.userId);

    return {
      activePlayerCount: players.filter((player) => player.isOnline).length,
      inviteEligibility: {
        eligiblePlayerIds: inviteEligiblePlayerIds,
        invitedPlayerIds: [...invitedIds],
      },
      players,
      roomId: roomKey,
      totalPlayerCount: players.length,
      updatedAt: new Date().toISOString(),
    };
  }

  getRoomIdsForSocket(socket) {
    const socketId = socket?.id ? String(socket.id) : String(socket || "").trim();
    return [...(this.roomIdsBySocketId.get(socketId) || [])];
  }
}

const chatRoomPresenceService = new ChatRoomPresenceService();

module.exports = {
  ChatRoomPresenceService,
  chatRoomPresenceService,
  getChatRoomPresenceService: () => chatRoomPresenceService,
};
