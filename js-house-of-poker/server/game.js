const { Hand } = require('pokersolver');
const { createInMemoryEconomyService } = require('../economy');
const {
  applyHandResultsToPlayerStatuses,
  calculatePlayerStatus,
  createInitialPlayerStatusState,
  registerPlayerForStatusUpdates,
  sanitizePlayerStatusState,
  toPublicPlayerStatusSnapshot,
  updatePlayerStatus,
} = require('../shared/playerStatus');
const {
  THREE_FIVE_SEVEN_TABLE,
  build357WildDefinition,
  is357Mode,
  normalize357Mode,
  rank357Hands,
} = require('../shared/threeFiveSeven');

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const DEFAULT_STACK = 1000;
const MAX_PLAYERS = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOG_LIMIT = 16;
const VALID_GAMES = new Set([
  '357',
  'shanghai',
  'in-between-the-sheets',
  '7-27',
  'holdem',
]);
const VALID_STANDARD_MODES = new Set(['high-only', 'high-low', 'low-only']);
const VALID_MODES = new Set([...VALID_STANDARD_MODES, ...THREE_FIVE_SEVEN_TABLE.modes]);
const VALID_LOW_RULES = new Set(['8-or-better', 'wheel', 'any-low']);
const VALID_WILD_CARDS = new Set([
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
]);
const economyService = createInMemoryEconomyService();
const INVITE_HISTORY_LIMIT = 12;
const INVITE_RECIPIENT_BLUEPRINTS = [
  {
    description: 'Abstract direct code-share target until deep links land.',
    handle: 'table-code',
    id: 'share-link-1',
    label: 'Code Runner',
    source: 'share-link',
  },
  {
    description: 'Reserved hook for QR and short-link table invites.',
    handle: 'quick-seat',
    id: 'share-link-2',
    label: 'Quick Seat Guest',
    source: 'share-link',
  },
  {
    description: 'Placeholder recent-player lane until the social graph ships.',
    handle: 'river-regular',
    id: 'friend-list-1',
    label: 'River Regular',
    source: 'friend-list',
  },
  {
    description: 'Abstract friend-list slot sourced from past tables.',
    handle: 'late-reg',
    id: 'friend-list-2',
    label: 'Late Reg',
    source: 'friend-list',
  },
  {
    description: 'Reserved seat pass for a private table guest.',
    handle: 'seat-pass',
    id: 'seat-pass-1',
    label: 'Seat Pass Guest',
    source: 'seat-pass',
  },
  {
    description: 'Abstract standby contact for host-driven reserved seats.',
    handle: 'waitlist-one',
    id: 'seat-pass-2',
    label: 'Waitlist One',
    source: 'seat-pass',
  },
];
const INVITE_SOURCE_LABELS = {
  'friend-list': 'recent players',
  'seat-pass': 'reserved seat',
  'share-link': 'share link',
};

