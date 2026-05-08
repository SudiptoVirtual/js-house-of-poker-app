import { io, type Socket } from 'socket.io-client';

import type { PokerConnectionState } from '../poker/types';

type SocketManagerConnectionListener = (
  state: PokerConnectionState,
) => void;

type CreateSocketManagerOptions = {
  kind: PokerConnectionState['kind'];
  label: string;
  url: string;
};

function cloneConnectionState(state: PokerConnectionState): PokerConnectionState {
  return {
    ...state,
  };
}

export function createSocketManager(options: CreateSocketManagerOptions) {
  const socket: Socket = io(options.url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 5000,
    transports: ['websocket', 'polling'],
  });
  const connectionListeners = new Set<SocketManagerConnectionListener>();
  let connectionState: PokerConnectionState = {
    backendUrl: options.url,
    kind: options.kind,
    label: options.label,
    lastDisconnectReason: null,
    lastError: null,
    latencyMs: null,
    reconnectAttempts: 0,
    socketId: null,
    status: 'idle',
  };
  let connectPromise: Promise<void> | null = null;
  let isDestroyed = false;
  let pingIntervalId: ReturnType<typeof setInterval> | null = null;

  function notifyConnectionListeners() {
    const snapshot = cloneConnectionState(connectionState);
    connectionListeners.forEach((listener) => listener(snapshot));
  }

  function patchConnectionState(partial: Partial<PokerConnectionState>) {
    connectionState = {
      ...connectionState,
      ...partial,
    };
    notifyConnectionListeners();
  }

  function clearPingInterval() {
    if (!pingIntervalId) {
      return;
    }

    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }

  async function measureSocketPing() {
    if (!socket.connected) {
      return false;
    }

    const sentAt = Date.now();

    return new Promise<boolean>((resolve) => {
      socket.timeout(2500).emit('network:ping', { sentAt }, (error: Error | null) => {
        if (error) {
          resolve(false);
          return;
        }

        patchConnectionState({
          latencyMs: Math.max(0, Date.now() - sentAt),
        });
        resolve(true);
      });
    });
  }

  async function measureHttpPing() {
    if (!options.url) {
      return false;
    }

    const sentAt = Date.now();

    try {
      const response = await fetch(options.url);
      if (!response.ok) {
        return false;
      }

      patchConnectionState({
        latencyMs: Math.max(0, Date.now() - sentAt),
      });
      return true;
    } catch {
      return false;
    }
  }

  async function probeLatency() {
    const measured = await measureSocketPing();
    if (measured || isDestroyed) {
      return;
    }

    const fallbackMeasured = await measureHttpPing();
    if (!fallbackMeasured && !isDestroyed) {
      patchConnectionState({
        latencyMs: null,
      });
    }
  }

  function startPingInterval() {
    clearPingInterval();
    void probeLatency();
    pingIntervalId = setInterval(() => {
      void probeLatency();
    }, 8000);
  }

  socket.on('connect', () => {
    if (isDestroyed) {
      return;
    }

    patchConnectionState({
      lastDisconnectReason: null,
      lastError: null,
      reconnectAttempts: 0,
      socketId: socket.id ?? null,
      status: 'connected',
    });
    startPingInterval();
  });

  socket.on('disconnect', (reason) => {
    if (isDestroyed) {
      return;
    }

    const status =
      reason === 'io client disconnect'
        ? 'disconnected'
        : reason === 'io server disconnect'
          ? 'error'
          : 'reconnecting';

    patchConnectionState({
      lastDisconnectReason: reason,
      latencyMs: null,
      socketId: null,
      status,
    });
    clearPingInterval();
  });

  socket.on('connect_error', (error) => {
    if (isDestroyed) {
      return;
    }

    patchConnectionState({
      lastError: error.message,
      latencyMs: null,
      socketId: null,
      status: socket.active ? 'reconnecting' : 'error',
    });
  });

  socket.io.on('reconnect_attempt', (attemptNumber) => {
    if (isDestroyed) {
      return;
    }

    patchConnectionState({
      reconnectAttempts: attemptNumber,
      status: 'reconnecting',
    });
  });

  socket.io.on('reconnect_error', (error) => {
    if (isDestroyed) {
      return;
    }

    patchConnectionState({
      lastError: error instanceof Error ? error.message : 'Reconnect failed.',
      status: 'reconnecting',
    });
  });

  socket.io.on('reconnect_failed', () => {
    if (isDestroyed) {
      return;
    }

    patchConnectionState({
      lastError: 'Realtime reconnection failed.',
      latencyMs: null,
      socketId: null,
      status: 'error',
    });
  });

  async function connect() {
    if (socket.connected) {
      patchConnectionState({
        lastError: null,
        socketId: socket.id ?? null,
        status: 'connected',
      });
      return;
    }

    if (connectPromise) {
      return connectPromise;
    }

    patchConnectionState({
      lastError: null,
      status: 'connecting',
    });

    connectPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        socket.disconnect();
        reject(new Error('Unable to reach the realtime poker server.'));
      }, 5000);

      function cleanup() {
        clearTimeout(timeoutId);
        socket.off('connect', handleConnect);
        socket.off('connect_error', handleConnectError);
      }

      function handleConnect() {
        cleanup();
        resolve();
      }

      function handleConnectError(error: Error) {
        cleanup();
        reject(error);
      }

      socket.on('connect', handleConnect);
      socket.on('connect_error', handleConnectError);
      socket.connect();
    })
      .finally(() => {
        connectPromise = null;
      });

    return connectPromise;
  }

  return {
    connect,
    destroy() {
      isDestroyed = true;
      connectPromise = null;
      clearPingInterval();
      connectionListeners.clear();
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
    },
    disconnect() {
      socket.disconnect();
    },
    emit<TPayload>(eventName: string, payload?: TPayload) {
      socket.emit(eventName, payload);
    },
    getConnectionState() {
      return cloneConnectionState(connectionState);
    },
    isConnected() {
      return socket.connected;
    },
    on<TPayload>(eventName: string, handler: (payload: TPayload) => void) {
      socket.on(eventName, handler);

      return () => {
        socket.off(eventName, handler);
      };
    },
    onConnection(listener: SocketManagerConnectionListener) {
      connectionListeners.add(listener);

      return () => {
        connectionListeners.delete(listener);
      };
    },
  };
}
