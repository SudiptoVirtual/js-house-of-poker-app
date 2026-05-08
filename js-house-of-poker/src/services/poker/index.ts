import { env } from '../../config/env';

import { createLocalPokerTransport } from './localPokerTransport';
import { createSocketPokerTransport } from './socketPokerTransport';
import type { PokerTransport } from './types';

export * from './events';
export * from './types';

export function createPokerTransport(): PokerTransport {
  if (env.poker.transport === 'socket' && env.poker.socketUrl) {
    return createSocketPokerTransport({
      protocol: env.poker.socketProtocol as 'legacy' | 'table-v1',
      socketUrl: env.poker.socketUrl,
    });
  }

  return createLocalPokerTransport();
}