function createDefaultGameSettings() {
  return {
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
}

function cloneGameSettings(gameSettings) {
  const source = gameSettings ?? createDefaultGameSettings();

  return {
    game: source.game,
    locked: Boolean(source.locked),
    lowRule: source.lowRule,
    mode: source.mode,
    stips: {
      bestFiveCards: Boolean(source.stips?.bestFiveCards),
      hostestWithTheMostest: Boolean(source.stips?.hostestWithTheMostest),
      suitedBeatsUnsuited: Boolean(source.stips?.suitedBeatsUnsuited),
      wildCards: Boolean(source.stips?.wildCards),
    },
    wildCards: Array.isArray(source.wildCards) ? [...source.wildCards] : [],
  };
}

function normalizeWildCards(wildCards) {
  if (!Array.isArray(wildCards)) {
    return null;
  }

  return [...new Set(
    wildCards
      .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
      .filter((value) => VALID_WILD_CARDS.has(value)),
  )];
}

function sync357GameSettings(gameSettings) {
  const nextSettings = cloneGameSettings(gameSettings);

  if (nextSettings.game === '357') {
    const mode = normalize357Mode(nextSettings);
    nextSettings.mode = mode;
    nextSettings.stips.bestFiveCards = mode === 'BEST_FIVE';
    nextSettings.stips.hostestWithTheMostest = mode === 'HOSTEST';
    nextSettings.stips.wildCards = false;
    nextSettings.wildCards = [];
    return nextSettings;
  }

  if (is357Mode(nextSettings.mode)) {
    nextSettings.mode = 'high-only';
  }

  return nextSettings;
}

function ensureGameSettings(room) {
  if (!room.gameSettings) {
    room.gameSettings = createDefaultGameSettings();
  }

  room.gameSettings = sync357GameSettings(room.gameSettings);
  room.gameSettings.locked = isGameSettingsLocked(room);
  return room.gameSettings;
}

function playerStatusToTier(playerStatus) {
  switch (playerStatus) {
    case 'LOW_ROLLER':
      return 'low_roller';
    case 'MID_ROLLER':
      return 'mid_roller';
    case 'UP_AND_COMING':
      return 'up_and_coming';
    case 'HIGH_ROLLER':
      return 'high_roller';
    case 'SHARK':
      return 'shark';
    case 'NO_STATUS':
    default:
      return 'none';
  }
}

function buildPlayerStatusPatch(player) {
  const statusState = sanitizePlayerStatusState(player?.statusState);
  const netChipBalance = statusState.history.reduce(
    (total, entry) => total + (typeof entry.netChips === 'number' ? entry.netChips : 0),
    0,
  );
  const latestStatusEntry = statusState.history[statusState.history.length - 1] ?? null;

  return {
    netChipBalance,
    playerId: player?.id ?? null,
    statusMomentum: latestStatusEntry?.scoreDelta ?? 0,
    statusScore: statusState.recentScore,
    statusTier: playerStatusToTier(statusState.playerStatus),
    statusUpdatedAt: statusState.lastUpdatedAt,
  };
}

function isGameSettingsLocked(room) {
  return Boolean(room.gameSettings?.locked || room.handCount > 0);
}

function lockGameSettings(room) {
  const gameSettings = ensureGameSettings(room);
  gameSettings.locked = true;
  return gameSettings;
}

function applyGameSettingsUpdate(room, update) {
  const gameSettings = ensureGameSettings(room);
  const nextSettings = cloneGameSettings(gameSettings);
  const candidate = update && typeof update === 'object' ? update : {};

  if (typeof candidate.game === 'string' && VALID_GAMES.has(candidate.game)) {
    nextSettings.game = candidate.game;
  }

  if (typeof candidate.mode === 'string' && VALID_MODES.has(candidate.mode)) {
    nextSettings.mode = candidate.mode;
  }

  if (typeof candidate.lowRule === 'string' && VALID_LOW_RULES.has(candidate.lowRule)) {
    nextSettings.lowRule = candidate.lowRule;
  }

  if (candidate.stips && typeof candidate.stips === 'object') {
    if (typeof candidate.stips.bestFiveCards === 'boolean') {
      nextSettings.stips.bestFiveCards = candidate.stips.bestFiveCards;
    }

    if (typeof candidate.stips.hostestWithTheMostest === 'boolean') {
      nextSettings.stips.hostestWithTheMostest = candidate.stips.hostestWithTheMostest;
    }

    if (typeof candidate.stips.suitedBeatsUnsuited === 'boolean') {
      nextSettings.stips.suitedBeatsUnsuited = candidate.stips.suitedBeatsUnsuited;
    }

    if (typeof candidate.stips.wildCards === 'boolean') {
      nextSettings.stips.wildCards = candidate.stips.wildCards;
    }
  }

  const normalizedWildCards = normalizeWildCards(candidate.wildCards);
  if (normalizedWildCards) {
    nextSettings.wildCards = normalizedWildCards;
  }

  nextSettings.locked = isGameSettingsLocked(room);
  room.gameSettings = sync357GameSettings(nextSettings);
  room.gameSettings.locked = nextSettings.locked;
  return room.gameSettings;
}

function createPlayer(socketId, name) {
  const playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
  const statusState = createInitialPlayerStatusState();
  const player = {
    accountId: socketId ? `acct_${socketId}` : `acct_${playerId}`,
    chips: 0,
    id: playerId,
    isConnected: true,
    name: name.trim().slice(0, 24),
    netChipBalance: 0,
    pendingRemoval: false,
    playerStatus: statusState.playerStatus,
    socketId,
    statusMomentum: 0,
    statusScore: 0,
    statusState,
    statusTier: statusState.statusTier,
    statusUpdatedAt: null,
  };

  return registerPlayerForStatusUpdates(player);
}

function syncPlayerStatusFields(player, nextStatusState = player.statusState) {
  const previousStatus = calculatePlayerStatus(player);
  const statusState = sanitizePlayerStatusState(nextStatusState);
  const nextStatus = calculatePlayerStatus({
    ...player,
    netChipBalance: statusState.netChipBalance,
    statusState,
  });
  const statusChanged =
    previousStatus.statusTier !== nextStatus.statusTier ||
    previousStatus.statusScore !== nextStatus.statusScore ||
    previousStatus.statusMomentum !== nextStatus.statusMomentum;

  player.statusState = {
    ...statusState,
    statusUpdatedAt: statusChanged
      ? statusState.lastUpdatedAt ?? Date.now()
      : player.statusUpdatedAt ?? statusState.statusUpdatedAt,
  };
  player.netChipBalance = nextStatus.netChipBalance;
  player.playerStatus = player.statusState.playerStatus;
  player.statusMomentum = nextStatus.statusMomentum;
  player.statusScore = nextStatus.statusScore;
  player.statusTier = nextStatus.statusTier;

  if (statusChanged) {
    player.statusUpdatedAt = player.statusState.statusUpdatedAt;
  } else if (player.statusUpdatedAt === undefined) {
    player.statusUpdatedAt = null;
  }

  return updatePlayerStatus(player.id, [player]);
}

function createThreeFiveSevenRoomState() {
  return {
    activeRound: null,
    activeWildDefinition: build357WildDefinition(THREE_FIVE_SEVEN_TABLE.defaultMode, null),
    anteAmount: THREE_FIVE_SEVEN_TABLE.anteClips,
    anteCollectionKeys: {},
    hiddenDecisionState: {
      currentRound: null,
      historyByPlayerId: {},
      revealedByPlayerId: {},
    },
    lastPhaseSequence: [],
    lastResolution: null,
    legsByPlayerId: {},
    mode: THREE_FIVE_SEVEN_TABLE.defaultMode,
    penaltyModel: {
      legsToWin: THREE_FIVE_SEVEN_TABLE.legsToWin,
      soloGoLegAward: 1,
      goLossPenaltyToPotClips: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
      goLossPenaltyToWinnerClips: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
      unitToPot: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
      unitToWinner: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
    },
    pot: 0,
    revealState: 'hidden',
    showdownPlayerIds: [],
  };
}

function ensureThreeFiveSevenState(room) {
  if (!room.threeFiveSeven) {
    room.threeFiveSeven = createThreeFiveSevenRoomState();
  }

  const mode = normalize357Mode(ensureGameSettings(room));
  room.threeFiveSeven.anteAmount = THREE_FIVE_SEVEN_TABLE.anteClips;
  room.threeFiveSeven.anteCollectionKeys = room.threeFiveSeven.anteCollectionKeys ?? {};
  room.threeFiveSeven.penaltyModel = {
    ...(room.threeFiveSeven.penaltyModel ?? {}),
    goLossPenaltyToPotClips: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
    goLossPenaltyToWinnerClips: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
    unitToPot: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToPotClips,
    unitToWinner: THREE_FIVE_SEVEN_TABLE.goLossPenaltyToWinnerClips,
  };
  room.threeFiveSeven.mode = mode;
  room.threeFiveSeven.activeWildDefinition = room.threeFiveSeven.activeRound
    ? build357WildDefinition(mode, room.threeFiveSeven.activeRound)
    : build357WildDefinition(mode, null);

  room.players.forEach((player) => {
    if (typeof room.threeFiveSeven.legsByPlayerId[player.id] !== 'number') {
      room.threeFiveSeven.legsByPlayerId[player.id] = 0;
    }

    if (!room.threeFiveSeven.hiddenDecisionState.historyByPlayerId[player.id]) {
      room.threeFiveSeven.hiddenDecisionState.historyByPlayerId[player.id] = {};
    }
  });

  return room.threeFiveSeven;
}

function normalizeInviteSource(value) {
  if (value === 'share-link' || value === 'friend-list' || value === 'seat-pass') {
    return value;
  }

  return null;
}

function normalizeInviteMessage(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, 120);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGiftClips(value) {
  if (value == null || value === '') {
    return 0;
  }

  const nextValue = Number(value);
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    throw new Error('Gift buy-in must use a non-negative whole number of clips.');
  }

  return nextValue;
}

function buildInviteRecipients(room) {
  const latestInviteByAccountId = new Map();
  (room.tableInvites ?? []).forEach((invite) => {
    if (!latestInviteByAccountId.has(invite.recipientAccountId)) {
      latestInviteByAccountId.set(invite.recipientAccountId, invite);
    }
  });

  return INVITE_RECIPIENT_BLUEPRINTS.map((blueprint) => {
    const accountId = `invite_${room.id}_${blueprint.id}`;
    const latestInvite = latestInviteByAccountId.get(accountId);

    return {
      accountId,
      description: blueprint.description,
      handle: `@${blueprint.handle}`,
      id: `${room.id}_${blueprint.id}`,
      isInvited: Boolean(latestInvite),
      label: blueprint.label,
      lastInvitedAt: latestInvite?.createdAt ?? null,
      source: blueprint.source,
    };
  });
}

function getInviteRecipient(room, recipientAccountId) {
  if (typeof recipientAccountId !== 'string' || recipientAccountId.trim().length === 0) {
    return null;
  }

  return (
    buildInviteRecipients(room).find(
      (recipient) => recipient.accountId === recipientAccountId.trim(),
    ) ?? null
  );
}

function shuffle(items) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

function createDeck() {
  const suits = ['s', 'h', 'd', 'c'];
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

  return shuffle(suits.flatMap((suit) => ranks.map((rank) => `${rank}${suit}`)));
}

function generateRoomId(rooms) {
  while (true) {
    const candidate = Array.from({ length: 5 }, () =>
      ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
    ).join('');

    if (!rooms.has(candidate)) {
      return candidate;
    }
  }
}

function getPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) ?? null;
}

function getHandPlayer(room, playerId) {
  return room.hand?.players[playerId] ?? null;
}

function roomOrderIds(room, predicate = () => true) {
  return room.players.filter(predicate).map((player) => player.id);
}

function nextId(ids, currentId, predicate = () => true) {
  if (ids.length === 0) {
    return null;
  }

  const currentIndex = currentId ? ids.indexOf(currentId) : -1;

  for (let step = 1; step <= ids.length; step += 1) {
    const candidate = ids[(currentIndex + step + ids.length) % ids.length];
    if (predicate(candidate)) {
      return candidate;
    }
  }

  return null;
}

function activeHandIds(room) {
  if (!room.hand) {
    return [];
  }

  return roomOrderIds(room, (player) => Boolean(room.hand.players[player.id]));
}

