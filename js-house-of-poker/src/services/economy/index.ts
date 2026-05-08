import type {
  PokerEconomyPolicy,
  PokerEconomyRepositories,
  PokerEconomyService,
} from '../../types/economy';

const economyRuntime = require('../../../economy') as {
  CLIP_TO_CHIP_RATE: number;
  DEFAULT_GIFT_COOLDOWN_MS: number;
  DEFAULT_MAX_GIFT_CLIPS_PER_DAY: number;
  DEFAULT_MAX_GIFTS_PER_DAY: number;
  DEFAULT_TABLE_BUY_IN_CHIPS: number;
  DEFAULT_WEEKLY_RELOAD_CLIPS: number;
  ECONOMY_DISCLOSURE: string;
  LEDGER_ENTRY_TYPES: Record<string, string>;
  createEconomyService: (options: {
    clock?: () => number;
    policy?: Partial<PokerEconomyPolicy>;
    repositories: PokerEconomyRepositories;
  }) => PokerEconomyService;
  createInMemoryEconomyService: (options?: {
    clock?: () => number;
    policy?: Partial<PokerEconomyPolicy>;
  }) => PokerEconomyService;
};

export const CLIP_TO_CHIP_RATE = economyRuntime.CLIP_TO_CHIP_RATE;
export const DEFAULT_GIFT_COOLDOWN_MS =
  economyRuntime.DEFAULT_GIFT_COOLDOWN_MS;
export const DEFAULT_MAX_GIFT_CLIPS_PER_DAY =
  economyRuntime.DEFAULT_MAX_GIFT_CLIPS_PER_DAY;
export const DEFAULT_MAX_GIFTS_PER_DAY =
  economyRuntime.DEFAULT_MAX_GIFTS_PER_DAY;
export const DEFAULT_TABLE_BUY_IN_CHIPS =
  economyRuntime.DEFAULT_TABLE_BUY_IN_CHIPS;
export const DEFAULT_WEEKLY_RELOAD_CLIPS =
  economyRuntime.DEFAULT_WEEKLY_RELOAD_CLIPS;
export const ECONOMY_DISCLOSURE = economyRuntime.ECONOMY_DISCLOSURE;
export const LEDGER_ENTRY_TYPES = economyRuntime.LEDGER_ENTRY_TYPES;

export function createEconomyService(options: {
  clock?: () => number;
  policy?: Partial<PokerEconomyPolicy>;
  repositories: PokerEconomyRepositories;
}): PokerEconomyService {
  return economyRuntime.createEconomyService(options);
}

export function createInMemoryEconomyService(options?: {
  clock?: () => number;
  policy?: Partial<PokerEconomyPolicy>;
}): PokerEconomyService {
  return economyRuntime.createInMemoryEconomyService(options);
}

export type {
  PokerEconomyAccount,
  PokerEconomyComplianceState,
  PokerEconomyGiftEligibility,
  PokerEconomyGiftEligibilityReason,
  PokerEconomyGiftingState,
  PokerEconomyLedgerEntry,
  PokerEconomyLedgerEntryType,
  PokerEconomyPolicy,
  PokerEconomyRepositories,
  PokerEconomyService,
  PokerEconomyState,
  PokerEconomyWeeklyReloadState,
} from '../../types/economy';
