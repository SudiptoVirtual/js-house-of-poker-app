const http = require('http');
const { Server } = require('socket.io');

const {
  buildPlayerStatusPatch,
  buildRoomState,
  createRoom,
  joinRoom,
  leaveRoom,
  performAction,
  rebuy,
  removePendingPlayers,
  sendTableInvite,
  startHand,
  updateGameSettings,
} = require('./game');
const { appendTableChatMessage } = require('./tableChat');

const PORT = Number(process.env.PORT) || 3001;
const rooms = new Map();
const sessions = new Map();

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: true, rooms: rooms.size, service: 'house-of-poker-socket-server' }));
});

const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

function buildStatusSnapshotByPlayerId(room) {
  return Object.fromEntries(
    room.players.map((player) => [player.id, buildPlayerStatusPatch(player)]),
  );
}

function hasStatusPatchChanged(previousPatch, nextPatch) {
  if (!previousPatch) {
    return true;
  }

  return (
    previousPatch.statusTier !== nextPatch.statusTier ||
    previousPatch.statusScore !== nextPatch.statusScore ||
    previousPatch.statusMomentum !== nextPatch.statusMomentum ||
    previousPatch.netChipBalance !== nextPatch.netChipBalance ||
    previousPatch.statusUpdatedAt !== nextPatch.statusUpdatedAt
  );
}

function emitPlayerStatusUpdates(room, previousStatusByPlayerId = {}) {
  room.players.forEach((player) => {
    const statusPatch = buildPlayerStatusPatch(player);
    if (!hasStatusPatchChanged(previousStatusByPlayerId[player.id], statusPatch)) {
      return;
    }

    io.to(room.id).emit('player:statusUpdated', statusPatch);
  });
}

function withPlayerStatusUpdates(room, updater) {
  const previousStatusByPlayerId = buildStatusSnapshotByPlayerId(room);
  updater();
  emitPlayerStatusUpdates(room, previousStatusByPlayerId);
}

function emitRoomState(room) {
  room.players.forEach((player) => {
    if (!player.socketId) {
      return;
    }

    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('room:state', buildRoomState(room, player.id));
    }
  });
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  removePendingPlayers(room);
  if (room.players.length === 0) {
    rooms.delete(roomId);
  }
}

function requireSession(socket) {
  const session = sessions.get(socket.id);
  if (!session) {
    throw new Error('You are not seated in a room.');
  }

  const room = rooms.get(session.roomId);
  if (!room) {
    sessions.delete(socket.id);
    throw new Error('Room no longer exists.');
  }

  return { room, session };
}

function seatName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function leaveCurrentRoom(socket, { notifySelf } = { notifySelf: true }) {
  const session = sessions.get(socket.id);
  if (!session) {
    if (notifySelf) {
      socket.emit('room:left');
    }
    return;
  }

  const room = rooms.get(session.roomId);
  sessions.delete(socket.id);
  socket.leave(session.roomId);

  if (!room) {
    if (notifySelf) {
      socket.emit('room:left');
    }
    return;
  }

  leaveRoom(room, session.playerId);
  if (notifySelf) {
    socket.emit('room:left');
  }
  emitRoomState(room);
  cleanupRoom(session.roomId);
}

function withErrorBoundary(socket, handler) {
  try {
    handler();
  } catch (error) {
    socket.emit('room:error', { message: error.message || 'Unexpected server error.' });
  }
}

io.on('connection', (socket) => {
  function handleTableChat(payload) {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      const player = room.players.find((candidate) => candidate.id === session.playerId);
      if (!player) {
        throw new Error('Player not found.');
      }

      const chatMessage = appendTableChatMessage(room, {
        message: payload?.message ?? payload?.text,
        playerId: player.id,
        playerName: player.name,
      });

      io.to(room.id).emit('table:chat:message', {
        chatMessage,
        roomId: room.id,
      });
      io.to(room.id).emit('room:chat_message', {
        chatMessage,
        roomId: room.id,
      });
      emitRoomState(room);
    });
  }

  socket.on('player:create_room', (payload) => {
    withErrorBoundary(socket, () => {
      const name = seatName(payload?.name);
      if (!name) {
        throw new Error('Player name is required.');
      }

      leaveCurrentRoom(socket, { notifySelf: false });
      const { player, room } = createRoom(rooms, socket.id, name);
      sessions.set(socket.id, { playerId: player.id, roomId: room.id });
      socket.join(room.id);
      socket.emit('room:state', buildRoomState(room, player.id));
    });
  });

  socket.on('player:join_room', (payload) => {
    withErrorBoundary(socket, () => {
      const name = seatName(payload?.name);
      const roomId = seatName(payload?.roomId).toUpperCase();
      if (!name || !roomId) {
        throw new Error('Player name and room code are required.');
      }

      const room = rooms.get(roomId);
      if (!room) {
        throw new Error('Room not found.');
      }

      leaveCurrentRoom(socket, { notifySelf: false });
      const player = joinRoom(room, socket.id, name);
      sessions.set(socket.id, { playerId: player.id, roomId: room.id });
      socket.join(room.id);
      emitRoomState(room);
    });
  });

  socket.on('player:start_hand', () => {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      startHand(room, session.playerId);
      emitRoomState(room);
      cleanupRoom(session.roomId);
    });
  });

  socket.on('player:action', (payload) => {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      withPlayerStatusUpdates(room, () => {
        const actionIntent = payload?.action ?? payload?.type;
        performAction(room, session.playerId, actionIntent, payload?.amount);
      });
      emitRoomState(room);
      cleanupRoom(session.roomId);
    });
  });

  socket.on('player:rebuy', () => {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      rebuy(room, session.playerId);
      emitRoomState(room);
    });
  });

  socket.on('game:settings:update', (payload) => {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      updateGameSettings(
        room,
        session.playerId,
        payload?.gameSettings ?? payload?.update ?? payload,
      );
      io.to(room.id).emit('game:settings:updated', {
        gameSettings: room.gameSettings,
        roomId: room.id,
        updatedBy: session.playerId,
      });
      emitRoomState(room);
    });
  });

  function handleInvite(payload) {
    withErrorBoundary(socket, () => {
      const { room, session } = requireSession(socket);
      sendTableInvite(room, session.playerId, payload ?? {});
      emitRoomState(room);
    });
  }

  socket.on('table:invite:send', handleInvite);
  socket.on('player:invite_send', handleInvite);
  socket.on('table:chat:send', handleTableChat);
  socket.on('player:chat:send', handleTableChat);

  socket.on('player:leave_room', () => {
    leaveCurrentRoom(socket, { notifySelf: true });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket, { notifySelf: false });
  });
});

server.listen(PORT, () => {
  console.log(`House of Poker socket server listening on http://localhost:${PORT}`);
});