function contenderIds(room) {
  if (!room.hand) {
    return [];
  }

  return activeHandIds(room).filter((playerId) => !room.hand.players[playerId].folded);
}

function actionableIds(room) {
  if (!room.hand) {
    return [];
  }

  return activeHandIds(room).filter((playerId) => {
    const roomPlayer = getPlayer(room, playerId);
    const handPlayer = getHandPlayer(room, playerId);

    return Boolean(roomPlayer && handPlayer && !handPlayer.folded && !handPlayer.allIn && roomPlayer.chips > 0);
  });
}

function addLog(room, message) {
  room.actionLog.unshift(message);
  room.actionLog = room.actionLog.slice(0, LOG_LIMIT);
}

function syncRoomEconomyContext(room) {
  economyService.syncTableParticipants(
    room.id,
    room.players
      .filter((player) => !player.pendingRemoval)
      .map((player) => player.accountId)
      .filter(Boolean),
  );
}

function seatPlayerWithDefaultBuyIn(room, player, source) {
  const buyIn = economyService.buyInToTable({
    accountId: player.accountId,
    chips: DEFAULT_STACK,
    metadata: {
      source,
    },
    tableId: room.id,
  });

  player.chips += buyIn.chips;
  addLog(
    room,
    `${player.name} bought in for ${buyIn.chips} chips (${buyIn.clipsDebited} clips).`,
  );
  return buyIn;
}

function getPlayerEconomyState(room, playerId) {
  const player = getPlayer(room, playerId);
  if (!player?.accountId) {
    return null;
  }

  return economyService.buildClientState(player.accountId);
}

function prunePendingPlayers(room) {
  if (!room.threeFiveSeven) {
    room.players = room.players.filter((player) => !player.pendingRemoval);
  } else {
    const removedIds = room.players
      .filter((player) => player.pendingRemoval)
      .map((player) => player.id);

    room.players = room.players.filter((player) => !player.pendingRemoval);
    removedIds.forEach((playerId) => {
      delete room.threeFiveSeven.legsByPlayerId[playerId];
      delete room.threeFiveSeven.hiddenDecisionState.historyByPlayerId[playerId];
      delete room.threeFiveSeven.hiddenDecisionState.revealedByPlayerId[playerId];
    });
  }

  syncRoomEconomyContext(room);

  if (!room.players.find((player) => player.id === room.hostId)) {
    room.hostId = room.players[0]?.id ?? null;
  }
}

function removePendingPlayers(room) {
  if (room.hand && room.hand.phase !== 'completed') {
    return;
  }

  prunePendingPlayers(room);
}

function commitChips(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.betThisRound += committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  return committed;
}

function totalPot(room) {
  if (ensureGameSettings(room).game === '357') {
    return ensureThreeFiveSevenState(room).pot;
  }

  return room.hand
    ? Object.values(room.hand.players).reduce((sum, player) => sum + player.totalContribution, 0)
    : 0;
}

function findNextActionablePlayer(room, fromPlayerId) {
  const ids = actionableIds(room);
  return nextId(ids, fromPlayerId);
}

function resetActionFlags(room, actorId) {
  if (!room.hand) {
    return;
  }

  activeHandIds(room).forEach((playerId) => {
    const handPlayer = getHandPlayer(room, playerId);
    if (!handPlayer || handPlayer.folded || handPlayer.allIn) {
      return;
    }

    handPlayer.hasActed = playerId === actorId;
  });
}

function isBettingRoundComplete(room) {
  if (!room.hand) {
    return true;
  }

  return contenderIds(room).every((playerId) => {
    const handPlayer = room.hand.players[playerId];
    return handPlayer.allIn || (handPlayer.hasActed && handPlayer.betThisRound === room.hand.currentBet);
  });
}

function revealNextStreet(room) {
  if (!room.hand) {
    return;
  }

  const drawCount = room.hand.phase === 'preflop' ? 3 : 1;
  for (let index = 0; index < drawCount; index += 1) {
    room.hand.communityCards.push(room.hand.deck.pop());
  }

  if (room.hand.phase === 'preflop') room.hand.phase = 'flop';
  else if (room.hand.phase === 'flop') room.hand.phase = 'turn';
  else if (room.hand.phase === 'turn') room.hand.phase = 'river';

  room.hand.currentBet = 0;
  room.hand.minRaise = BIG_BLIND;
  activeHandIds(room).forEach((playerId) => {
    const handPlayer = room.hand.players[playerId];
    handPlayer.betThisRound = 0;
    handPlayer.hasActed = false;
  });

  room.hand.currentPlayerId = findNextActionablePlayer(room, room.hand.dealerId);
}

function buildSidePots(room) {
  if (!room.hand) {
    return [];
  }

  const contributions = activeHandIds(room).map((playerId) => ({
    amount: room.hand.players[playerId].totalContribution,
    playerId,
  }));
  const levels = [...new Set(contributions.map((entry) => entry.amount).filter(Boolean))].sort((a, b) => a - b);
  let previousLevel = 0;
  const pots = [];

  levels.forEach((level) => {
    const participants = contributions.filter((entry) => entry.amount >= level).map((entry) => entry.playerId);
    const amount = (level - previousLevel) * participants.length;
    const eligible = participants.filter((playerId) => !room.hand.players[playerId].folded);

    if (amount > 0) {
      pots.push({ amount, eligible });
    }

    previousLevel = level;
  });

  return pots;
}

function completeHand(room) {
  if (!room.hand) {
    return;
  }

  room.hand.currentPlayerId = null;
  room.hand.phase = 'completed';
  room.lastDealerId = room.hand.dealerId;
  removePendingPlayers(room);
}

function applyStatusResults(room, payouts) {
  if (!room.hand) {
    return;
  }

  const occurredAt = Date.now();
  const participants = room.players
    .filter((player) => Boolean(room.hand?.players[player.id]))
    .map((player) => ({
      id: player.id,
      playerStatus: player.statusState?.playerStatus,
      statusState: player.statusState,
      totalContribution: room.hand.players[player.id]?.totalContribution ?? 0,
    }));

  const nextStatusStates = applyHandResultsToPlayerStatuses(
    participants,
    payouts,
    BIG_BLIND,
    occurredAt,
  );

  room.players.forEach((player) => {
    if (nextStatusStates[player.id]) {
      syncPlayerStatusFields(player, nextStatusStates[player.id]);
    }
  });
}

function is357Game(room) {
  return ensureGameSettings(room).game === '357';
}

function eligible357ParticipantIds(room) {
  return roomOrderIds(
    room,
    (player) =>
      player.isConnected &&
      !player.pendingRemoval &&
      player.chips >= THREE_FIVE_SEVEN_TABLE.anteClips,
  );
}

function set357Phase(room, phase) {
  if (!room.hand) {
    return;
  }

  room.hand.phase = phase;
  if (room.hand.threeFiveSeven.phaseSequence[room.hand.threeFiveSeven.phaseSequence.length - 1] !== phase) {
    room.hand.threeFiveSeven.phaseSequence.push(phase);
  }
}

function normalize357Action(actionType) {
  const action = typeof actionType === 'string' ? actionType.trim().toUpperCase() : '';

  if (action === 'GO' || action === 'PLAYER_GO') {
    return 'GO';
  }

  if (action === 'STAY' || action === 'PLAYER_STAY') {
    return 'STAY';
  }

  if (action === 'FOLD' || action === 'PLAYER_FOLD') {
    return 'FOLD';
  }

  return null;
}

function is357DecisionPhase(room) {
  if (!room.hand) {
    return false;
  }

  const roundSize = Number(room.hand.phase.slice(-1));
  return room.hand.phase.startsWith('decide_') && THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize);
}

function get357DecisionRound(room) {
  return is357DecisionPhase(room) ? Number(room.hand.phase.slice(-1)) : null;
}

