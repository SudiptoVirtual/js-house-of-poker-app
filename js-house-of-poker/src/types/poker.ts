import type { PokerEconomyState } from './economy';

export type PokerPhase =
  | 'waiting'
  | 'deal_3'
  | 'decide_3'
  | 'deal_5'
  | 'decide_5'
  | 'deal_7'
  | 'decide_7'
  | 'reveal'
  | 'resolve'
  | 'reshuffle'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'completed';

export type PokerAction =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all-in'
  | 'go'
  | 'stay';

export type PokerActionKind =
  | PokerAction
  | 'blind'
  | 'join'
  | 'leave'
  | 'rebuy'
  | 'start'
  | 'system'
  | 'win';

export type PokerCardVisibility = 'face-down' | 'face-up';

export type PokerGame = '357' | 'shanghai' | 'in-between-the-sheets' | '7-27' | 'holdem';

export type Poker357Mode = 'HOSTEST' | 'BEST_FIVE';

export type PokerGameMode =
  | 'high-only'
  | 'high-low'
  | 'low-only'
  | Poker357Mode;

export type PokerLowRule = '8-or-better' | 'wheel' | 'any-low';

export type PokerPlayerStatus =
  | 'NO_STATUS'
  | 'LOW_ROLLER'
  | 'MID_ROLLER'
  | 'UP_AND_COMING'
  | 'HIGH_ROLLER'
  | 'SHARK';

export type PlayerStatusTier =
  | 'none'
  | 'low_roller'
  | 'mid_roller'
  | 'up_and_coming'
  | 'high_roller'
  | 'shark';

export type PokerTableChatTone = 'player' | 'system';

export type PokerTableChatModerationStatus =
  | 'accepted'
  | 'blocked'
  | 'pending-review';

export type PokerTableChatModerationState = {
  flags: string[];
  reason: string | null;
  reviewedAt: number | null;
  status: PokerTableChatModerationStatus;
};

export type PokerTableChatMessage = {
  createdAt: number;
  id: string;
  moderation: PokerTableChatModerationState;
  playerId: string | null;
  playerName: string;
  text: string;
  tone: PokerTableChatTone;
};

export type PokerInviteSource = 'share-link' | 'friend-list' | 'seat-pass';

export type PokerInviteRecipient = {
  accountId: string;
  description: string;
  handle: string;
  id: string;
  isInvited: boolean;
  label: string;
  lastInvitedAt: number | null;
  source: PokerInviteSource;
};

export type PokerTableInvite = {
  createdAt: number;
  giftBuyInChips: number;
  giftBuyInClips: number;
  id: string;
  message: string | null;
  recipientAccountId: string;
  recipientHandle: string;
  recipientLabel: string;
  senderPlayerId: string;
  senderPlayerName: string;
  source: PokerInviteSource;
  status: 'pending';
};

export type PokerGameStips = {
  bestFiveCards: boolean;
  hostestWithTheMostest: boolean;
  suitedBeatsUnsuited: boolean;
  wildCards: boolean;
};

export type PokerGameSettings = {
  game: PokerGame;
  locked: boolean;
  lowRule: PokerLowRule;
  mode: PokerGameMode;
  stips: PokerGameStips;
  wildCards: string[];
};

export type Poker357Decision = 'GO' | 'STAY';

export type Poker357Resolution = {
  goPlayerIds: string[];
  handNumber: number;
  legDeltaByPlayerId: Record<string, number>;
  loserIds: string[];
  outcome: 'no_go' | 'solo_go' | 'showdown' | 'showdown_tie';
  payoutByPlayerId: Record<string, number>;
  potAfterResolution: number;
  potAwarded: number;
  potBeforeResolution: number;
  potPenaltyTotal: number;
  revealedDecisions: Record<string, Poker357Decision>;
  showdownDescriptions: Record<string, string>;
  splitWinnerPayout: boolean;
  winnerIds: string[];
  winnerPenaltyTotal: number;
};

