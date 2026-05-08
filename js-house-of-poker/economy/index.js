const CLIP_TO_CHIP_RATE = 40;
const DEFAULT_TABLE_BUY_IN_CHIPS = 1000;
const DEFAULT_WEEKLY_RELOAD_CLIPS = 100;
const DEFAULT_MAX_GIFT_CLIPS_PER_DAY = 500;
const DEFAULT_MAX_GIFTS_PER_DAY = 10;
const DEFAULT_GIFT_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_BOOTSTRAP_GRANT_CLIPS = 100;
const ECONOMY_DISCLOSURE = 'Clips are virtual only and have no cash value.';
const LEDGER_ENTRY_TYPES = {
  ADMIN_GRANT: 'admin-grant',
  GIFT: 'gift',
  GIFT_BUY_IN: 'gift-buy-in',
  PURCHASE: 'purchase',
  TABLE_BUY_IN: 'table-buy-in',
  WEEKLY_RELOAD: 'weekly-reload',
};

function createEconomyError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function toDayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function normalizePositiveInteger(value, label) {
  const nextValue = Number(value);
  if (!Number.isInteger(nextValue) || nextValue <= 0) {
    throw createEconomyError(`${label} must be a positive whole number.`, 'INVALID_AMOUNT', {
      label,
      value,
    });
  }

  return nextValue;
}

function normalizePolicy(overrides = {}) {
  return {
    bootstrapGrantClips:
      overrides.bootstrapGrantClips ?? DEFAULT_BOOTSTRAP_GRANT_CLIPS,
    clipToChipRate: overrides.clipToChipRate ?? CLIP_TO_CHIP_RATE,
    disclosure: overrides.disclosure ?? ECONOMY_DISCLOSURE,
    giftCooldownMs: overrides.giftCooldownMs ?? DEFAULT_GIFT_COOLDOWN_MS,
    maxGiftClipsPerDay:
      overrides.maxGiftClipsPerDay ?? DEFAULT_MAX_GIFT_CLIPS_PER_DAY,
    maxGiftsPerDay: overrides.maxGiftsPerDay ?? DEFAULT_MAX_GIFTS_PER_DAY,
    weeklyReloadClips:
      overrides.weeklyReloadClips ?? DEFAULT_WEEKLY_RELOAD_CLIPS,
    weeklyReloadWeekday:
      overrides.weeklyReloadWeekday ?? 5,
    weeklyReloadWindowHour:
      overrides.weeklyReloadWindowHour ?? 0,
    weeklyReloadWindowMinute:
      overrides.weeklyReloadWindowMinute ?? 1,
    defaultTableBuyInChips:
      overrides.defaultTableBuyInChips ?? DEFAULT_TABLE_BUY_IN_CHIPS,
  };
}

function cloneGiftState(giftState = {}) {
  return {
    clipsGiftedToday: Number(giftState.clipsGiftedToday) || 0,
    cooldownEndsAt:
      typeof giftState.cooldownEndsAt === 'number'
        ? giftState.cooldownEndsAt
        : null,
    dayKey:
      typeof giftState.dayKey === 'string' && giftState.dayKey.length > 0
        ? giftState.dayKey
        : null,
    giftsSentToday: Number(giftState.giftsSentToday) || 0,
    lastGiftAt:
      typeof giftState.lastGiftAt === 'number' ? giftState.lastGiftAt : null,
  };
}

function cloneAccount(account) {
  return {
    accountId: account.accountId,
    clipBalance: Number(account.clipBalance) || 0,
    createdAt: Number(account.createdAt) || Date.now(),
    giftState: cloneGiftState(account.giftState),
    lastWeeklyReloadAt:
      typeof account.lastWeeklyReloadAt === 'number'
        ? account.lastWeeklyReloadAt
        : null,
    lastWeeklyReloadWindowStart:
      typeof account.lastWeeklyReloadWindowStart === 'number'
        ? account.lastWeeklyReloadWindowStart
        : null,
    updatedAt: Number(account.updatedAt) || Date.now(),
  };
}

