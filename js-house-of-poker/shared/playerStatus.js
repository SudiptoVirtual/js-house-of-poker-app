const PLAYER_STATUSES = Object.freeze([
  'NO_STATUS',
  'LOW_ROLLER',
  'MID_ROLLER',
  'UP_AND_COMING',
  'HIGH_ROLLER',
  'SHARK',
]);

const DEFAULT_PLAYER_STATUS = 'NO_STATUS';

const STATUS_TIERS = Object.freeze([
  'none',
  'low_roller',
  'mid_roller',
  'up_and_coming',
  'high_roller',
  'shark',
]);

const DEFAULT_STATUS_TIER = 'none';
const LEGACY_STATUS_BY_TIER = Object.freeze({
  high_roller: 'HIGH_ROLLER',
  low_roller: 'LOW_ROLLER',
  mid_roller: 'MID_ROLLER',
  none: 'NO_STATUS',
  shark: 'SHARK',
  up_and_coming: 'UP_AND_COMING',
});
const TIER_BY_LEGACY_STATUS = Object.freeze(
  Object.entries(LEGACY_STATUS_BY_TIER).reduce((tiers, [tier, legacyStatus]) => {
    tiers[legacyStatus] = tier;
    return tiers;
  }, {}),
);

const PLAYER_STATUS_CONFIG = Object.freeze({
  invitePriorityBase: 0,
  recentWindowHands: 12,
  reputationBase: 50,
  reputationScoreScale: 0.4,
  scoreClamp: Object.freeze({
    maxNetBigBlinds: 12,
    minNetBigBlinds: -6,
  }),
  scoreWeights: Object.freeze({
    lossHandPenalty: 3,
    lossReliefPerStrength: 0.8,
    maxLossRelief: 4.5,
    netBigBlindPoints: 3,
    profitableHandBonus: 8,
    sharkBonus: 7,
    strongerOpponentBonus: 2.5,
    tableStrengthBonus: 1.6,
  }),
  statusStrengths: Object.freeze({
    HIGH_ROLLER: 4,
    LOW_ROLLER: 1,
    MID_ROLLER: 2,
    NO_STATUS: 0,
    SHARK: 5,
    UP_AND_COMING: 3,
  }),
  statusThresholds: Object.freeze([
    Object.freeze({ minHands: 8, minScore: 125, status: 'SHARK' }),
    Object.freeze({ minHands: 6, minScore: 82, status: 'HIGH_ROLLER' }),
    Object.freeze({ minHands: 5, minScore: 52, status: 'UP_AND_COMING' }),
    Object.freeze({ minHands: 4, minScore: 26, status: 'MID_ROLLER' }),
    Object.freeze({ minHands: 2, minScore: 10, status: 'LOW_ROLLER' }),
  ]),
  strongTableStrengthThreshold: 2.6,
});

const STATUS_TIER_STRENGTHS = Object.freeze({
  high_roller: 4,
  low_roller: 1,
  mid_roller: 2,
  none: 0,
  shark: 5,
  up_and_coming: 3,
});

