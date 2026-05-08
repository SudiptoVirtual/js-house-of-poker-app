import {
  normalizePlayerStatusTier,
  normalizePokerPlayerStatus,
} from '../../utils/playerStatus';
import type {
  PlayerStatusTier,
  PokerAction,
  PokerActionHistoryEntry,
  PokerCardState,
  Poker357State,
  PokerGameSettings,
  PokerInviteRecipient,
  PokerInviteSource,
  PokerPhase,
  PokerPlayerState,
  PokerPlayerStatus,
  PokerRoomState,
  PokerSeatState,
  PokerTableInvite,
  PokerTableChatMessage,
} from '../../types/poker';
import type { PokerEconomyState } from '../../types/economy';

import type { PokerServerEvent, PokerServerEventType } from './types';

type LegacyPokerPlayerState = Omit<
  PokerPlayerState,
  | 'cardCount'
  | 'cards'
  | 'hasHiddenCards'
  | 'lastAction'
  | 'netChipBalance'
  | 'playerStatus'
  | 'seatIndex'
  | 'statusMomentum'
  | 'statusScore'
  | 'statusTier'
  | 'statusUpdatedAt'
> &
  Partial<
    Pick<
      PokerPlayerState,
      | 'cardCount'
      | 'cards'
      | 'hasHiddenCards'
      | 'lastAction'
      | 'netChipBalance'
      | 'seatIndex'
      | 'statusMomentum'
      | 'statusScore'
      | 'statusTier'
      | 'statusUpdatedAt'
    >
  > & {
    playerStatus?: PokerPlayerStatus | PlayerStatusTier | string | null;
  };

type LegacyPokerRoomState = {
  actionLog: string[];
  bigBlind: number;
  chatMessages?: PokerTableChatMessage[] | null;
  communityCards: string[];
  controls: PokerRoomState['controls'];
  currentBet: number;
  currentTurnPlayerId: string | null;
  economy?: PokerEconomyState | null;
  gameSettings?: Partial<PokerGameSettings> | null;
  handNumber: number;
  hostId: string | null;
  inviteRecipients?: PokerInviteRecipient[] | null;
  lastWinnerSummary: string | null;
  phase: PokerPhase;
  players: LegacyPokerPlayerState[];
  pot: number;
  roomId: string | null;
  selfId: string | null;
  smallBlind: number;
  statusMessage: string;
  tableInvites?: PokerTableInvite[] | null;
  threeFiveSeven?: Poker357State | null;
};

const DEFAULT_MAX_SEATS = 6;
const DEFAULT_GAME_SETTINGS: PokerGameSettings = {
  game: 'holdem',
  locked: false,
  lowRule: '8-or-better',
  mode: 'high-only',
  stips: {
    bestFiveCards: false,
    hostestWithTheMostest: false,
    suitedBeatsUnsuited: false,
    wildCards: false,
  },
  wildCards: [],
};

function isInviteSource(value: unknown): value is PokerInviteSource {
  return value === 'share-link' || value === 'friend-list' || value === 'seat-pass';
}

function normalizeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStatusUpdatedAt(value: unknown) {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function createCardState(
  code: string,
  ownerId: string | null,
  order: number,
  visibility: PokerCardState['visibility'],
): PokerCardState {
  return {
    code,
    order,
    ownerId,
    visibility,
  };
}

function inferPlayerCardCount(player: LegacyPokerPlayerState, phase: PokerPhase) {
  if (player.holeCards.length > 0) {
    return player.holeCards.length;
  }

  if (phase === 'waiting') {
    return 0;
  }

  if (phase === 'deal_3' || phase === 'decide_3') {
    return 3;
  }

  if (phase === 'deal_5' || phase === 'decide_5') {
    return 5;
  }

  if (
    phase === 'deal_7' ||
    phase === 'decide_7' ||
    phase === 'reveal' ||
    phase === 'resolve' ||
    phase === 'reshuffle'
  ) {
    return 7;
  }

  if (
    player.totalContribution > 0 ||
    player.hasFolded ||
    player.isAllIn ||
    player.isDealer ||
    player.isSmallBlind ||
    player.isBigBlind ||
    player.isTurn ||
    player.isConnected
  ) {
    return 2;
  }

  return 0;
}

function inferActionKind(message: string): PokerActionHistoryEntry['action'] {
  if (/ opened room /i.test(message) || / posted the /i.test(message)) {
    return 'system';
  }

  if (/ joined the table/i.test(message)) {
    return 'join';
  }

  if (/ left the table/i.test(message)) {
    return 'leave';
  }

  if (/ re-bought /i.test(message)) {
    return 'rebuy';
  }

  if (/ started\./i.test(message)) {
    return 'start';
  }

  if (/ folded\./i.test(message)) {
    return 'fold';
  }

  if (/ checked\./i.test(message)) {
    return 'check';
  }

  if (/ called /i.test(message)) {
    return 'call';
  }

  if (/ bet /i.test(message)) {
    return 'bet';
  }

  if (/ raised to /i.test(message)) {
    return 'raise';
  }

  if (/ moved all-in /i.test(message)) {
    return 'all-in';
  }

  if (/ wins /i.test(message) || /\+\d+ \(/.test(message)) {
    return 'win';
  }

  return 'system';
}

function extractAmount(message: string) {
  const match = message.match(/(\d[\d,]*)/);
  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function findPlayerByMessage(
  players: Array<LegacyPokerPlayerState | PokerPlayerState>,
  message: string,
) {
  return (
    players.find(
      (player) =>
        message.startsWith(`${player.name} `) || message.includes(`${player.name} wins`),
    ) ?? null
  );
}

function buildActionHistory(
  actionLog: string[],
  players: LegacyPokerPlayerState[],
  createdAt: number,
) {
  return actionLog.map((message, index) => {
    const player = findPlayerByMessage(players, message);

    return {
      action: inferActionKind(message),
      amount: extractAmount(message),
      createdAt: createdAt - index,
      id: `${createdAt}-${index}-${message.replace(/[^a-z0-9]+/gi, '-').slice(0, 32)}`,
      message,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
    } satisfies PokerActionHistoryEntry;
  });
}

function buildSeats(players: PokerPlayerState[], maxSeats: number) {
  return Array.from({ length: maxSeats }, (_, seatIndex) => {
    const occupant = players.find((player) => player.seatIndex === seatIndex);

    return {
      isBigBlind: occupant?.isBigBlind ?? false,
      isDealer: occupant?.isDealer ?? false,
      isOccupied: Boolean(occupant),
      isSmallBlind: occupant?.isSmallBlind ?? false,
      playerId: occupant?.id ?? null,
      seatIndex,
    } satisfies PokerSeatState;
  });
}

function normalizeChatMessages(
  chatMessages: LegacyPokerRoomState['chatMessages'],
  previousState: PokerRoomState | null,
) {
  if (!Array.isArray(chatMessages)) {
    return previousState?.chatMessages ?? [];
  }

  return chatMessages.filter(
    (message): message is PokerTableChatMessage =>
      Boolean(
        message &&
          typeof message.id === 'string' &&
          typeof message.createdAt === 'number' &&
          typeof message.playerName === 'string' &&
          typeof message.text === 'string' &&
          (message.playerId === null || typeof message.playerId === 'string') &&
          (message.tone === 'player' || message.tone === 'system') &&
          message.moderation &&
          Array.isArray(message.moderation.flags) &&
          (message.moderation.reason === null ||
            typeof message.moderation.reason === 'string') &&
          (message.moderation.reviewedAt === null ||
            typeof message.moderation.reviewedAt === 'number') &&
          (message.moderation.status === 'accepted' ||
            message.moderation.status === 'blocked' ||
            message.moderation.status === 'pending-review'),
      ),
  );
}

function normalizeInviteRecipients(
  inviteRecipients: LegacyPokerRoomState['inviteRecipients'],
  previousState: PokerRoomState | null,
) {
  if (!Array.isArray(inviteRecipients)) {
    return previousState?.inviteRecipients ?? [];
  }

  return inviteRecipients.filter(
    (recipient): recipient is PokerInviteRecipient =>
      Boolean(
        recipient &&
          typeof recipient.id === 'string' &&
          typeof recipient.accountId === 'string' &&
          typeof recipient.label === 'string' &&
          typeof recipient.handle === 'string' &&
          typeof recipient.description === 'string' &&
          typeof recipient.isInvited === 'boolean' &&
          (recipient.lastInvitedAt === null ||
            typeof recipient.lastInvitedAt === 'number') &&
          isInviteSource(recipient.source),
      ),
  );
}

function normalizeTableInvites(
  tableInvites: LegacyPokerRoomState['tableInvites'],
  previousState: PokerRoomState | null,
) {
  if (!Array.isArray(tableInvites)) {
    return previousState?.tableInvites ?? [];
  }

  return tableInvites.filter(
    (invite): invite is PokerTableInvite =>
      Boolean(
        invite &&
          typeof invite.id === 'string' &&
          typeof invite.createdAt === 'number' &&
          typeof invite.giftBuyInChips === 'number' &&
          typeof invite.giftBuyInClips === 'number' &&
          (invite.message === null || typeof invite.message === 'string') &&
          typeof invite.recipientAccountId === 'string' &&
          typeof invite.recipientHandle === 'string' &&
          typeof invite.recipientLabel === 'string' &&
          typeof invite.senderPlayerId === 'string' &&
          typeof invite.senderPlayerName === 'string' &&
          isInviteSource(invite.source) &&
          invite.status === 'pending',
      ),
  );
}

function playerSeatIndex(players: PokerPlayerState[], predicate: (player: PokerPlayerState) => boolean) {
  return players.find(predicate)?.seatIndex ?? null;
}

function normalizeGameSettings(
  gameSettings: LegacyPokerRoomState['gameSettings'],
  previousState: PokerRoomState | null,
) {
  const fallback = previousState?.gameSettings ?? DEFAULT_GAME_SETTINGS;

  return {
    game:
      typeof gameSettings?.game === 'string'
        ? gameSettings.game
        : fallback.game,
    locked:
      typeof gameSettings?.locked === 'boolean'
        ? gameSettings.locked
        : fallback.locked,
    lowRule:
      typeof gameSettings?.lowRule === 'string'
        ? gameSettings.lowRule
        : fallback.lowRule,
    mode:
      typeof gameSettings?.mode === 'string'
        ? gameSettings.mode
        : fallback.mode,
    stips: {
      bestFiveCards:
        typeof gameSettings?.stips?.bestFiveCards === 'boolean'
          ? gameSettings.stips.bestFiveCards
          : fallback.stips.bestFiveCards,
      hostestWithTheMostest:
        typeof gameSettings?.stips?.hostestWithTheMostest === 'boolean'
          ? gameSettings.stips.hostestWithTheMostest
          : fallback.stips.hostestWithTheMostest,
      suitedBeatsUnsuited:
        typeof gameSettings?.stips?.suitedBeatsUnsuited === 'boolean'
          ? gameSettings.stips.suitedBeatsUnsuited
          : fallback.stips.suitedBeatsUnsuited,
      wildCards:
        typeof gameSettings?.stips?.wildCards === 'boolean'
          ? gameSettings.stips.wildCards
          : fallback.stips.wildCards,
    },
    wildCards: Array.isArray(gameSettings?.wildCards)
      ? gameSettings.wildCards.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : fallback.wildCards,
  } satisfies PokerGameSettings;
}

function normalizeEconomyState(
  economy: LegacyPokerRoomState['economy'],
  previousState: PokerRoomState | null,
) {
  if (!economy || typeof economy !== 'object') {
    return previousState?.economy ?? null;
  }

  if (
    typeof economy.clipBalance !== 'number' ||
    typeof economy.chipEquivalentBalance !== 'number' ||
    typeof economy.canAffordDefaultBuyIn !== 'boolean' ||
    typeof economy.defaultTableBuyInChips !== 'number' ||
    !economy.compliance ||
    typeof economy.compliance.disclosure !== 'string' ||
    typeof economy.compliance.clipToChipRate !== 'number' ||
    !economy.gifting ||
    typeof economy.gifting.clipsGiftedToday !== 'number' ||
    typeof economy.gifting.clipsRemainingToday !== 'number' ||
    typeof economy.gifting.cooldownMs !== 'number' ||
    typeof economy.gifting.giftsRemainingToday !== 'number' ||
    !economy.weeklyReload ||
    typeof economy.weeklyReload.amountClips !== 'number' ||
    typeof economy.weeklyReload.nextEligibleAt !== 'number'
  ) {
    return previousState?.economy ?? null;
  }

  return economy as PokerEconomyState;
}

function normalizeThreeFiveSevenState(
  threeFiveSeven: LegacyPokerRoomState['threeFiveSeven'],
  previousState: PokerRoomState | null,
) {
  if (!threeFiveSeven || typeof threeFiveSeven !== 'object') {
    return previousState?.threeFiveSeven ?? null;
  }

  return {
    activeRound:
      threeFiveSeven.activeRound === 3 ||
      threeFiveSeven.activeRound === 5 ||
      threeFiveSeven.activeRound === 7
        ? threeFiveSeven.activeRound
        : null,
    activeWildDefinition: {
      cumulative: Boolean(threeFiveSeven.activeWildDefinition?.cumulative),
      label:
        typeof threeFiveSeven.activeWildDefinition?.label === 'string'
          ? threeFiveSeven.activeWildDefinition.label
          : 'No wilds',
      mode:
        threeFiveSeven.activeWildDefinition?.mode === 'BEST_FIVE'
          ? 'BEST_FIVE'
          : 'HOSTEST',
      round:
        threeFiveSeven.activeWildDefinition?.round === 3 ||
        threeFiveSeven.activeWildDefinition?.round === 5 ||
        threeFiveSeven.activeWildDefinition?.round === 7
          ? threeFiveSeven.activeWildDefinition.round
          : null,
      wildRanks: Array.isArray(threeFiveSeven.activeWildDefinition?.wildRanks)
        ? threeFiveSeven.activeWildDefinition.wildRanks.filter(
            (value): value is string => typeof value === 'string' && value.length > 0,
          )
        : [],
    },
    anteAmount:
      typeof threeFiveSeven.anteAmount === 'number' ? threeFiveSeven.anteAmount : 0,
    hiddenDecisionState: {
      currentRound:
        threeFiveSeven.hiddenDecisionState?.currentRound === 3 ||
        threeFiveSeven.hiddenDecisionState?.currentRound === 5 ||
        threeFiveSeven.hiddenDecisionState?.currentRound === 7
          ? threeFiveSeven.hiddenDecisionState.currentRound
          : null,
      historyByPlayerId:
        threeFiveSeven.hiddenDecisionState?.historyByPlayerId &&
        typeof threeFiveSeven.hiddenDecisionState.historyByPlayerId === 'object'
          ? threeFiveSeven.hiddenDecisionState.historyByPlayerId
          : {},
      revealedByPlayerId:
        threeFiveSeven.hiddenDecisionState?.revealedByPlayerId &&
        typeof threeFiveSeven.hiddenDecisionState.revealedByPlayerId === 'object'
          ? threeFiveSeven.hiddenDecisionState.revealedByPlayerId
          : {},
    },
    lastPhaseSequence: Array.isArray(threeFiveSeven.lastPhaseSequence)
      ? threeFiveSeven.lastPhaseSequence.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : [],
    lastResolution:
      threeFiveSeven.lastResolution && typeof threeFiveSeven.lastResolution === 'object'
        ? {
            ...threeFiveSeven.lastResolution,
            goPlayerIds: Array.isArray(threeFiveSeven.lastResolution.goPlayerIds)
              ? threeFiveSeven.lastResolution.goPlayerIds.filter(
                  (value): value is string => typeof value === 'string' && value.length > 0,
                )
              : [],
            loserIds: Array.isArray(threeFiveSeven.lastResolution.loserIds)
              ? threeFiveSeven.lastResolution.loserIds.filter(
                  (value): value is string => typeof value === 'string' && value.length > 0,
                )
              : [],
            winnerIds: Array.isArray(threeFiveSeven.lastResolution.winnerIds)
              ? threeFiveSeven.lastResolution.winnerIds.filter(
                  (value): value is string => typeof value === 'string' && value.length > 0,
                )
              : [],
          }
        : null,
    legsByPlayerId:
      threeFiveSeven.legsByPlayerId && typeof threeFiveSeven.legsByPlayerId === 'object'
        ? threeFiveSeven.legsByPlayerId
        : {},
    mode: threeFiveSeven.mode === 'BEST_FIVE' ? 'BEST_FIVE' : 'HOSTEST',
    penaltyModel: {
      legsToWin:
        typeof threeFiveSeven.penaltyModel?.legsToWin === 'number'
          ? threeFiveSeven.penaltyModel.legsToWin
          : 0,
      soloGoLegAward:
        typeof threeFiveSeven.penaltyModel?.soloGoLegAward === 'number'
          ? threeFiveSeven.penaltyModel.soloGoLegAward
          : 0,
      unitToPot:
        typeof threeFiveSeven.penaltyModel?.unitToPot === 'number'
          ? threeFiveSeven.penaltyModel.unitToPot
          : 0,
      unitToWinner:
        typeof threeFiveSeven.penaltyModel?.unitToWinner === 'number'
          ? threeFiveSeven.penaltyModel.unitToWinner
          : 0,
    },
    pot: typeof threeFiveSeven.pot === 'number' ? threeFiveSeven.pot : 0,
    revealState:
      threeFiveSeven.revealState === 'revealed' || threeFiveSeven.revealState === 'resolved'
        ? threeFiveSeven.revealState
        : 'hidden',
    showdownPlayerIds: Array.isArray(threeFiveSeven.showdownPlayerIds)
      ? threeFiveSeven.showdownPlayerIds.filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        )
      : [],
  } satisfies Poker357State;
}

function areGameSettingsEqual(
  previous: PokerGameSettings | null | undefined,
  next: PokerGameSettings | null | undefined,
) {
  if (!previous || !next) {
    return previous === next;
  }

  return (
    previous.game === next.game &&
    previous.locked === next.locked &&
    previous.lowRule === next.lowRule &&
    previous.mode === next.mode &&
    previous.stips.bestFiveCards === next.stips.bestFiveCards &&
    previous.stips.hostestWithTheMostest === next.stips.hostestWithTheMostest &&
    previous.stips.suitedBeatsUnsuited === next.stips.suitedBeatsUnsuited &&
    previous.stips.wildCards === next.stips.wildCards &&
    previous.wildCards.length === next.wildCards.length &&
    previous.wildCards.every((value, index) => value === next.wildCards[index])
  );
}

export function normalizePokerRoomState(
  roomState: LegacyPokerRoomState,
  previousState: PokerRoomState | null = null,
): PokerRoomState {
  const updatedAt = Date.now();
  const actionHistory = buildActionHistory(roomState.actionLog, roomState.players, updatedAt);
  const gameSettings = normalizeGameSettings(roomState.gameSettings, previousState);
  const threeFiveSeven = normalizeThreeFiveSevenState(roomState.threeFiveSeven, previousState);
  const players = roomState.players.map((player, seatIndex) => {
    const visibleCardCodes = (player.holeCards ?? []).length > 0
      ? (player.holeCards ?? [])
      : (player.cards ?? []).map((card) => (typeof card === 'string' ? card : card.code));
    const cardCount = inferPlayerCardCount(
      {
        ...player,
        holeCards: visibleCardCodes,
      },
      roomState.phase,
    );
    const cards = visibleCardCodes.map((code, order) =>
      createCardState(code, player.id, order, 'face-up'),
    );
    const lastAction =
      actionHistory.find((entry) => entry.playerId === player.id) ??
      previousState?.players.find((candidate) => candidate.id === player.id)?.lastAction ??
      null;

    const statusTier = normalizePlayerStatusTier(player.statusTier ?? player.playerStatus);

    return {
      ...player,
      cardCount,
      cards,
      hasHiddenCards: cardCount > cards.length,
      lastAction,
      legs: typeof player.legs === 'number' ? player.legs : 0,
      netChipBalance: normalizeNumber(player.netChipBalance),
      playerStatus: normalizePokerPlayerStatus(statusTier),
      revealedDecision:
        player.revealedDecision === 'GO' || player.revealedDecision === 'STAY'
          ? player.revealedDecision
          : null,
      seatIndex: typeof player.seatIndex === 'number' ? player.seatIndex : seatIndex,
      statusMomentum: normalizeNumber(player.statusMomentum),
      statusScore: normalizeNumber(player.statusScore),
      statusTier,
      statusUpdatedAt: normalizeStatusUpdatedAt(player.statusUpdatedAt),
    } satisfies PokerPlayerState;
  });
  const maxSeats = Math.max(DEFAULT_MAX_SEATS, players.length);
  const seats = buildSeats(players, maxSeats);
  const communityCardStates = roomState.communityCards.map((code, order) =>
    createCardState(code, null, order, 'face-up'),
  );

  return {
    ...roomState,
    actionHistory,
    bigBlindPosition: playerSeatIndex(players, (player) => player.isBigBlind),
    chatMessages: normalizeChatMessages(roomState.chatMessages, previousState),
    communityCardStates,
    currentTurnSeat: playerSeatIndex(
      players,
      (player) => player.id === roomState.currentTurnPlayerId,
    ),
    dealerPosition: playerSeatIndex(players, (player) => player.isDealer),
    economy: normalizeEconomyState(roomState.economy, previousState),
    gameSettings,
    maxSeats,
    minPlayersToStart: 2,
    inviteRecipients: normalizeInviteRecipients(
      roomState.inviteRecipients,
      previousState,
    ),
    players,
    seats,
    smallBlindPosition: playerSeatIndex(players, (player) => player.isSmallBlind),
    tableId: roomState.roomId,
    tableInvites: normalizeTableInvites(roomState.tableInvites, previousState),
    tableName: roomState.roomId ? `Table ${roomState.roomId}` : 'Open Table',
    threeFiveSeven,
    updatedAt,
  };
}

function createEvent(
  type: PokerServerEventType,
  roomState: PokerRoomState | null,
  payload: Record<string, unknown>,
): PokerServerEvent {
  const occurredAt = Date.now();

  return {
    id: `${type}-${occurredAt}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt,
    payload,
    roomState,
    tableId: roomState?.tableId ?? null,
    type,
  };
}

function communityCardDelta(previous: PokerRoomState | null, next: PokerRoomState) {
  const previousCount = previous?.communityCards.length ?? 0;
  if (next.communityCards.length <= previousCount) {
    return [];
  }

  return next.communityCards.slice(previousCount);
}

function findLatestActionPayload(roomState: PokerRoomState) {
  const latest = roomState.actionHistory[0];
  if (!latest) {
    return {};
  }

  return {
    action: latest.action,
    amount: latest.amount,
    playerId: latest.playerId,
    playerName: latest.playerName,
  };
}

function appendChatEvents(
  events: PokerServerEvent[],
  previousState: PokerRoomState | null,
  nextState: PokerRoomState,
) {
  if (!previousState || previousState.tableId !== nextState.tableId) {
    return;
  }

  const knownMessageIds = new Set(previousState.chatMessages.map((message) => message.id));
  nextState.chatMessages.forEach((message) => {
    if (knownMessageIds.has(message.id)) {
      return;
    }

    events.push(
      createEvent('table-chat-message', nextState, {
        messageId: message.id,
        moderationStatus: message.moderation.status,
        playerId: message.playerId,
        playerName: message.playerName,
        text: message.text,
        tone: message.tone,
      }),
    );
  });
}

export function derivePokerServerEvents(
  previousState: PokerRoomState | null,
  nextState: PokerRoomState | null,
) {
  const events: PokerServerEvent[] = [];

  if (!previousState && nextState) {
    events.push(
      createEvent('table-joined', nextState, {
        hostId: nextState.hostId,
        playerCount: nextState.players.length,
      }),
    );
  }

  if (previousState && !nextState) {
    events.push(
      createEvent('table-left', previousState, {
        playerCount: previousState.players.length,
      }),
    );
    return events;
  }

  if (!nextState) {
    return events;
  }

  if (previousState && previousState.tableId !== nextState.tableId) {
    events.push(
      createEvent('table-left', previousState, {
        playerCount: previousState.players.length,
      }),
    );
    events.push(
      createEvent('table-joined', nextState, {
        hostId: nextState.hostId,
        playerCount: nextState.players.length,
      }),
    );
  }

  if (previousState) {
    const previousPlayerIds = new Set(previousState.players.map((player) => player.id));
    const nextPlayerIds = new Set(nextState.players.map((player) => player.id));

    nextState.players.forEach((player) => {
      if (!previousPlayerIds.has(player.id)) {
        events.push(
          createEvent('player-joined', nextState, {
            playerId: player.id,
            playerName: player.name,
            seatIndex: player.seatIndex,
          }),
        );
      }
    });

    previousState.players.forEach((player) => {
      if (!nextPlayerIds.has(player.id)) {
        events.push(
          createEvent('player-left', nextState, {
            playerId: player.id,
            playerName: player.name,
            seatIndex: player.seatIndex,
          }),
        );
      }
    });
  }

  if (!previousState || nextState.handNumber > previousState.handNumber) {
    events.push(
      createEvent('game-started', nextState, {
        dealerPosition: nextState.dealerPosition,
        handNumber: nextState.handNumber,
      }),
    );

    const totalCards = nextState.players.reduce(
      (count, player) => count + player.cardCount,
      0,
    );
    if (totalCards > 0) {
      events.push(
        createEvent('cards-dealt', nextState, {
          handNumber: nextState.handNumber,
          totalCards,
        }),
      );
    }
  }

  if (previousState?.actionLog[0] !== nextState.actionLog[0] && nextState.actionLog[0]) {
    events.push(
      createEvent('player-action-made', nextState, findLatestActionPayload(nextState)),
    );
  }

  appendChatEvents(events, previousState, nextState);

  if (previousState?.currentTurnPlayerId !== nextState.currentTurnPlayerId) {
    const player = nextState.players.find(
      (candidate) => candidate.id === nextState.currentTurnPlayerId,
    );
    if (player) {
      events.push(
        createEvent('player-turn-changed', nextState, {
          playerId: player.id,
          playerName: player.name,
          seatIndex: player.seatIndex,
        }),
      );
    }
  }

  if (!areGameSettingsEqual(previousState?.gameSettings, nextState.gameSettings)) {
    events.push(
      createEvent('game-settings-updated', nextState, {
        game: nextState.gameSettings.game,
        locked: nextState.gameSettings.locked,
        mode: nextState.gameSettings.mode,
      }),
    );
  }

  if ((previousState?.pot ?? 0) !== nextState.pot) {
    events.push(
      createEvent('pot-updated', nextState, {
        amount: nextState.pot,
      }),
    );
  }

  const revealedCards = communityCardDelta(previousState, nextState);
  if (revealedCards.length > 0) {
    events.push(
      createEvent('community-cards-revealed', nextState, {
        cards: revealedCards,
        totalCommunityCards: nextState.communityCards.length,
      }),
    );
  }

  if (previousState && previousState.phase !== nextState.phase && nextState.phase === 'completed') {
    events.push(
      createEvent('round-ended', nextState, {
        handNumber: nextState.handNumber,
        phase: nextState.phase,
      }),
    );
  }

  if (previousState?.lastWinnerSummary !== nextState.lastWinnerSummary && nextState.lastWinnerSummary) {
    events.push(
      createEvent('winner-declared', nextState, {
        summary: nextState.lastWinnerSummary,
      }),
    );
  }

  return events;
}

export function buildRoomStateFromLegacy(
  nextState: LegacyPokerRoomState | null,
  previousState: PokerRoomState | null,
) {
  if (!nextState) {
    return {
      events: derivePokerServerEvents(previousState, null),
      roomState: null,
    };
  }

  const normalizedState = normalizePokerRoomState(nextState, previousState);
  return {
    events: derivePokerServerEvents(previousState, normalizedState),
    roomState: normalizedState,
  };
}

export function toPokerActionEmitter(
  type: PokerAction,
  emitters: Partial<Record<PokerAction, (amount?: number) => Promise<void>>>,
) {
  return emitters[type];
}