function createEmptyAccount(accountId, now) {
  return {
    accountId,
    clipBalance: 0,
    createdAt: now,
    giftState: {
      clipsGiftedToday: 0,
      cooldownEndsAt: null,
      dayKey: toDayKey(now),
      giftsSentToday: 0,
      lastGiftAt: null,
    },
    lastWeeklyReloadAt: null,
    lastWeeklyReloadWindowStart: null,
    updatedAt: now,
  };
}

function buildLedgerEntry({
  account,
  chipDelta,
  clipDelta,
  counterpartyAccountId = null,
  metadata = {},
  now,
  tableId = null,
  type,
}) {
  return {
    accountId: account.accountId,
    balanceAfterChipEquivalent: account.clipBalance * CLIP_TO_CHIP_RATE,
    balanceAfterClips: account.clipBalance,
    chipDelta,
    clipDelta,
    counterpartyAccountId,
    createdAt: now,
    id: `ledger_${now}_${Math.random().toString(36).slice(2, 10)}`,
    metadata,
    tableId,
    type,
  };
}

function toClipCost(chips, policy) {
  const normalizedChips = normalizePositiveInteger(chips, 'Chips');
  if (normalizedChips % policy.clipToChipRate !== 0) {
    throw createEconomyError(
      `Buy-ins must convert cleanly at 1 clip = ${policy.clipToChipRate} chips.`,
      'INVALID_BUY_IN_AMOUNT',
      {
        chips: normalizedChips,
        clipToChipRate: policy.clipToChipRate,
      },
    );
  }

  return normalizedChips / policy.clipToChipRate;
}

function getWeeklyReloadWindowStart(timestamp, policy) {
  const date = new Date(timestamp);
  const currentWeekday = date.getDay();
  const daysSinceReloadDay =
    (currentWeekday - policy.weeklyReloadWeekday + 7) % 7;

  date.setHours(
    policy.weeklyReloadWindowHour,
    policy.weeklyReloadWindowMinute,
    0,
    0,
  );
  date.setDate(date.getDate() - daysSinceReloadDay);

  if (date.getTime() > timestamp) {
    date.setDate(date.getDate() - 7);
  }

  return date.getTime();
}

function getNextWeeklyReloadAt(timestamp, policy) {
  return (
    getWeeklyReloadWindowStart(timestamp, policy) + 7 * 24 * 60 * 60 * 1000
  );
}

function resetGiftWindowIfNeeded(account, now) {
  const dayKey = toDayKey(now);
  if (account.giftState.dayKey === dayKey) {
    return false;
  }

  account.giftState.dayKey = dayKey;
  account.giftState.clipsGiftedToday = 0;
  account.giftState.giftsSentToday = 0;
  return true;
}

function assertSufficientClips(account, requiredClips) {
  if (account.clipBalance < requiredClips) {
    throw createEconomyError('Not enough clips available for this action.', 'INSUFFICIENT_CLIPS', {
      availableClips: account.clipBalance,
      requiredClips,
    });
  }
}

function defaultClock() {
  return Date.now();
}

