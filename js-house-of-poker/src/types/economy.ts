export type PokerEconomyLedgerEntryType =
  | 'admin-grant'
  | 'gift'
  | 'gift-buy-in'
  | 'purchase'
  | 'table-buy-in'
  | 'weekly-reload';

export type PokerEconomyGiftEligibilityReason =
  | 'friends'
  | 'invited-player'
  | 'same-table'
  | 'not-eligible';

export type PokerEconomyComplianceState = {
  clipToChipRate: number;
  disclosure: string;
  hasCashValue: false;
  isCashoutAvailable: false;
  isVirtualOnly: true;
};

export type PokerEconomyGiftingState = {
  clipsGiftedToday: number;
  clipsRemainingToday: number;
  cooldownEndsAt: number | null;
  cooldownMs: number;
  giftsRemainingToday: number;
  maxClipsPerDay: number;
  maxGiftsPerDay: number;
};

export type PokerEconomyWeeklyReloadState = {
  amountClips: number;
  lastAppliedAt: number | null;
  nextEligibleAt: number;
};

export type PokerEconomyState = {
  canAffordDefaultBuyIn: boolean;
  chipEquivalentBalance: number;
  clipBalance: number;
  compliance: PokerEconomyComplianceState;
  defaultTableBuyInChips: number;
  gifting: PokerEconomyGiftingState;
  weeklyReload: PokerEconomyWeeklyReloadState;
};

export type PokerEconomyLedgerEntry = {
  accountId: string;
  balanceAfterChipEquivalent: number;
  balanceAfterClips: number;
  chipDelta: number;
  clipDelta: number;
  counterpartyAccountId: string | null;
  createdAt: number;
  id: string;
  metadata: Record<string, unknown>;
  tableId: string | null;
  type: PokerEconomyLedgerEntryType;
};

export type PokerEconomyPolicy = {
  bootstrapGrantClips: number;
  clipToChipRate: number;
  defaultTableBuyInChips: number;
  disclosure: string;
  giftCooldownMs: number;
  maxGiftClipsPerDay: number;
  maxGiftsPerDay: number;
  weeklyReloadClips: number;
  weeklyReloadWeekday: number;
  weeklyReloadWindowHour: number;
  weeklyReloadWindowMinute: number;
};

export type PokerEconomyGiftEligibility = {
  isAllowed: boolean;
  isFriend: boolean;
  isInvited: boolean;
  isSameTable: boolean;
  reason: PokerEconomyGiftEligibilityReason;
};

export type PokerEconomyAccount = {
  accountId: string;
  clipBalance: number;
  createdAt: number;
  giftState: {
    clipsGiftedToday: number;
    cooldownEndsAt: number | null;
    dayKey: string | null;
    giftsSentToday: number;
    lastGiftAt: number | null;
  };
  lastWeeklyReloadAt: number | null;
  lastWeeklyReloadWindowStart: number | null;
  updatedAt: number;
};

export type PokerEconomyRepositories = {
  addFriendship: (leftAccountId: string, rightAccountId: string) => void;
  appendLedgerEntry: (entry: PokerEconomyLedgerEntry) => PokerEconomyLedgerEntry;
  getAccount: (accountId: string) => PokerEconomyAccount | null;
  getGiftEligibilityContext: (input: {
    recipientAccountId: string;
    senderAccountId: string;
    tableId: string | null;
  }) => PokerEconomyGiftEligibility;
  listLedgerEntries: (accountId: string) => PokerEconomyLedgerEntry[];
  recordTableInvite: (tableId: string, invitedAccountId: string) => void;
  removeTableParticipant: (tableId: string, accountId: string) => void;
  saveAccount: (account: PokerEconomyAccount) => PokerEconomyAccount;
  syncTableParticipants: (tableId: string, accountIds: string[]) => void;
};

export type PokerEconomyService = {
  addFriendship: (leftAccountId: string, rightAccountId: string) => void;
  buildClientState: (accountId: string) => PokerEconomyState;
  buyInToTable: (input: {
    accountId: string;
    chips: number;
    metadata?: Record<string, unknown>;
    tableId: string;
  }) => {
    balance: PokerEconomyState;
    chips: number;
    clipsDebited: number;
    ledgerEntry: PokerEconomyLedgerEntry;
  };
  canAffordTableBuyIn: (accountId: string, chips?: number) => boolean;
  getLedgerEntries: (accountId: string) => PokerEconomyLedgerEntry[];
  getPolicy: () => PokerEconomyPolicy;
  giftBuyIn: (input: {
    chips: number;
    metadata?: Record<string, unknown>;
    recipientAccountId: string;
    senderAccountId: string;
    tableId: string;
  }) => {
    chips: number;
    clipsDebited: number;
    recipientBalance: PokerEconomyState;
    recipientLedgerEntry: PokerEconomyLedgerEntry;
    senderBalance: PokerEconomyState;
    senderLedgerEntry: PokerEconomyLedgerEntry;
  };
  giftClips: (input: {
    clips: number;
    metadata?: Record<string, unknown>;
    recipientAccountId: string;
    senderAccountId: string;
    tableId?: string | null;
  }) => {
    recipientBalance: PokerEconomyState;
    recipientLedgerEntry: PokerEconomyLedgerEntry;
    senderBalance: PokerEconomyState;
    senderLedgerEntry: PokerEconomyLedgerEntry;
  };
  grantClips: (input: {
    accountId: string;
    clips: number;
    metadata?: Record<string, unknown>;
  }) => {
    balance: PokerEconomyState;
    ledgerEntry: PokerEconomyLedgerEntry;
  };
  purchaseClips: (input: {
    accountId: string;
    clips: number;
    metadata?: Record<string, unknown>;
  }) => {
    balance: PokerEconomyState;
    ledgerEntry: PokerEconomyLedgerEntry;
  };
  recordTableInvite: (tableId: string, invitedAccountId: string) => void;
  removeTableParticipant: (tableId: string, accountId: string) => void;
  syncTableParticipants: (tableId: string, accountIds: string[]) => void;
};