function contribute357ToPot(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);
  const variantState = ensureThreeFiveSevenState(room);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  // TODO: Replace this capped debit with the production all-in/elimination policy once
  // persistent multiplayer accounts own the authoritative clip ledger.
  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  variantState.pot += committed;
  return committed;
}

function withdraw357ForWinner(room, playerId, amount) {
  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);

  if (!roomPlayer || !handPlayer) {
    return 0;
  }

  // TODO: Replace this capped debit with the production all-in/elimination policy once
  // persistent multiplayer accounts own the authoritative clip ledger.
  const committed = Math.max(0, Math.min(amount, roomPlayer.chips));
  roomPlayer.chips -= committed;
  handPlayer.totalContribution += committed;
  handPlayer.allIn = roomPlayer.chips === 0;
  return committed;
}

function reset357PublicDecisionState(room, roundSize) {
  const variantState = ensureThreeFiveSevenState(room);
  variantState.activeRound = roundSize;
  variantState.activeWildDefinition = build357WildDefinition(variantState.mode, roundSize);
  variantState.hiddenDecisionState.currentRound = roundSize;
  variantState.hiddenDecisionState.revealedByPlayerId = {};
  variantState.revealState = 'hidden';
  variantState.showdownPlayerIds = [];
}

function applyAutomatic357Stays(room, roundSize) {
  activeHandIds(room).forEach((playerId) => {
    const player = getPlayer(room, playerId);
    if (!player || (player.isConnected && !player.pendingRemoval)) {
      return;
    }

    room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId][roundSize] = 'STAY';
    room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] = 'STAY';
    ensureThreeFiveSevenState(room).hiddenDecisionState.historyByPlayerId[playerId][roundSize] = 'STAY';
  });
}

function deal357ToRound(room, roundSize) {
  if (!room.hand) {
    return;
  }

  activeHandIds(room).forEach((playerId) => {
    const handPlayer = room.hand.players[playerId];
    while (handPlayer.cards.length < roundSize) {
      handPlayer.cards.push(room.hand.deck.pop());
    }
  });

  reset357PublicDecisionState(room, roundSize);
  applyAutomatic357Stays(room, roundSize);
  set357Phase(room, `decide_${roundSize}`);
}

function findNext357DecisionPlayer(room, roundSize, fromPlayerId) {
  return nextId(
    activeHandIds(room),
    fromPlayerId,
    (playerId) => room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] == null,
  );
}

function collect357AnteOnce(room, participantIds, cycleKey) {
  const variantState = ensureThreeFiveSevenState(room);
  if (!cycleKey || variantState.anteCollectionKeys[cycleKey]) {
    return { collectedTotal: 0, chargedPlayerIds: [] };
  }

  const chargedPlayerIds = [];
  let collectedTotal = 0;

  participantIds.forEach((participantId) => {
    const contributed = contribute357ToPot(room, participantId, variantState.anteAmount);
    if (contributed > 0) {
      chargedPlayerIds.push(participantId);
      collectedTotal += contributed;
    }
  });

  variantState.anteCollectionKeys[cycleKey] = {
    chargedPlayerIds,
    collectedTotal,
    handNumber: room.handCount,
  };

  return { collectedTotal, chargedPlayerIds };
}

function start357Cycle(room) {
  const variantState = ensureThreeFiveSevenState(room);
  prunePendingPlayers(room);

  const participants = eligible357ParticipantIds(room);
  if (participants.length < 2) {
    if (room.hand) {
      room.hand.currentPlayerId = null;
      room.hand.phase = 'completed';
      room.lastDealerId = room.hand.dealerId;
    }
    return false;
  }

  const dealerId = nextId(participants, room.lastDealerId);
  const deck = createDeck();

  room.hand = {
    bigBlindId: null,
    communityCards: [],
    currentBet: 0,
    currentPlayerId: null,
    dealerId,
    deck,
    minRaise: 0,
    phase: 'deal_3',
    players: {},
    showdownDescriptions: {},
    smallBlindId: null,
    threeFiveSeven: {
      decisionHistoryByPlayerId: {},
      finalDecisionByPlayerId: {},
      phaseSequence: [],
      visibleDecisionsByPlayerId: {},
    },
  };
  room.handCount += 1;

  participants.forEach((participantId) => {
    room.hand.players[participantId] = {
      allIn: false,
      betThisRound: 0,
      cards: [],
      folded: false,
      hasActed: false,
      totalContribution: 0,
    };
    room.hand.threeFiveSeven.decisionHistoryByPlayerId[participantId] = {
      3: null,
      5: null,
      7: null,
    };
    room.hand.threeFiveSeven.finalDecisionByPlayerId[participantId] = null;
    room.hand.threeFiveSeven.visibleDecisionsByPlayerId[participantId] = null;
    variantState.hiddenDecisionState.historyByPlayerId[participantId] = {
      3: null,
      5: null,
      7: null,
    };
  });

  const anteCollection = collect357AnteOnce(room, participants, `hand:${room.handCount}:deal:1`);

  set357Phase(room, 'deal_3');
  addLog(room, `357 cycle #${room.handCount} started. Dealer button is on ${getPlayer(room, dealerId).name}.`);
  addLog(room, `${anteCollection.chargedPlayerIds.length} players anted ${variantState.anteAmount}.`);
  return true;
}

function reveal357Decisions(room) {
  const variantState = ensureThreeFiveSevenState(room);
  const roundSize = variantState.activeRound ?? 7;
  const revealedByPlayerId = {};

  activeHandIds(room).forEach((playerId) => {
    const decision =
      room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] ??
      room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] ??
      'STAY';
    revealedByPlayerId[playerId] = decision;
    room.hand.threeFiveSeven.visibleDecisionsByPlayerId[playerId] = decision;
  });

  variantState.hiddenDecisionState.revealedByPlayerId = revealedByPlayerId;
  variantState.showdownPlayerIds = Object.keys(revealedByPlayerId).filter(
    (playerId) => revealedByPlayerId[playerId] === 'GO',
  );
  variantState.revealState = 'revealed';
  addLog(
    room,
    `Reveal: ${roomOrderIds(room, (player) => Boolean(revealedByPlayerId[player.id]))
      .map((playerId) => `${getPlayer(room, playerId).name} ${revealedByPlayerId[playerId]}`)
      .join(', ')}.`,
  );
}

