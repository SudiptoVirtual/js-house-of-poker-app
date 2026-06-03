const { createFeedRealtimeService, emitAck } = require("../services/feedRealtimeService");
const { getPlayerRealtimeService } = require("./playerGameSocket");
const { mapRealtimeError } = require("./socketErrorUtils");

function withFeedErrorBoundary(socket, ack, handler) {
  Promise.resolve()
    .then(handler)
    .catch((error) => {
      const payload = mapRealtimeError(error);
      socket.emit("feed:error", payload);
      emitAck(ack, { ok: false, error: payload });
    });
}

function initFeedSocket(io) {
  const playerRealtimeService = getPlayerRealtimeService(io);
  const feedRealtimeService = createFeedRealtimeService(io, {
    authenticateSocketUser: playerRealtimeService.authenticateSocketUser.bind(playerRealtimeService),
    onTableInvitesUpdated: async (table) => {
      const room = table.tableCode ? playerRealtimeService.rooms.get(table.tableCode) : null;
      if (room) {
        room.tableInvites = JSON.parse(JSON.stringify(table.tableInvites || []));
        await playerRealtimeService.emitRoomState(room);
      }
    },
  });

  io.on("connection", (socket) => {
    socket.on("feed:join", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.join(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:leave", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.leave(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:post:create", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.createPost(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:comment:create", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.createComment(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:support:toggle", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.toggleSupport(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:share:create", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.createShare(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:giftClips:send", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.sendGiftClips(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:promote:create", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.createPromotion(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("feed:tableInvite:send", (payload = {}, ack) => {
      withFeedErrorBoundary(socket, ack, async () => {
        const response = await feedRealtimeService.sendTableInvite(socket, payload);
        emitAck(ack, response);
      });
    });

    socket.on("disconnect", () => {
      feedRealtimeService.leaveAll(socket);
    });
  });
}

module.exports = {
  initFeedSocket,
};
