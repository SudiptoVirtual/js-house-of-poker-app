import { apiRequest } from './client';

export type GameplayStats = {
  gamesPlayed: number;
  handsPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalWinnings: number;
  biggestPotWon: number;
};

export type UserGameHistoryRecord = {
  id: string;
  tableId: string;
  tableCode: string;
  tableName: string;
  handNumber: number;
  gameType: string;
  completedAt: string | null;
  totalPot: number;
  result: string;
  chipsDelta: number;
  chipsWon: number;
  handDescription: string;
  winnerText: string;
};

export type AuthUser = {
  avatar?: string;
  chips: number;
  email: string;
  friendCount?: number;
  id: string;
  isOnline?: boolean;
  lastLoginAt?: string | null;
  name: string;
  phone: string;
  playerStatus?: string;
  postCount?: number;
  referralCode?: string | null;
  status: string;
  statusIcon?: string;
  walletBalance: number;
  gameplayStats?: GameplayStats;
  recentHands?: UserGameHistoryRecord[];
  gameHistory?: UserGameHistoryRecord[];
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

type LoginUserInput = {
  email: string;
  password: string;
};

type RegisterUserInput = {
  email: string;
  name: string;
  password: string;
  phone: string;
};

export async function loginUser({ email, password }: LoginUserInput) {
  return apiRequest<AuthResponse>('/api/auth/login', {
    body: {
      email: email.trim(),
      password,
    },
    method: 'POST',
  });
}

export async function registerUser({ email, name, password, phone }: RegisterUserInput) {
  return apiRequest<AuthResponse>('/api/auth/register', {
    body: {
      email: email.trim(),
      name: name.trim(),
      password,
      phone: phone.trim(),
    },
    method: 'POST',
  });
}

export async function authenticateWithGoogle(idToken: string) {
  return apiRequest<AuthResponse>('/api/auth/google', {
    body: { idToken },
    method: 'POST',
  });
}

export async function fetchCurrentUser(token: string) {
  const response = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
    token,
  });

  return response.user;
}

export async function logoutUser(token: string) {
  return apiRequest<{ message: string }>('/api/auth/logout', {
    method: 'POST',
    token,
  });
}


type BackendHandPlayer = {
  userId?: string | { _id?: string; id?: string };
  result?: string;
  chipsDelta?: number;
  chipsWon?: number;
  handDescription?: string;
};

type BackendHandHistory = {
  _id?: string;
  id?: string;
  tableId?: { _id?: string; id?: string; tableCode?: string; tableName?: string; gameType?: string } | string | null;
  tableCode?: string;
  tableName?: string;
  handNumber?: number;
  gameType?: string;
  players?: BackendHandPlayer[];
  totalPot?: number;
  pot?: number;
  result?: string;
  chipsDelta?: number;
  chipsWon?: number;
  handDescription?: string;
  winnerText?: string;
  completedAt?: string | null;
  createdAt?: string | null;
};

function getBackendUserId(userId: BackendHandPlayer['userId']) {
  if (!userId) {
    return null;
  }

  if (typeof userId === 'string') {
    return userId;
  }

  return userId.id ?? userId._id ?? null;
}

function toUserGameHistoryRecord(hand: BackendHandHistory, currentUserId?: string): UserGameHistoryRecord {
  const table = typeof hand.tableId === 'object' && hand.tableId ? hand.tableId : null;
  const player = hand.players?.find((item) => getBackendUserId(item.userId) === currentUserId) ?? hand.players?.[0];
  const chipsDelta = player?.chipsDelta ?? hand.chipsDelta ?? player?.chipsWon ?? hand.chipsWon ?? 0;
  const chipsWon = player?.chipsWon ?? hand.chipsWon ?? Math.max(chipsDelta, 0);

  return {
    id: hand.id ?? hand._id ?? `${hand.tableCode ?? table?.tableCode ?? 'table'}-${hand.handNumber ?? 0}`,
    tableId: typeof hand.tableId === 'string' ? hand.tableId : hand.tableId?._id ?? hand.tableId?.id ?? '',
    tableCode: hand.tableCode ?? table?.tableCode ?? 'Unknown',
    tableName: hand.tableName ?? table?.tableName ?? 'Poker table',
    handNumber: hand.handNumber ?? 0,
    gameType: hand.gameType ?? table?.gameType ?? 'Poker',
    completedAt: hand.completedAt ?? hand.createdAt ?? null,
    totalPot: hand.totalPot ?? hand.pot ?? 0,
    result: player?.result || hand.result || (chipsDelta > 0 ? 'Won' : chipsDelta < 0 ? 'Lost' : 'Even'),
    chipsDelta,
    chipsWon,
    handDescription: player?.handDescription ?? hand.handDescription ?? '',
    winnerText: hand.winnerText ?? '',
  };
}

export async function fetchCurrentUserProfile(token: string) {
  const response = await apiRequest<{ user: AuthUser }>('/api/users/me', {
    token,
  });

  return response.user;
}

export async function fetchCurrentUserGameHistory(token: string, limit = 20, currentUserId?: string) {
  const normalizedLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 20));
  const response = await apiRequest<{ records?: BackendHandHistory[]; hands?: BackendHandHistory[]; gameHistory?: BackendHandHistory[] }>(
    `/api/users/me/game-history?limit=${encodeURIComponent(String(normalizedLimit))}`,
    { token },
  );
  const hands = response.records ?? response.hands ?? response.gameHistory ?? [];

  return hands.map((hand) => toUserGameHistoryRecord(hand, currentUserId));
}