function resolve357Cycle(room) {
  if (!room.hand) {
    return;
  }

  const variantState = ensureThreeFiveSevenState(room);
  const goPlayerIds = variantState.showdownPlayerIds.filter((playerId) => Boolean(room.hand.players[playerId]));
  const payouts = {};
  const legDeltaByPlayerId = {};
  const legsByPlayerId = variantState.legsByPlayerId;
  const potBefore = variantState.pot;
  let potAwarded = 0;
  let potPenaltyTotal = 0;
  let winnerPenaltyTotal = 0;
  let winnerIds = [];
  let loserIds = [];
  let showdownDescriptions = {};

  activeHandIds(room).forEach((playerId) => {
    payouts[playerId] = 0;
    legDeltaByPlayerId[playerId] = 0;
  });

  if (goPlayerIds.length === 0) {
    room.lastWinnerSummary = 'No GO players. Pot carries to the next reshuffle.';
  } else if (goPlayerIds.length === 1) {
    const winnerId = goPlayerIds[0];
    winnerIds = [winnerId];
    potAwarded = variantState.pot;
    payouts[winnerId] = potAwarded;
    getPlayer(room, winnerId).chips += potAwarded;
    variantState.pot = 0;
    legsByPlayerId[winnerId] = (legsByPlayerId[winnerId] ?? 0) + 1;
    legDeltaByPlayerId[winnerId] = 1;
    room.lastWinnerSummary = `${getPlayer(room, winnerId).name} wins ${potAwarded} chips as the only GO and earns 1 leg.`;
  } else {
    const playerCardsById = {};
    goPlayerIds.forEach((playerId) => {
      playerCardsById[playerId] = [...room.hand.players[playerId].cards];
    });

    const { rankedHands, winnerIds: rankedWinnerIds } = rank357Hands(
      playerCardsById,
      variantState.mode,
      variantState.activeWildDefinition.wildRanks,
    );
    winnerIds = rankedWinnerIds;
    rankedHands.forEach((entry) => {
      showdownDescriptions[entry.playerId] = entry.solved.descr;
    });
    loserIds = goPlayerIds.filter((playerId) => !winnerIds.includes(playerId));

    loserIds.forEach((playerId) => {
      winnerPenaltyTotal += withdraw357ForWinner(
        room,
        playerId,
        variantState.penaltyModel.unitToWinner,
      );
      potPenaltyTotal += contribute357ToPot(
        room,
        playerId,
        variantState.penaltyModel.unitToPot,
      );
      legsByPlayerId[playerId] = 0;
    });

    const orderedWinnerIds = roomOrderIds(room, (player) => winnerIds.includes(player.id));
    const splitAmount = orderedWinnerIds.length > 0
      ? Math.floor(winnerPenaltyTotal / orderedWinnerIds.length)
      : 0;
    let remainder = orderedWinnerIds.length > 0
      ? winnerPenaltyTotal % orderedWinnerIds.length
      : 0;

    orderedWinnerIds.forEach((playerId) => {
      const amount = splitAmount + (remainder > 0 ? 1 : 0);
      payouts[playerId] += amount;
      getPlayer(room, playerId).chips += amount;
      if (remainder > 0) {
        remainder -= 1;
      }
    });

    room.hand.showdownDescriptions = showdownDescriptions;
    room.lastWinnerSummary =
      winnerIds.length > 1
        ? `${winnerIds.map((playerId) => getPlayer(room, playerId).name).join(' & ')} split ${winnerPenaltyTotal} chips. ${loserIds.length} losing GO player(s) each paid ${variantState.penaltyModel.unitToWinner} to the winner side and ${variantState.penaltyModel.unitToPot} to the pot.`
        : `${getPlayer(room, winnerIds[0]).name} wins ${winnerPenaltyTotal} chips (${showdownDescriptions[winnerIds[0]]}). ${loserIds.length} losing GO player(s) each paid ${variantState.penaltyModel.unitToWinner} to the winner and ${variantState.penaltyModel.unitToPot} to the pot.`;
  }

  addLog(room, room.lastWinnerSummary);
  applyStatusResults(room, payouts);
  variantState.revealState = 'resolved';
  variantState.lastPhaseSequence = [...room.hand.threeFiveSeven.phaseSequence];
  variantState.lastResolution = {
    goPlayerIds,
    handNumber: room.handCount,
    legDeltaByPlayerId,
    loserIds,
    outcome:
      goPlayerIds.length === 0
        ? 'no_go'
        : goPlayerIds.length === 1
          ? 'solo_go'
          : winnerIds.length > 1
            ? 'showdown_tie'
            : 'showdown',
    payoutByPlayerId: payouts,
    potAfterResolution: variantState.pot,
    potAwarded,
    potBeforeResolution: potBefore,
    potPenaltyTotal,
    revealedDecisions: { ...variantState.hiddenDecisionState.revealedByPlayerId },
    showdownDescriptions,
    splitWinnerPayout: winnerIds.length > 1,
    winnerIds,
    winnerPenaltyTotal,
  };
}

function advance357Game(room) {
  if (!room.hand) {
    return;
  }

  while (room.hand && room.hand.phase !== 'completed') {
    if (room.hand.phase === 'deal_3') {
      deal357ToRound(room, 3);
      continue;
    }

    if (room.hand.phase === 'deal_5') {
      deal357ToRound(room, 5);
      continue;
    }

    if (room.hand.phase === 'deal_7') {
      deal357ToRound(room, 7);
      continue;
    }

    if (room.hand.phase === 'decide_3' || room.hand.phase === 'decide_5' || room.hand.phase === 'decide_7') {
      const roundSize = Number(room.hand.phase.slice(-1));
      const nextPlayerId = findNext357DecisionPlayer(room, roundSize, room.hand.currentPlayerId);

      if (nextPlayerId) {
        room.hand.currentPlayerId = nextPlayerId;
        return;
      }

      room.hand.currentPlayerId = null;
      if (roundSize === 3) {
        set357Phase(room, 'deal_5');
        continue;
      }

      if (roundSize === 5) {
        set357Phase(room, 'deal_7');
        continue;
      }

      set357Phase(room, 'reveal');
      continue;
    }

    if (room.hand.phase === 'reveal') {
      reveal357Decisions(room);
      set357Phase(room, 'resolve');
      continue;
    }

    if (room.hand.phase === 'resolve') {
      resolve357Cycle(room);
      room.lastDealerId = room.hand.dealerId;
      set357Phase(room, 'reshuffle');
      ensureThreeFiveSevenState(room).lastPhaseSequence = [...room.hand.threeFiveSeven.phaseSequence];
      continue;
    }

    if (room.hand.phase === 'reshuffle') {
      if (!start357Cycle(room)) {
        return;
      }
      continue;
    }

    return;
  }
}

function awardSingleWinner(room, winnerId) {
  if (!room.hand) {
    return;
  }

  const winner = getPlayer(room, winnerId);
  if (!winner) {
    return;
  }

  const amount = totalPot(room);
  winner.chips += amount;
  room.lastWinnerSummary = `${winner.name} wins ${amount} chips uncontested.`;
  addLog(room, room.lastWinnerSummary);
  applyStatusResults(room, {
    [winnerId]: amount,
  });
  completeHand(room);
}

function resolveShowdown(room) {
  if (!room.hand) {
    return;
  }

  while (room.hand.communityCards.length < 5) {
    room.hand.communityCards.push(room.hand.deck.pop());
  }

  const descriptions = {};
  const solvedHands = {};
  const payouts = {};

  contenderIds(room).forEach((playerId) => {
    const solved = Hand.solve([...room.hand.players[playerId].cards, ...room.hand.communityCards]);
    solvedHands[playerId] = solved;
    descriptions[playerId] = solved.descr;
    payouts[playerId] = 0;
  });

  buildSidePots(room).forEach((pot) => {
    const winnerHands = Hand.winners(pot.eligible.map((playerId) => solvedHands[playerId]));
    const winnerIds = pot.eligible.filter((playerId) => winnerHands.includes(solvedHands[playerId]));
    const orderedWinnerIds = roomOrderIds(room, (player) => winnerIds.includes(player.id));
    const splitAmount = Math.floor(pot.amount / orderedWinnerIds.length);
    let remainder = pot.amount % orderedWinnerIds.length;

    orderedWinnerIds.forEach((playerId) => {
      payouts[playerId] = (payouts[playerId] ?? 0) + splitAmount + (remainder > 0 ? 1 : 0);
      if (remainder > 0) {
        remainder -= 1;
      }
    });
  });

  const winnerSummary = roomOrderIds(room, (player) => Boolean(payouts[player.id])).map((playerId) => {
    const player = getPlayer(room, playerId);
    player.chips += payouts[playerId];
    return `${player.name} +${payouts[playerId]} (${descriptions[playerId]})`;
  });

  room.hand.showdownDescriptions = descriptions;
  room.lastWinnerSummary = winnerSummary.join(', ');
  addLog(room, room.lastWinnerSummary);
  applyStatusResults(room, payouts);
  completeHand(room);
}