function createInMemoryRepositories() {
  const accounts = new Map();
  const ledgerEntries = [];
  const friendships = new Map();
  const tableInvites = new Map();
  const tableParticipants = new Map();

  function friendSet(accountId) {
    if (!friendships.has(accountId)) {
      friendships.set(accountId, new Set());
    }

    return friendships.get(accountId);
  }

  return {
    addFriendship(leftAccountId, rightAccountId) {
      friendSet(leftAccountId).add(rightAccountId);
      friendSet(rightAccountId).add(leftAccountId);
    },
    appendLedgerEntry(entry) {
      ledgerEntries.unshift({ ...entry });
      return { ...entry };
    },
    getAccount(accountId) {
      const account = accounts.get(accountId);
      return account ? cloneAccount(account) : null;
    },
    getGiftEligibilityContext({ recipientAccountId, senderAccountId, tableId }) {
      const isFriend = friendSet(senderAccountId).has(recipientAccountId);
      const invitedAccounts = tableId ? tableInvites.get(tableId) ?? new Set() : new Set();
      const participantAccounts = tableId
        ? tableParticipants.get(tableId) ?? new Set()
        : null;
      const isInvited =
        Boolean(tableId) &&
        invitedAccounts.has(recipientAccountId) &&
        participantAccounts?.has(senderAccountId);
      const isSameTable = tableId
        ? Boolean(
            participantAccounts?.has(senderAccountId) &&
              participantAccounts?.has(recipientAccountId),
          )
        : Array.from(tableParticipants.values()).some(
            (participants) =>
              participants.has(senderAccountId) &&
              participants.has(recipientAccountId),
          );

      return {
        isAllowed: isFriend || isInvited || isSameTable,
        isFriend,
        isInvited,
        isSameTable,
        reason: isFriend
          ? 'friends'
          : isInvited
            ? 'invited-player'
            : isSameTable
              ? 'same-table'
              : 'not-eligible',
      };
    },
    listLedgerEntries(accountId) {
      return ledgerEntries
        .filter((entry) => entry.accountId === accountId)
        .map((entry) => ({ ...entry }));
    },
    recordTableInvite(tableId, invitedAccountId) {
      if (!tableInvites.has(tableId)) {
        tableInvites.set(tableId, new Set());
      }

      tableInvites.get(tableId).add(invitedAccountId);
    },
    removeTableParticipant(tableId, accountId) {
      const participants = tableParticipants.get(tableId);
      if (!participants) {
        return;
      }

      participants.delete(accountId);
      if (participants.size === 0) {
        tableParticipants.delete(tableId);
      }
    },
    saveAccount(account) {
      const storedAccount = cloneAccount(account);
      accounts.set(account.accountId, storedAccount);
      return cloneAccount(storedAccount);
    },
    syncTableParticipants(tableId, accountIds) {
      const nextParticipants = new Set(accountIds.filter(Boolean));
      if (nextParticipants.size === 0) {
        tableParticipants.delete(tableId);
        return;
      }

      tableParticipants.set(tableId, nextParticipants);
    },
  };
}