const STATUS_TIER_THRESHOLDS = Object.freeze(
  PLAYER_STATUS_CONFIG.statusThresholds.map((threshold) =>
    Object.freeze({
      minHands: threshold.minHands,
      minScore: threshold.minScore,
      statusTier: TIER_BY_LEGACY_STATUS[threshold.status] ?? DEFAULT_STATUS_TIER,
    }),
  ),
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeStatusTier(statusTier) {
  if (typeof statusTier !== 'string') {
    return DEFAULT_STATUS_TIER;
  }

  const normalized = statusTier.trim();
  if (STATUS_TIERS.includes(normalized)) {
    return normalized;
  }

  const legacyTier = TIER_BY_LEGACY_STATUS[normalized.toUpperCase()];
  return legacyTier ?? DEFAULT_STATUS_TIER;
}

function statusTierToPlayerStatus(statusTier) {
  return LEGACY_STATUS_BY_TIER[normalizeStatusTier(statusTier)] ?? DEFAULT_PLAYER_STATUS;
}

function normalizePlayerStatus(value) {
  if (PLAYER_STATUSES.includes(value)) {
    return value;
  }

  return statusTierToPlayerStatus(value);
}

function getStatusTierStrength(statusTier) {
  return STATUS_TIER_STRENGTHS[normalizeStatusTier(statusTier)] ?? 0;
}

function resolveStatusTier(recentHands, recentScore, netChipBalance = 0) {
  for (const threshold of STATUS_TIER_THRESHOLDS) {
    if (recentHands >= threshold.minHands && recentScore >= threshold.minScore) {
      if (threshold.statusTier === 'shark' && netChipBalance <= 0) {
        continue;
      }

      return threshold.statusTier;
    }
  }

  return DEFAULT_STATUS_TIER;
}

function calculateMomentum(history) {
  const recentHistory = Array.isArray(history) ? history.slice(-3) : [];
  return roundTo(
    recentHistory.reduce((total, entry) => total + (entry.scoreDelta ?? 0), 0),
    1,
  );
}

function calculateNetChipBalance(playerStats, history) {
  if (isFiniteNumber(playerStats?.netChipBalance)) {
    return Math.round(playerStats.netChipBalance);
  }

  return Math.round(
    (Array.isArray(history) ? history : []).reduce(
      (total, entry) => total + (entry.netChips ?? 0),
      0,
    ),
  );
}

function calculatePlayerStatus(playerStats = {}) {
  const source = playerStats?.statusState ?? playerStats ?? {};
  const history = normalizeHistory(source.history ?? playerStats?.history);
  const recentHands = history.length > 0
    ? history.length
    : isFiniteNumber(source.recentHands)
      ? Math.max(0, Math.round(source.recentHands))
      : 0;
  const statusScore = history.length > 0
    ? roundTo(history.reduce((total, entry) => total + entry.scoreDelta, 0), 1)
    : isFiniteNumber(source.statusScore)
      ? roundTo(source.statusScore, 1)
      : isFiniteNumber(source.recentScore)
        ? roundTo(source.recentScore, 1)
        : 0;
  const statusMomentum = history.length > 0
    ? calculateMomentum(history)
    : isFiniteNumber(source.statusMomentum)
      ? roundTo(source.statusMomentum, 1)
      : 0;
  const netChipBalance = calculateNetChipBalance(
    playerStats?.netChipBalance !== undefined ? playerStats : source,
    history,
  );
  const statusTier = resolveStatusTier(recentHands, statusScore, netChipBalance);

  return {
    netChipBalance,
    statusMomentum,
    statusScore,
    statusTier,
  };
}

function canQualifyForStatus(player, statusTier) {
  const requestedTier = normalizeStatusTier(statusTier);
  if (requestedTier === DEFAULT_STATUS_TIER) {
    return true;
  }

  const status = calculatePlayerStatus(player);
  if (requestedTier === 'shark' && status.netChipBalance <= 0) {
    return false;
  }

  return (
    getStatusTierStrength(status.statusTier) >= getStatusTierStrength(requestedTier)
  );
}

function resolvePlayerFromStore(playerId, playerStore) {
  if (!playerId) {
    return null;
  }

  if (typeof playerStore === 'function') {
    return playerStore(playerId) ?? null;
  }

  if (playerStore instanceof Map) {
    return playerStore.get(playerId) ?? null;
  }

  if (Array.isArray(playerStore)) {
    return playerStore.find((player) => player?.id === playerId) ?? null;
  }

  if (playerStore && typeof playerStore === 'object') {
    return playerStore[playerId] ?? null;
  }

  return null;
}

const registeredStatusPlayers = new Map();

function registerPlayerForStatusUpdates(player) {
  if (player?.id) {
    registeredStatusPlayers.set(player.id, player);
  }

  return player;
}

function unregisterPlayerForStatusUpdates(playerId) {
  registeredStatusPlayers.delete(playerId);
}

function updatePlayerStatus(playerId, playerStore = registeredStatusPlayers) {
  const player = resolvePlayerFromStore(playerId, playerStore);
  if (!player) {
    return null;
  }

  const nextStatus = calculatePlayerStatus(player);
  const changed =
    normalizeStatusTier(player.statusTier) !== nextStatus.statusTier ||
    (isFiniteNumber(player.statusScore) ? roundTo(player.statusScore, 1) : 0) !==
      nextStatus.statusScore ||
    (isFiniteNumber(player.statusMomentum) ? roundTo(player.statusMomentum, 1) : 0) !==
      nextStatus.statusMomentum;

  player.statusTier = nextStatus.statusTier;
  player.statusScore = nextStatus.statusScore;
  player.statusMomentum = nextStatus.statusMomentum;
  player.netChipBalance = nextStatus.netChipBalance;
  player.playerStatus = statusTierToPlayerStatus(nextStatus.statusTier);

  if (changed) {
    player.statusUpdatedAt = Date.now();
  } else if (!isFiniteNumber(player.statusUpdatedAt)) {
    player.statusUpdatedAt = null;
  }

  return player;
}

function getPlayerStatusStrength(status, config = PLAYER_STATUS_CONFIG) {
  return config.statusStrengths[normalizePlayerStatus(status)] ?? 0;
}

function resolvePlayerStatus(recentHands, recentScore, config = PLAYER_STATUS_CONFIG) {
  for (const threshold of config.statusThresholds) {
    if (recentHands >= threshold.minHands && recentScore >= threshold.minScore) {
      return threshold.status;
    }
  }

  return DEFAULT_PLAYER_STATUS;
}

function createInitialPlayerStatusState(config = PLAYER_STATUS_CONFIG) {
  return {
    history: [],
    invitePriority: config.reputationBase + config.invitePriorityBase,
    lastUpdatedAt: null,
    netChipBalance: 0,
    playerStatus: DEFAULT_PLAYER_STATUS,
    recentHands: 0,
    recentScore: 0,
    reputation: config.reputationBase,
    sharkWins: 0,
    statusMomentum: 0,
    statusScore: 0,
    statusTier: DEFAULT_STATUS_TIER,
    statusUpdatedAt: null,
    strongTableWins: 0,
    windowSize: config.recentWindowHands,
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  return {
    beatSharks: isFiniteNumber(entry.beatSharks) ? Math.max(0, Math.round(entry.beatSharks)) : 0,
    fieldStrength: isFiniteNumber(entry.fieldStrength) ? roundTo(entry.fieldStrength, 2) : 0,
    netBigBlinds: isFiniteNumber(entry.netBigBlinds) ? roundTo(entry.netBigBlinds, 2) : 0,
    netChips: isFiniteNumber(entry.netChips) ? Math.round(entry.netChips) : 0,
    occurredAt: isFiniteNumber(entry.occurredAt) ? entry.occurredAt : Date.now(),
    profitableHand: Boolean(entry.profitableHand),
    scoreDelta: isFiniteNumber(entry.scoreDelta) ? roundTo(entry.scoreDelta, 1) : 0,
    strongTableWin: Boolean(entry.strongTableWin),
    strongerPlayersBeaten: isFiniteNumber(entry.strongerPlayersBeaten)
      ? Math.max(0, Math.round(entry.strongerPlayersBeaten))
      : 0,
  };
}

function normalizeHistory(history, config = PLAYER_STATUS_CONFIG) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((entry) => normalizeHistoryEntry(entry))
    .filter(Boolean)
    .slice(-config.recentWindowHands);
}

function buildPlayerStatusState(history, lastUpdatedAt, config = PLAYER_STATUS_CONFIG) {
  const recentHands = history.length;
  const recentScore = roundTo(
    history.reduce((total, entry) => total + entry.scoreDelta, 0),
    1,
  );
  const sharkWins = history.reduce(
    (count, entry) => count + (entry.beatSharks > 0 ? 1 : 0),
    0,
  );
  const strongTableWins = history.reduce(
    (count, entry) => count + (entry.strongTableWin ? 1 : 0),
    0,
  );
  const netChipBalance = Math.round(
    history.reduce((total, entry) => total + entry.netChips, 0),
  );
  const statusMomentum = calculateMomentum(history);
  const statusTier = resolveStatusTier(recentHands, recentScore, netChipBalance);
  const playerStatus = statusTierToPlayerStatus(statusTier);
  const reputation = clamp(
    Math.round(
      config.reputationBase +
        recentScore * config.reputationScoreScale +
        sharkWins * 2 +
        strongTableWins,
    ),
    0,
    100,
  );
  const invitePriority = Math.round(
    config.invitePriorityBase +
      getPlayerStatusStrength(playerStatus, config) * 100 +
      reputation +
      strongTableWins * 4 +
      sharkWins * 6,
  );

  return {
    history,
    invitePriority,
    lastUpdatedAt,
    netChipBalance,
    playerStatus,
    recentHands,
    recentScore,
    reputation,
    sharkWins,
    statusMomentum,
    statusScore: recentScore,
    statusTier,
    statusUpdatedAt: lastUpdatedAt,
    strongTableWins,
    windowSize: config.recentWindowHands,
  };
}

function sanitizePlayerStatusState(raw, config = PLAYER_STATUS_CONFIG) {
  const baseState = createInitialPlayerStatusState(config);
  const history = normalizeHistory(raw?.history, config);

  if (history.length === 0) {
    const calculatedStatus = calculatePlayerStatus(raw ?? {});

    return {
      ...baseState,
      invitePriority: isFiniteNumber(raw?.invitePriority)
        ? Math.round(raw.invitePriority)
        : baseState.invitePriority,
      lastUpdatedAt: isFiniteNumber(raw?.lastUpdatedAt) ? raw.lastUpdatedAt : null,
      netChipBalance: isFiniteNumber(raw?.netChipBalance)
        ? Math.round(raw.netChipBalance)
        : baseState.netChipBalance,
      playerStatus: statusTierToPlayerStatus(calculatedStatus.statusTier),
      recentHands: 0,
      recentScore: 0,
      reputation: isFiniteNumber(raw?.reputation)
        ? clamp(Math.round(raw.reputation), 0, 100)
        : baseState.reputation,
      sharkWins: 0,
      statusMomentum: calculatedStatus.statusMomentum,
      statusScore: calculatedStatus.statusScore,
      statusTier: calculatedStatus.statusTier,
      statusUpdatedAt: isFiniteNumber(raw?.statusUpdatedAt) ? raw.statusUpdatedAt : null,
      strongTableWins: 0,
      windowSize: config.recentWindowHands,
    };
  }

  const lastEntry = history[history.length - 1];
  const nextUpdatedAt = isFiniteNumber(raw?.lastUpdatedAt)
    ? raw.lastUpdatedAt
    : lastEntry?.occurredAt ?? null;

  return buildPlayerStatusState(history, nextUpdatedAt, config);
}

function toParticipantSnapshot(participant, config = PLAYER_STATUS_CONFIG) {
  const statusState = sanitizePlayerStatusState(participant?.statusState, config);
  const playerStatus = normalizePlayerStatus(
    participant?.playerStatus ?? statusState.playerStatus,
  );

  return {
    id: participant.id,
    playerStatus,
    statusState: {
      ...statusState,
      playerStatus,
    },
    totalContribution: isFiniteNumber(participant?.totalContribution)
      ? participant.totalContribution
      : 0,
  };
}

function scoreHandResult(
  participant,
  participants,
  payouts,
  bigBlind,
  occurredAt,
  config = PLAYER_STATUS_CONFIG,
) {
  const currentStrength = getPlayerStatusStrength(participant.playerStatus, config);
  const opponents = participants.filter(
    (candidate) => candidate.id !== participant.id,
  );
  const opponentStrengths = opponents.map((opponent) =>
    getPlayerStatusStrength(opponent.playerStatus, config),
  );
  const averageOpponentStrength =
    opponentStrengths.length > 0
      ? opponentStrengths.reduce((sum, value) => sum + value, 0) /
        opponentStrengths.length
      : 0;
  const strongerOpponents = opponentStrengths.filter(
    (value) => value > currentStrength,
  ).length;
  const sharkOpponents = opponents.filter(
    (opponent) => opponent.playerStatus === 'SHARK',
  ).length;
  const payout = isFiniteNumber(payouts?.[participant.id])
    ? Math.round(payouts[participant.id])
    : 0;
  const netChips = payout - participant.totalContribution;
  const netBigBlinds = bigBlind > 0 ? netChips / bigBlind : netChips;
  const profitableHand = netChips > 0;
  const cappedNetBigBlinds = clamp(
    netBigBlinds,
    config.scoreClamp.minNetBigBlinds,
    config.scoreClamp.maxNetBigBlinds,
  );

  let scoreDelta = cappedNetBigBlinds * config.scoreWeights.netBigBlindPoints;

  if (profitableHand) {
    scoreDelta += config.scoreWeights.profitableHandBonus;
    scoreDelta += strongerOpponents * config.scoreWeights.strongerOpponentBonus;
    scoreDelta += averageOpponentStrength * config.scoreWeights.tableStrengthBonus;
    scoreDelta += sharkOpponents * config.scoreWeights.sharkBonus;
  } else if (netChips < 0) {
    scoreDelta -= config.scoreWeights.lossHandPenalty;
    scoreDelta += Math.min(
      config.scoreWeights.maxLossRelief,
      averageOpponentStrength * config.scoreWeights.lossReliefPerStrength,
    );
  }

  return normalizeHistoryEntry({
    beatSharks: profitableHand ? sharkOpponents : 0,
    fieldStrength: averageOpponentStrength,
    netBigBlinds,
    netChips,
    occurredAt,
    profitableHand,
    scoreDelta,
    strongTableWin:
      profitableHand &&
      (averageOpponentStrength >= config.strongTableStrengthThreshold ||
        strongerOpponents > 0),
    strongerPlayersBeaten: profitableHand ? strongerOpponents : 0,
  });
}

function applyHandResultsToPlayerStatuses(
  participants,
  payouts,
  bigBlind,
  occurredAt = Date.now(),
  config = PLAYER_STATUS_CONFIG,
) {
  const snapshots = Array.isArray(participants)
    ? participants
        .filter(
          (participant) =>
            participant &&
            typeof participant.id === 'string' &&
            participant.id.length > 0,
        )
        .map((participant) => toParticipantSnapshot(participant, config))
    : [];

  return snapshots.reduce((results, participant) => {
    const handResult = scoreHandResult(
      participant,
      snapshots,
      payouts,
      bigBlind,
      occurredAt,
      config,
    );
    const history = [...participant.statusState.history, handResult].slice(
      -config.recentWindowHands,
    );

    const previousStatus = calculatePlayerStatus(participant.statusState);
    const nextStatusState = buildPlayerStatusState(history, occurredAt, config);
    const nextStatus = calculatePlayerStatus(nextStatusState);
    const statusChanged =
      previousStatus.statusTier !== nextStatus.statusTier ||
      previousStatus.statusScore !== nextStatus.statusScore ||
      previousStatus.statusMomentum !== nextStatus.statusMomentum;

    results[participant.id] = {
      ...nextStatusState,
      statusUpdatedAt: statusChanged
        ? occurredAt
        : participant.statusState.statusUpdatedAt ?? null,
    };
    return results;
  }, {});
}

function toPublicPlayerStatusSnapshot(state, config = PLAYER_STATUS_CONFIG) {
  const normalizedState = sanitizePlayerStatusState(state, config);

  return {
    invitePriority: normalizedState.invitePriority,
    lastUpdatedAt: normalizedState.lastUpdatedAt,
    netChipBalance: normalizedState.netChipBalance,
    recentHands: normalizedState.recentHands,
    recentScore: normalizedState.recentScore,
    reputation: normalizedState.reputation,
    sharkWins: normalizedState.sharkWins,
    statusMomentum: normalizedState.statusMomentum,
    statusScore: normalizedState.statusScore,
    statusTier: normalizedState.statusTier,
    statusUpdatedAt: normalizedState.statusUpdatedAt,
    strongTableWins: normalizedState.strongTableWins,
    windowSize: normalizedState.windowSize,
  };
}

module.exports = {
  DEFAULT_PLAYER_STATUS,
  DEFAULT_STATUS_TIER,
  PLAYER_STATUSES,
  PLAYER_STATUS_CONFIG,
  STATUS_TIERS,
  applyHandResultsToPlayerStatuses,
  calculatePlayerStatus,
  canQualifyForStatus,
  createInitialPlayerStatusState,
  getPlayerStatusStrength,
  normalizePlayerStatus,
  normalizeStatusTier,
  registerPlayerForStatusUpdates,
  sanitizePlayerStatusState,
  statusTierToPlayerStatus,
  toPublicPlayerStatusSnapshot,
  unregisterPlayerForStatusUpdates,
  updatePlayerStatus,
};
