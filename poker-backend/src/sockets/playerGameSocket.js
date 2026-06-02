const { createPokerRealtimeService } = require("../services/pokerRealtimeService");
const { withSocketErrorBoundary } = require("./socketErrorUtils");

let realtimeService = null;

function getPlayerRealtimeService(io) {
  if (!realtimeService) {
    realtimeService = createPokerRealtimeService(io);
  }

  return realtimeService;
}

function initPlayerGameSocket(io) {
  realtimeService = getPlayerRealtimeService(io);

  io.on("connection", (socket) => {
    socket.on("network:ping", (payload = {}, ack) => {
      if (typeof ack === "function") {
        ack({
          sentAt: payload.sentAt || null,
          serverTime: Date.now(),
        });
      }
    });

    socket.on("table:create", (payload = {}) => {
      withSocketErrorBoundary(socket, () => realtimeService.createRoom(socket, payload));
    });

    socket.on("player:create_room", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.createRoom(socket, payload)
      );
    });

    socket.on("table:join", (payload = {}) => {
      withSocketErrorBoundary(socket, () => realtimeService.joinRoom(socket, payload));
    });

    socket.on("player:join_room", (payload = {}) => {
      withSocketErrorBoundary(socket, () => realtimeService.joinRoom(socket, payload));
    });

    socket.on("table:leave", () => {
      withSocketErrorBoundary(socket, () => realtimeService.leaveRoom(socket));
    });

    socket.on("player:leave_room", () => {
      withSocketErrorBoundary(socket, () => realtimeService.leaveRoom(socket));
    });

    socket.on("game:start", () => {
      withSocketErrorBoundary(socket, () => realtimeService.startGame(socket));
    });

    socket.on("player:start_hand", () => {
      withSocketErrorBoundary(socket, () => realtimeService.startGame(socket));
    });

    socket.on("game:action", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.performAction(socket, payload.type, payload.amount)
      );
    });

    socket.on("player:action", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.performAction(socket, payload.type, payload.amount)
      );
    });

    socket.on("game:rebuy", () => {
      withSocketErrorBoundary(socket, () => realtimeService.rebuy(socket));
    });

    socket.on("player:rebuy", () => {
      withSocketErrorBoundary(socket, () => realtimeService.rebuy(socket));
    });

    socket.on("game:settings:update", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.updateGameSettings(socket, payload)
      );
    });

    socket.on("table:sit", (payload = {}) => {
      withSocketErrorBoundary(socket, () => realtimeService.sitAtSeat(socket, payload));
    });

    socket.on("table:chat:send", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.sendTableChatMessage(socket, payload)
      );
    });

    socket.on("player:chat:send", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.sendTableChatMessage(socket, payload)
      );
    });

    socket.on("table:invite:send", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.sendTableInvite(socket, payload)
      );
    });

    socket.on("player:invite_send", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.sendTableInvite(socket, payload)
      );
    });

    socket.on("session:resume", (payload = {}) => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.resumeSession(socket, payload)
      );
    });

    socket.on("disconnect", () => {
      withSocketErrorBoundary(socket, () =>
        realtimeService.markPlayerTemporarilyDisconnected(socket)
      );
    });
  });
}

module.exports = {
  getPlayerRealtimeService,
  initPlayerGameSocket,
};