function advanceGame(room) {
  if (!room.hand) {
    return;
  }

  if (is357Game(room)) {
    advance357Game(room);
    return;
  }

  while (room.hand && room.hand.phase !== 'completed') {
    const contenders = contenderIds(room);
    if (contenders.length === 1) {
      awardSingleWinner(room, contenders[0]);
      return;
    }

    if (!isBettingRoundComplete(room)) {
      room.hand.currentPlayerId = findNextActionablePlayer(room, room.hand.currentPlayerId);
      return;
    }

    if (room.hand.phase === 'river') {
      resolveShowdown(room);
      return;
    }

    revealNextStreet(room);
  }
}

function createRoom(rooms, socketId, name) {
  const player = createPlayer(socketId, name);
  const roomId = generateRoomId(rooms);

  const room = {
    actionLog: [`${player.name} opened room ${roomId}.`],
    chatMessages: [],
    gameSettings: createDefaultGameSettings(),
    hand: null,
    handCount: 0,
    hostId: player.id,
    id: roomId,
    lastDealerId: null,
    lastWinnerSummary: null,
    players: [player],
    tableInvites: [],
    threeFiveSeven: createThreeFiveSevenRoomState(),
  };
  room.threeFiveSeven.legsByPlayerId[player.id] = 0;

  rooms.set(roomId, room);
  syncRoomEconomyContext(room);

  try {
    seatPlayerWithDefaultBuyIn(room, player, 'room-create');
  } catch (error) {
    rooms.delete(roomId);
    economyService.syncTableParticipants(roomId, []);
    throw error;
  }

  return { player, room };
}

function joinRoom(room, socketId, name) {
  if (room.players.length >= MAX_PLAYERS) {
    throw new Error('Room is full.');
  }

  const player = createPlayer(socketId, name);
  room.players.push(player);
  ensureThreeFiveSevenState(room).legsByPlayerId[player.id] = 0;
  syncRoomEconomyContext(room);

  try {
    seatPlayerWithDefaultBuyIn(room, player, 'room-join');
  } catch (error) {
    room.players = room.players.filter((candidate) => candidate.id !== player.id);
    syncRoomEconomyContext(room);
    throw error;
  }

  addLog(room, `${player.name} joined the table.`);
  return player;
}

function sendTableInvite(room, playerId, input = {}) {
  const sender = getPlayer(room, playerId);
  if (!sender) {
    throw new Error('Player not found.');
  }

  const source = normalizeInviteSource(input.source);
  if (!source) {
    throw new Error('Choose an invite lane before sending.');
  }

  const recipient = getInviteRecipient(room, input.recipientAccountId);
  if (!recipient) {
    throw new Error('Invite recipient is not available.');
  }

  if (recipient.source !== source) {
    throw new Error('Recipient does not match the selected invite lane.');
  }

  const message = normalizeInviteMessage(input.message);
  const giftClips = normalizeGiftClips(input.giftClips);
  const clipToChipRate = economyService.getPolicy().clipToChipRate;
  let giftBuyInChips = 0;
  let giftBuyInClips = 0;

  economyService.recordTableInvite(room.id, recipient.accountId);

  if (giftClips > 0) {
    const giftResult = economyService.giftBuyIn({
      chips: giftClips * clipToChipRate,
      metadata: {
        inviteMessage: message,
        recipientHandle: recipient.handle,
        recipientLabel: recipient.label,
        source,
      },
      recipientAccountId: recipient.accountId,
      senderAccountId: sender.accountId,
      tableId: room.id,
    });

    giftBuyInChips = giftResult.chips;
    giftBuyInClips = giftResult.clipsDebited;
  }

  const createdAt = Date.now();
  const inviteRecord = {
    createdAt,
    giftBuyInChips,
    giftBuyInClips,
    id: `invite_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    message,
    recipientAccountId: recipient.accountId,
    recipientHandle: recipient.handle,
    recipientLabel: recipient.label,
    senderPlayerId: sender.id,
    senderPlayerName: sender.name,
    source,
    status: 'pending',
  };

  room.tableInvites = [inviteRecord, ...(room.tableInvites ?? [])].slice(0, INVITE_HISTORY_LIMIT);

  if (giftBuyInClips > 0) {
    addLog(
      room,
      `${sender.name} invited ${recipient.label} via ${INVITE_SOURCE_LABELS[source]} with a ${giftBuyInClips}-clip gift buy-in (${giftBuyInChips} chips).`,
    );
  } else {
    addLog(room, `${sender.name} invited ${recipient.label} via ${INVITE_SOURCE_LABELS[source]}.`);
  }

  return inviteRecord;
}

function startHand(room, playerId) {
  removePendingPlayers(room);
  const gameSettings = ensureGameSettings(room);

  if (room.hostId !== playerId) {
    throw new Error('Only the host can start the next hand.');
  }

  if (room.hand && room.hand.phase !== 'completed') {
    throw new Error('A hand is already in progress.');
  }

  if (gameSettings.game === '357') {
    const participants = eligible357ParticipantIds(room);
    if (participants.length < 2) {
      throw new Error(`At least two connected players with ${THREE_FIVE_SEVEN_TABLE.anteClips} clip(s) are required.`);
    }

    lockGameSettings(room);
    ensureThreeFiveSevenState(room);
    if (!start357Cycle(room)) {
      throw new Error('Unable to start a 357 cycle.');
    }
    advanceGame(room);
    return;
  }

  const participants = roomOrderIds(room, (player) => player.isConnected && !player.pendingRemoval && player.chips > 0);
  if (participants.length < 2) {
    throw new Error('At least two connected players with chips are required.');
  }

  const dealerId = nextId(participants, room.lastDealerId);
  const smallBlindId = participants.length === 2 ? dealerId : nextId(participants, dealerId);
  const bigBlindId = nextId(participants, smallBlindId);
  const firstToAct = participants.length === 2 ? dealerId : nextId(participants, bigBlindId);
  const deck = createDeck();

  room.hand = {
    bigBlindId,
    communityCards: [],
    currentBet: 0,
    currentPlayerId: firstToAct,
    dealerId,
    deck,
    minRaise: BIG_BLIND,
    phase: 'preflop',
    players: {},
    showdownDescriptions: {},
    smallBlindId,
  };
  room.handCount += 1;
  lockGameSettings(room);
  room.lastWinnerSummary = null;

  participants.forEach((participantId) => {
    room.hand.players[participantId] = {
      allIn: false,
      betThisRound: 0,
      cards: [deck.pop(), deck.pop()],
      folded: false,
      hasActed: false,
      totalContribution: 0,
    };
  });

  const smallBlindAmount = commitChips(room, smallBlindId, SMALL_BLIND);
  const bigBlindAmount = commitChips(room, bigBlindId, BIG_BLIND);
  room.hand.currentBet = Math.max(smallBlindAmount, bigBlindAmount);

  addLog(room, `Hand #${room.handCount} started. Dealer button is on ${getPlayer(room, dealerId).name}.`);
  addLog(room, `${getPlayer(room, smallBlindId).name} posted the small blind (${smallBlindAmount}).`);
  addLog(room, `${getPlayer(room, bigBlindId).name} posted the big blind (${bigBlindAmount}).`);

  advanceGame(room);
}

function performAction(room, playerId, actionType, rawAmount) {
  if (!room.hand || room.hand.phase === 'completed') {
    throw new Error('No active hand to act in.');
  }

  if (is357Game(room)) {
    const roundSize = get357DecisionRound(room);
    if (!roundSize) {
      throw new Error('357 is not waiting on a decision.');
    }

    if (!room.hand.players[playerId]) {
      throw new Error('Player is not active in this 357 cycle.');
    }

    const decision = normalize357Action(actionType);
    if (!decision) {
      throw new Error('Only GO, STAY, and FOLD intents are available in 357.');
    }

    const lockedDecision = room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] ?? null;
    const nextDecision = decision === 'FOLD' ? 'STAY' : decision;

    if (lockedDecision != null) {
      if (lockedDecision === nextDecision) {
        advanceGame(room);
        return;
      }

      throw new Error('357 action is already locked for this round.');
    }

    room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId][roundSize] = nextDecision;
    room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] = nextDecision;
    ensureThreeFiveSevenState(room).hiddenDecisionState.historyByPlayerId[playerId][roundSize] = nextDecision;
    room.hand.currentPlayerId = findNext357DecisionPlayer(room, roundSize, playerId);
    advanceGame(room);
    return;
  }

  if (room.hand.currentPlayerId !== playerId) {
    throw new Error('It is not your turn.');
  }

  const roomPlayer = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);
  const toCall = Math.max(0, room.hand.currentBet - handPlayer.betThisRound);
  const maxTotal = handPlayer.betThisRound + roomPlayer.chips;
  const amount = Number.isFinite(rawAmount) ? Math.floor(rawAmount) : 0;
  let message = '';

  if (actionType === 'fold') {
    handPlayer.folded = true;
    handPlayer.hasActed = true;
    message = `${roomPlayer.name} folded.`;
  } else if (actionType === 'check') {
    if (toCall > 0) throw new Error('Cannot check when facing a bet.');
    handPlayer.hasActed = true;
    message = `${roomPlayer.name} checked.`;
  } else if (actionType === 'call') {
    if (toCall === 0) throw new Error('Nothing to call.');
    const committed = commitChips(room, playerId, toCall);
    handPlayer.hasActed = true;
    message = committed < toCall
      ? `${roomPlayer.name} called all-in for ${committed}.`
      : `${roomPlayer.name} called ${committed}.`;
  } else if (actionType === 'bet') {
    if (room.hand.currentBet > 0) throw new Error('Use raise once betting has started.');
    const target = Math.min(amount, maxTotal);
    if (target <= handPlayer.betThisRound) throw new Error('Bet amount must increase your wager.');
    if (target < Math.min(BIG_BLIND, maxTotal) && target !== maxTotal) {
      throw new Error(`Bet must be at least ${BIG_BLIND}.`);
    }

    commitChips(room, playerId, target - handPlayer.betThisRound);
    room.hand.currentBet = handPlayer.betThisRound;
    room.hand.minRaise = Math.max(BIG_BLIND, handPlayer.betThisRound);
    resetActionFlags(room, playerId);
    message = `${roomPlayer.name} bet ${handPlayer.betThisRound}.`;
  } else if (actionType === 'raise') {
    if (room.hand.currentBet === 0) throw new Error('Use bet to open the action.');
    const target = Math.min(amount, maxTotal);
    const raiseSize = target - room.hand.currentBet;

    if (target <= room.hand.currentBet) throw new Error('Raise must beat the current bet.');
    if (raiseSize < room.hand.minRaise && target !== maxTotal) {
      throw new Error(`Minimum raise is to ${room.hand.currentBet + room.hand.minRaise}.`);
    }

    commitChips(room, playerId, target - handPlayer.betThisRound);
    room.hand.currentBet = handPlayer.betThisRound;
    if (raiseSize >= room.hand.minRaise) {
      room.hand.minRaise = raiseSize;
    }

    resetActionFlags(room, playerId);
    message = `${roomPlayer.name} raised to ${handPlayer.betThisRound}.`;
  } else if (actionType === 'all-in') {
    if (maxTotal <= handPlayer.betThisRound) throw new Error('You have no chips left.');

    commitChips(room, playerId, roomPlayer.chips);
    if (handPlayer.betThisRound > room.hand.currentBet) {
      const raiseSize = handPlayer.betThisRound - room.hand.currentBet;
      room.hand.currentBet = handPlayer.betThisRound;
      if (raiseSize >= room.hand.minRaise) {
        room.hand.minRaise = raiseSize;
      }
      resetActionFlags(room, playerId);
    }

    handPlayer.hasActed = true;
    message = `${roomPlayer.name} moved all-in for ${handPlayer.betThisRound}.`;
  } else {
    throw new Error('Unknown action.');
  }

  addLog(room, message);
  advanceGame(room);
}