export type Poker357State = {
  activeRound: 3 | 5 | 7 | null;
  activeWildDefinition: {
    cumulative: boolean;
    label: string;
    mode: Poker357Mode;
    round: 3 | 5 | 7 | null;
    wildRanks: string[];
  };
  anteAmount: number;
  hiddenDecisionState: {
    currentRound: 3 | 5 | 7 | null;
    historyByPlayerId: Record<string, Partial<Record<3 | 5 | 7, Poker357Decision | null>>>;
    revealedByPlayerId: Record<string, Poker357Decision>;
  };
  lastPhaseSequence: string[];
  lastResolution: Poker357Resolution | null;
  legsByPlayerId: Record<string, number>;
  mode: Poker357Mode;
  penaltyModel: {
    legsToWin: number;
    soloGoLegAward: number;
    unitToPot: number;
    unitToWinner: number;
  };
  pot: number;
  revealState: 'hidden' | 'revealed' | 'resolved';
  showdownPlayerIds: string[];
};

export type PokerGameSettingsUpdate = Partial<
  Pick<PokerGameSettings, 'game' | 'lowRule' | 'mode' | 'wildCards'>
> & {
  stips?: Partial<PokerGameStips>;
};

export type PokerCardState = {
  code: string;
  ownerId: string | null;
  order: number;
  visibility: PokerCardVisibility;
};

export type PokerActionHistoryEntry = {
  action: PokerActionKind;
  amount: number | null;
  createdAt: number;
  id: string;
  message: string;
  playerId: string | null;
  playerName: string | null;
};

export type PokerSeatState = {
  isBigBlind: boolean;
  isDealer: boolean;
  isOccupied: boolean;
  isSmallBlind: boolean;
  playerId: string | null;
  seatIndex: number;
};

export type PokerPlayerStatusSnapshot = {
  invitePriority: number;
  lastUpdatedAt: number | null;
  recentHands: number;
  recentScore: number;
  reputation: number;
  sharkWins: number;
  strongTableWins: number;
  windowSize: number;
};

export type PokerPlayerState = {
  betThisRound: number;
  cardCount: number;
  cards: PokerCardState[];
  chips: number;
  handDescription: string | null;
  hasFolded: boolean;
  hasHiddenCards: boolean;
  holeCards: string[];
  id: string;
  isAllIn: boolean;
  isBigBlind: boolean;
  isConnected: boolean;
  isDealer: boolean;
  isHost: boolean;
  isSmallBlind: boolean;
  isTurn: boolean;
  lastAction: PokerActionHistoryEntry | null;
  legs: number;
  name: string;
  playerStatus: PokerPlayerStatus;
  statusTier: PlayerStatusTier;
  statusScore: number;
  statusMomentum: number;
  netChipBalance: number;
  statusUpdatedAt: number | string | null;
  revealedDecision: Poker357Decision | null;
  seatIndex: number | null;
  statusSnapshot: PokerPlayerStatusSnapshot;
  totalContribution: number;
};

export type PokerControls = {
  availableActions: PokerAction[];
  canAct: boolean;
  canRebuy: boolean;
  canStartHand: boolean;
  callAmount: number;
  maxRaiseTo: number;
  minRaiseTo: number;
};

export type PokerRoomState = {
  actionHistory: PokerActionHistoryEntry[];
  actionLog: string[];
  bigBlind: number;
  bigBlindPosition: number | null;
  chatMessages: PokerTableChatMessage[];
  communityCardStates: PokerCardState[];
  communityCards: string[];
  controls: PokerControls;
  currentBet: number;
  currentTurnPlayerId: string | null;
  currentTurnSeat: number | null;
  dealerPosition: number | null;
  economy: PokerEconomyState | null;
  gameSettings: PokerGameSettings;
  handNumber: number;
  hostId: string | null;
  inviteRecipients: PokerInviteRecipient[];
  lastWinnerSummary: string | null;
  maxSeats: number;
  minPlayersToStart: number;
  phase: PokerPhase;
  players: PokerPlayerState[];
  pot: number;
  roomId: string | null;
  seats: PokerSeatState[];
  selfId: string | null;
  smallBlind: number;
  smallBlindPosition: number | null;
  statusMessage: string;
  tableId: string | null;
  tableInvites: PokerTableInvite[];
  tableName: string;
  threeFiveSeven: Poker357State | null;
  updatedAt: number;
};