function createEconomyService({
  clock = defaultClock,
  policy: policyOverrides,
  repositories,
}) {
  const policy = normalizePolicy(policyOverrides);

  function appendLedgerEntry(entry) {
    return repositories.appendLedgerEntry(entry);
  }

  function saveAccount(account) {
    account.updatedAt = clock();
    return repositories.saveAccount(account);
  }

  function grantBootstrapBalanceIfNeeded(account, now) {
    if (policy.bootstrapGrantClips <= 0 || account.clipBalance > 0) {
      return account;
    }

    account.clipBalance += policy.bootstrapGrantClips;
    account.updatedAt = now;
    const savedAccount = saveAccount(account);
    appendLedgerEntry(
      buildLedgerEntry({
        account: savedAccount,
        chipDelta: policy.bootstrapGrantClips * policy.clipToChipRate,
        clipDelta: policy.bootstrapGrantClips,
        metadata: {
          reason: 'bootstrap-balance',
        },
        now,
        type: LEDGER_ENTRY_TYPES.ADMIN_GRANT,
      }),
    );
    return savedAccount;
  }

  function applyWeeklyReloadIfDue(account, now) {
    const reloadWindowStart = getWeeklyReloadWindowStart(now, policy);
    if (account.lastWeeklyReloadWindowStart === reloadWindowStart) {
      return account;
    }

    if (reloadWindowStart > now) {
      return account;
    }

    account.clipBalance += policy.weeklyReloadClips;
    account.lastWeeklyReloadAt = now;
    account.lastWeeklyReloadWindowStart = reloadWindowStart;
    account.updatedAt = now;
    const savedAccount = saveAccount(account);
    appendLedgerEntry(
      buildLedgerEntry({
        account: savedAccount,
        chipDelta: policy.weeklyReloadClips * policy.clipToChipRate,
        clipDelta: policy.weeklyReloadClips,
        metadata: {
          reloadWindowStart,
        },
        now,
        type: LEDGER_ENTRY_TYPES.WEEKLY_RELOAD,
      }),
    );
    return savedAccount;
  }

  function ensureAccount(accountId) {
    const now = clock();
    let account = repositories.getAccount(accountId);
    let hasMutated = false;

    if (!account) {
      account = repositories.saveAccount(createEmptyAccount(accountId, now));
      hasMutated = true;
    }

    if (resetGiftWindowIfNeeded(account, now)) {
      hasMutated = true;
    }

    if (hasMutated) {
      account = saveAccount(account);
    }

    account = grantBootstrapBalanceIfNeeded(account, now);
    account = applyWeeklyReloadIfDue(account, now);
    return account;
  }

  function buildClientState(accountId) {
    const now = clock();
    const account = ensureAccount(accountId);

    return {
      canAffordDefaultBuyIn:
        account.clipBalance * policy.clipToChipRate >=
        policy.defaultTableBuyInChips,
      chipEquivalentBalance: account.clipBalance * policy.clipToChipRate,
      clipBalance: account.clipBalance,
      compliance: {
        clipToChipRate: policy.clipToChipRate,
        disclosure: policy.disclosure,
        hasCashValue: false,
        isCashoutAvailable: false,
        isVirtualOnly: true,
      },
      defaultTableBuyInChips: policy.defaultTableBuyInChips,
      gifting: {
        clipsGiftedToday: account.giftState.clipsGiftedToday,
        clipsRemainingToday: Math.max(
          0,
          policy.maxGiftClipsPerDay - account.giftState.clipsGiftedToday,
        ),
        cooldownEndsAt: account.giftState.cooldownEndsAt,
        cooldownMs: policy.giftCooldownMs,
        giftsRemainingToday: Math.max(
          0,
          policy.maxGiftsPerDay - account.giftState.giftsSentToday,
        ),
        maxClipsPerDay: policy.maxGiftClipsPerDay,
        maxGiftsPerDay: policy.maxGiftsPerDay,
      },
      weeklyReload: {
        amountClips: policy.weeklyReloadClips,
        lastAppliedAt: account.lastWeeklyReloadAt,
        nextEligibleAt: getNextWeeklyReloadAt(now, policy),
      },
    };
  }

  function mutateAccountBalance(account, {
    chipDelta,
    clipDelta,
    counterpartyAccountId = null,
    metadata = {},
    now,
    tableId = null,
    type,
  }) {
    account.clipBalance += clipDelta;
    account.updatedAt = now;
    const savedAccount = saveAccount(account);
    const entry = buildLedgerEntry({
      account: savedAccount,
      chipDelta,
      clipDelta,
      counterpartyAccountId,
      metadata,
      now,
      tableId,
      type,
    });
    appendLedgerEntry(entry);
    return {
      account: savedAccount,
      entry,
    };
  }

  function recordGiftUsage(account, clips, now) {
    resetGiftWindowIfNeeded(account, now);
    account.giftState.clipsGiftedToday += clips;
    account.giftState.cooldownEndsAt = now + policy.giftCooldownMs;
    account.giftState.giftsSentToday += 1;
    account.giftState.lastGiftAt = now;
  }

  function assertGiftAllowed(senderAccount, clips, now) {
    resetGiftWindowIfNeeded(senderAccount, now);

    if (
      senderAccount.giftState.cooldownEndsAt &&
      senderAccount.giftState.cooldownEndsAt > now
    ) {
      throw createEconomyError('Gift cooldown is still active.', 'GIFT_COOLDOWN_ACTIVE', {
        cooldownEndsAt: senderAccount.giftState.cooldownEndsAt,
      });
    }

    if (senderAccount.giftState.giftsSentToday >= policy.maxGiftsPerDay) {
      throw createEconomyError('Daily gift count limit reached.', 'GIFT_COUNT_LIMIT_REACHED', {
        maxGiftsPerDay: policy.maxGiftsPerDay,
      });
    }

    if (
      senderAccount.giftState.clipsGiftedToday + clips >
      policy.maxGiftClipsPerDay
    ) {
      throw createEconomyError('Daily gifted clip limit reached.', 'GIFT_CLIP_LIMIT_REACHED', {
        clipsRequested: clips,
        clipsRemaining:
          policy.maxGiftClipsPerDay - senderAccount.giftState.clipsGiftedToday,
        maxGiftClipsPerDay: policy.maxGiftClipsPerDay,
      });
    }

    assertSufficientClips(senderAccount, clips);
  }

  function purchaseClips({ accountId, clips, metadata = {} }) {
    const now = clock();
    const account = ensureAccount(accountId);
    const normalizedClips = normalizePositiveInteger(clips, 'Clips');
    const result = mutateAccountBalance(account, {
      chipDelta: normalizedClips * policy.clipToChipRate,
      clipDelta: normalizedClips,
      metadata,
      now,
      type: LEDGER_ENTRY_TYPES.PURCHASE,
    });

    return {
      balance: buildClientState(accountId),
      ledgerEntry: result.entry,
    };
  }

  function grantClips({ accountId, clips, metadata = {} }) {
    const now = clock();
    const account = ensureAccount(accountId);
    const normalizedClips = normalizePositiveInteger(clips, 'Clips');
    const result = mutateAccountBalance(account, {
      chipDelta: normalizedClips * policy.clipToChipRate,
      clipDelta: normalizedClips,
      metadata,
      now,
      type: LEDGER_ENTRY_TYPES.ADMIN_GRANT,
    });

    return {
      balance: buildClientState(accountId),
      ledgerEntry: result.entry,
    };
  }

  function buyInToTable({ accountId, chips, metadata = {}, tableId }) {
    const now = clock();
    const account = ensureAccount(accountId);
    const normalizedChips = normalizePositiveInteger(chips, 'Chips');
    const requiredClips = toClipCost(normalizedChips, policy);

    assertSufficientClips(account, requiredClips);
    const result = mutateAccountBalance(account, {
      chipDelta: normalizedChips,
      clipDelta: -requiredClips,
      metadata,
      now,
      tableId,
      type: LEDGER_ENTRY_TYPES.TABLE_BUY_IN,
    });

    return {
      balance: buildClientState(accountId),
      chips: normalizedChips,
      clipsDebited: requiredClips,
      ledgerEntry: result.entry,
    };
  }

  function giftClips({
    metadata = {},
    recipientAccountId,
    senderAccountId,
    tableId = null,
    clips,
  }) {
    if (recipientAccountId === senderAccountId) {
      throw createEconomyError('You cannot gift clips to yourself.', 'SELF_GIFT_NOT_ALLOWED');
    }

    const now = clock();
    const normalizedClips = normalizePositiveInteger(clips, 'Clips');
    const senderAccount = ensureAccount(senderAccountId);
    const recipientAccount = ensureAccount(recipientAccountId);
    const eligibility = repositories.getGiftEligibilityContext({
      recipientAccountId,
      senderAccountId,
      tableId,
    });

    if (!eligibility.isAllowed) {
      throw createEconomyError(
        'Gifts are limited to friends, invited players, or current tablemates.',
        'GIFT_NOT_ALLOWED',
        eligibility,
      );
    }

    assertGiftAllowed(senderAccount, normalizedClips, now);
    recordGiftUsage(senderAccount, normalizedClips, now);

    const senderResult = mutateAccountBalance(senderAccount, {
      chipDelta: -(normalizedClips * policy.clipToChipRate),
      clipDelta: -normalizedClips,
      counterpartyAccountId: recipientAccountId,
      metadata: {
        ...metadata,
        eligibilityReason: eligibility.reason,
      },
      now,
      tableId,
      type: LEDGER_ENTRY_TYPES.GIFT,
    });
    const recipientResult = mutateAccountBalance(recipientAccount, {
      chipDelta: normalizedClips * policy.clipToChipRate,
      clipDelta: normalizedClips,
      counterpartyAccountId: senderAccountId,
      metadata: {
        ...metadata,
        eligibilityReason: eligibility.reason,
      },
      now,
      tableId,
      type: LEDGER_ENTRY_TYPES.GIFT,
    });

    return {
      recipientBalance: buildClientState(recipientAccountId),
      recipientLedgerEntry: recipientResult.entry,
      senderBalance: buildClientState(senderAccountId),
      senderLedgerEntry: senderResult.entry,
    };
  }

  function giftBuyIn({
    chips,
    metadata = {},
    recipientAccountId,
    senderAccountId,
    tableId,
  }) {
    if (recipientAccountId === senderAccountId) {
      throw createEconomyError('You cannot gift a buy-in to yourself.', 'SELF_GIFT_NOT_ALLOWED');
    }

    const now = clock();
    const normalizedChips = normalizePositiveInteger(chips, 'Chips');
    const requiredClips = toClipCost(normalizedChips, policy);
    const senderAccount = ensureAccount(senderAccountId);
    const recipientAccount = ensureAccount(recipientAccountId);
    const eligibility = repositories.getGiftEligibilityContext({
      recipientAccountId,
      senderAccountId,
      tableId,
    });

    if (!eligibility.isAllowed) {
      throw createEconomyError(
        'Gift buy-ins are limited to friends, invited players, or current tablemates.',
        'GIFT_NOT_ALLOWED',
        eligibility,
      );
    }

    assertGiftAllowed(senderAccount, requiredClips, now);
    recordGiftUsage(senderAccount, requiredClips, now);

    const senderResult = mutateAccountBalance(senderAccount, {
      chipDelta: -normalizedChips,
      clipDelta: -requiredClips,
      counterpartyAccountId: recipientAccountId,
      metadata: {
        ...metadata,
        eligibilityReason: eligibility.reason,
      },
      now,
      tableId,
      type: LEDGER_ENTRY_TYPES.GIFT_BUY_IN,
    });
    const recipientEntry = appendLedgerEntry(
      buildLedgerEntry({
        account: recipientAccount,
        chipDelta: normalizedChips,
        clipDelta: 0,
        counterpartyAccountId: senderAccountId,
        metadata: {
          ...metadata,
          eligibilityReason: eligibility.reason,
        },
        now,
        tableId,
        type: LEDGER_ENTRY_TYPES.GIFT_BUY_IN,
      }),
    );

    return {
      chips: normalizedChips,
      clipsDebited: requiredClips,
      recipientBalance: buildClientState(recipientAccountId),
      recipientLedgerEntry: recipientEntry,
      senderBalance: buildClientState(senderAccountId),
      senderLedgerEntry: senderResult.entry,
    };
  }

  function canAffordTableBuyIn(accountId, chips = policy.defaultTableBuyInChips) {
    const account = ensureAccount(accountId);
    const requiredClips = toClipCost(chips, policy);
    return account.clipBalance >= requiredClips;
  }

  return {
    addFriendship(leftAccountId, rightAccountId) {
      repositories.addFriendship(leftAccountId, rightAccountId);
    },
    buildClientState,
    buyInToTable,
    canAffordTableBuyIn,
    getLedgerEntries(accountId) {
      ensureAccount(accountId);
      return repositories.listLedgerEntries(accountId);
    },
    getPolicy() {
      return {
        ...policy,
        disclosure: policy.disclosure,
      };
    },
    giftBuyIn,
    giftClips,
    grantClips,
    purchaseClips,
    recordTableInvite(tableId, invitedAccountId) {
      repositories.recordTableInvite(tableId, invitedAccountId);
    },
    removeTableParticipant(tableId, accountId) {
      repositories.removeTableParticipant(tableId, accountId);
    },
    syncTableParticipants(tableId, accountIds) {
      repositories.syncTableParticipants(tableId, accountIds);
    },
  };
}

function createInMemoryEconomyService(options = {}) {
  const repositories = createInMemoryRepositories();
  return createEconomyService({
    ...options,
    repositories,
  });
}

module.exports = {
  CLIP_TO_CHIP_RATE,
  DEFAULT_GIFT_COOLDOWN_MS,
  DEFAULT_MAX_GIFT_CLIPS_PER_DAY,
  DEFAULT_MAX_GIFTS_PER_DAY,
  DEFAULT_TABLE_BUY_IN_CHIPS,
  DEFAULT_WEEKLY_RELOAD_CLIPS,
  ECONOMY_DISCLOSURE,
  LEDGER_ENTRY_TYPES,
  createEconomyError,
  createEconomyService,
  createInMemoryEconomyService,
};