function leaveRoom(room, playerId) {
  const player = getPlayer(room, playerId);
  if (!player) {
    return;
  }

  player.isConnected = false;
  player.pendingRemoval = true;
  player.socketId = null;

  if (room.hand && room.hand.phase !== 'completed' && room.hand.players[playerId]) {
    if (is357Game(room)) {
      const roundSize = Number(room.hand.phase.slice(-1));
      if (Number.isInteger(roundSize) && THREE_FIVE_SEVEN_TABLE.rounds.includes(roundSize)) {
        const lockedDecision = room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] ?? null;
        if (lockedDecision == null) {
          room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId][roundSize] = 'STAY';
          room.hand.threeFiveSeven.finalDecisionByPlayerId[playerId] = 'STAY';
          ensureThreeFiveSevenState(room).hiddenDecisionState.historyByPlayerId[playerId][roundSize] = 'STAY';
        }
      }
      addLog(room, `${player.name} left the table and unresolved 357 decisions are treated as STAY.`);
      advanceGame(room);
    } else {
      const handPlayer = room.hand.players[playerId];
      if (!handPlayer.folded && !handPlayer.allIn) {
        handPlayer.folded = true;
        handPlayer.hasActed = true;
        addLog(room, `${player.name} left the table and folded.`);
      }
      advanceGame(room);
    }
  } else {
    removePendingPlayers(room);
  }

  if (!room.players.find((candidate) => candidate.id === room.hostId && !candidate.pendingRemoval)) {
    room.hostId = room.players.find((candidate) => !candidate.pendingRemoval)?.id ?? null;
  }

  syncRoomEconomyContext(room);
}

function rebuy(room, playerId) {
  const player = getPlayer(room, playerId);
  if (!player) {
    throw new Error('Player not found.');
  }

  if (player.chips > 0) {
    throw new Error('Rebuy is only available when you are out of chips.');
  }

  seatPlayerWithDefaultBuyIn(room, player, 'rebuy');
}

function updateGameSettings(room, playerId, update) {
  ensureGameSettings(room);

  if (room.hostId !== playerId) {
    throw new Error('Only the host can update game settings.');
  }

  if (isGameSettingsLocked(room)) {
    lockGameSettings(room);
    throw new Error('Game settings are locked once play has started.');
  }

  return applyGameSettingsUpdate(room, update);
}

function buildControls(room, playerId) {
  const player = getPlayer(room, playerId);
  const handPlayer = getHandPlayer(room, playerId);
  const playerEconomy = getPlayerEconomyState(room, playerId);
  const gameSettings = ensureGameSettings(room);
  const is357 = gameSettings.game === '357';

  if (!player) {
    return { availableActions: [], callAmount: 0, canAct: false, canRebuy: false, canStartHand: false, maxRaiseTo: 0, minRaiseTo: 0 };
  }

  const canStartHand =
    room.hostId === playerId &&
    (!room.hand || room.hand.phase === 'completed') &&
    (is357
      ? eligible357ParticipantIds(room).length >= 2
      : roomOrderIds(room, (entry) => entry.isConnected && !entry.pendingRemoval && entry.chips > 0).length >= 2);
  const canRebuy =
    player.chips <= 0 &&
    (is357 || !room.hand || room.hand.phase === 'completed') &&
    Boolean(playerEconomy?.canAffordDefaultBuyIn);

  if (!room.hand || room.hand.phase === 'completed' || !handPlayer || handPlayer.folded || handPlayer.allIn) {
    return { availableActions: [], callAmount: 0, canAct: false, canRebuy, canStartHand, maxRaiseTo: 0, minRaiseTo: 0 };
  }

  if (is357) {
    const roundSize = get357DecisionRound(room);
    const decisionLocked = roundSize
      ? room.hand.threeFiveSeven.decisionHistoryByPlayerId[playerId]?.[roundSize] != null
      : true;

    return {
      availableActions: !decisionLocked ? ['go', 'stay', 'fold'] : [],
      callAmount: 0,
      canAct: !decisionLocked,
      canRebuy,
      canStartHand,
      maxRaiseTo: 0,
      minRaiseTo: 0,
    };
  }

  if (room.hand.currentPlayerId !== playerId) {
    return { availableActions: [], callAmount: 0, canAct: false, canRebuy, canStartHand, maxRaiseTo: 0, minRaiseTo: 0 };
  }

  const toCall = Math.max(0, room.hand.currentBet - handPlayer.betThisRound);
  const maxRaiseTo = handPlayer.betThisRound + player.chips;
  const minRaiseTo = room.hand.currentBet === 0
    ? Math.min(maxRaiseTo, BIG_BLIND)
    : Math.min(maxRaiseTo, room.hand.currentBet + room.hand.minRaise);
  const availableActions = ['fold'];

  if (toCall === 0) availableActions.push('check');
  else availableActions.push('call');

  if (player.chips > 0 && maxRaiseTo > room.hand.currentBet) {
    availableActions.push(room.hand.currentBet === 0 ? 'bet' : 'raise');
    availableActions.push('all-in');
  }

  return { availableActions, callAmount: toCall, canAct: true, canRebuy, canStartHand, maxRaiseTo, minRaiseTo };
}

function buildRoomState(room, playerId) {
  const hand = room.hand;
  const controls = buildControls(room, playerId);
  const economy = getPlayerEconomyState(room, playerId);
  const gameSettings = ensureGameSettings(room);
  const variantState = ensureThreeFiveSevenState(room);
  const is357 = gameSettings.game === '357';
  const players = room.players.map((player, seatIndex) => {
    const handPlayer = hand?.players[player.id];
    const revealedDecision = is357
      ? variantState.hiddenDecisionState.revealedByPlayerId[player.id] ?? null
      : null;
    const revealCards = is357
      ? Boolean(
        handPlayer &&
          (player.id === playerId ||
            (variantState.revealState !== 'hidden' && revealedDecision === 'GO')),
      )
      : Boolean(
        handPlayer &&
          (player.id === playerId ||
            ((hand?.phase === 'completed' || hand?.phase === 'showdown') && !handPlayer.folded)),
      );
    const statusPatch = buildPlayerStatusPatch(player);
    const statusState = sanitizePlayerStatusState(player.statusState);

    return {
      betThisRound: handPlayer?.betThisRound ?? 0,
      cards: revealCards ? handPlayer.cards : [],
      chips: player.chips,
      handDescription: hand?.showdownDescriptions?.[player.id] ?? null,
      hasFolded: is357 ? false : handPlayer?.folded ?? false,
      holeCards: revealCards ? handPlayer.cards : [],
      id: player.id,
      isAllIn: handPlayer?.allIn ?? false,
      isBigBlind: hand?.bigBlindId === player.id,
      isConnected: player.isConnected,
      isDealer: hand?.dealerId === player.id,
      isHost: room.hostId === player.id,
      legs: variantState.legsByPlayerId[player.id] ?? 0,
      revealedDecision,
      isSmallBlind: hand?.smallBlindId === player.id,
      isTurn: hand?.currentPlayerId === player.id,
      name: player.name,
      netChipBalance: statusPatch.netChipBalance,
      playerStatus: statusState.playerStatus,
      seatIndex: typeof player.seatIndex === 'number' ? player.seatIndex : seatIndex,
      statusMomentum: statusPatch.statusMomentum,
      statusScore: statusPatch.statusScore,
      statusSnapshot: toPublicPlayerStatusSnapshot(statusState),
      statusTier: statusPatch.statusTier,
      statusUpdatedAt: statusPatch.statusUpdatedAt,
      totalContribution: handPlayer?.totalContribution ?? 0,
    };
  });

  const phase = hand?.phase ?? 'waiting';
  const statusMessage = is357
    ? phase === 'completed'
      ? room.lastWinnerSummary ?? '357 is waiting for the next cycle.'
      : phase === 'resolve' || phase === 'reshuffle'
        ? room.lastWinnerSummary ?? 'Resolving 357.'
        : phase === 'reveal'
          ? 'Revealing GO and STAY.'
          : phase.startsWith('decide_')
            ? hand?.currentPlayerId === playerId
              ? `Round ${variantState.activeRound}: choose GO or STAY.`
              : `Round ${variantState.activeRound}: waiting for players...`
            : 'Dealing 357 cards.'
    : phase === 'completed'
      ? room.lastWinnerSummary ?? 'Hand complete.'
      : hand?.currentPlayerId
        ? `${getPlayer(room, hand.currentPlayerId).name} to act.`
        : 'Waiting for the next hand.';

  return {
    actionLog: room.actionLog,
    bigBlind: is357 ? 0 : BIG_BLIND,
    chatMessages: room.chatMessages ?? [],
    communityCards: hand?.communityCards ?? [],
    controls,
    currentBet: hand?.currentBet ?? 0,
    currentTurnPlayerId: hand?.currentPlayerId ?? null,
    economy,
    gameSettings: cloneGameSettings(gameSettings),
    handNumber: room.handCount,
    hostId: room.hostId,
    inviteRecipients: buildInviteRecipients(room),
    lastWinnerSummary: room.lastWinnerSummary,
    phase,
    players,
    pot: totalPot(room),
    roomId: room.id,
    selfId: playerId,
    smallBlind: is357 ? 0 : SMALL_BLIND,
    statusMessage,
    tableInvites: (room.tableInvites ?? []).map((invite) => ({ ...invite })),
    threeFiveSeven: is357
      ? {
        activeRound: variantState.activeRound,
        activeWildDefinition: { ...variantState.activeWildDefinition },
        anteAmount: variantState.anteAmount,
        hiddenDecisionState: {
          currentRound: variantState.hiddenDecisionState.currentRound,
          historyByPlayerId: Object.fromEntries(
            Object.entries(variantState.hiddenDecisionState.historyByPlayerId).map(([id, history]) => [id, { ...history }]),
          ),
          revealedByPlayerId: { ...variantState.hiddenDecisionState.revealedByPlayerId },
        },
        lastPhaseSequence: [...variantState.lastPhaseSequence],
        lastResolution: variantState.lastResolution
          ? {
            ...variantState.lastResolution,
            legDeltaByPlayerId: { ...variantState.lastResolution.legDeltaByPlayerId },
            payoutByPlayerId: { ...variantState.lastResolution.payoutByPlayerId },
            revealedDecisions: { ...variantState.lastResolution.revealedDecisions },
            showdownDescriptions: { ...variantState.lastResolution.showdownDescriptions },
          }
          : null,
        legsByPlayerId: { ...variantState.legsByPlayerId },
        mode: variantState.mode,
        penaltyModel: { ...variantState.penaltyModel },
        pot: variantState.pot,
        revealState: variantState.revealState,
        showdownPlayerIds: [...variantState.showdownPlayerIds],
      }
      : null,
  };
}

module.exports = {
  BIG_BLIND,
  DEFAULT_STACK,
  MAX_PLAYERS,
  SMALL_BLIND,
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
};
