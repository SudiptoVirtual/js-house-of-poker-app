import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard';
import { routes } from '../constants/routes';
import {
  fetchCurrentUserGameHistory,
  fetchCurrentUserProfile,
  type GameplayStats,
  type UserGameHistoryRecord,
} from '../services/api/auth';
import { useAuth } from '../context/AuthProvider';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';
import type { PokerPlayerStatus } from '../types/poker';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

function buildHandle(email: string | undefined) {
  const localPart = email?.split('@')[0]?.trim();

  if (!localPart) {
    return '@player';
  }

  return `@${localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`;
}

const PLAYER_STATUS_VALUES = new Set<string>(['NO_STATUS', 'LOW_ROLLER', 'MID_ROLLER', 'UP_AND_COMING', 'HIGH_ROLLER', 'SHARK']);

function getPokerPlayerStatus(status: string | undefined): PokerPlayerStatus | undefined {
  return status && PLAYER_STATUS_VALUES.has(status) ? (status as PokerPlayerStatus) : undefined;
}

function formatCurrency(value: number | undefined) {
  return `$${(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('en-US');
}

function formatPercent(value: number | undefined) {
  return `${(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

function formatSignedCount(value: number | undefined) {
  const normalizedValue = value ?? 0;
  const prefix = normalizedValue > 0 ? '+' : '';

  return `${prefix}${normalizedValue.toLocaleString('en-US')}`;
}

function formatCompletedDate(value: string | null | undefined) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const EMPTY_GAMEPLAY_STATS: GameplayStats = {
  gamesPlayed: 0,
  handsPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  totalWinnings: 0,
  biggestPotWon: 0,
};

export function ProfileScreen({ navigation }: Props) {
  const { currentUser, refreshCurrentUser, signOut, token } = useAuth();
  const { roomState } = usePoker();
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [profile, setProfile] = useState(currentUser);
  const [gameHistory, setGameHistory] = useState<UserGameHistoryRecord[]>([]);
  const activeTableCode = roomState?.roomId ?? null;
  const displayName = currentUser?.name?.trim() || 'Player';
  const handle = buildHandle(currentUser?.email);
  const statusLine = currentUser?.email
    ? `${handle} | ${currentUser.email}`
    : `${handle} | Sign in to sync your profile`;
  const playerStatus = getPokerPlayerStatus(currentUser?.playerStatus);
  const activeProfile = profile ?? currentUser;
  const gameplayStats = activeProfile?.gameplayStats ?? EMPTY_GAMEPLAY_STATS;
  const profileStats = [
    { label: 'Games', value: formatCount(gameplayStats.gamesPlayed) },
    { label: 'Hands', value: formatCount(gameplayStats.handsPlayed) },
    { label: 'Win rate', value: formatPercent(gameplayStats.winRate) },
  ];


  const loadProfileData = useCallback(async () => {
    if (!token) {
      setProfile(currentUser);
      setGameHistory([]);
      return;
    }

    const freshProfile = await fetchCurrentUserProfile(token);
    const freshHistory = await fetchCurrentUserGameHistory(token, 10, freshProfile.id ?? currentUser?.id);

    setProfile(freshProfile);
    setGameHistory(freshHistory);
  }, [currentUser, token]);

  useEffect(() => {
    void loadProfileData().catch((error) => {
      setRefreshError(error instanceof Error ? error.message : 'Unable to load your gameplay profile.');
    });
  }, [loadProfileData]);

  const gameplayStatCards = useMemo(
    () => [
      { label: 'Wins', value: formatCount(gameplayStats.wins) },
      { label: 'Losses', value: formatCount(gameplayStats.losses) },
      { label: 'Total winnings', value: formatSignedCount(gameplayStats.totalWinnings) },
      { label: 'Biggest pot won', value: formatCount(gameplayStats.biggestPotWon) },
    ],
    [gameplayStats],
  );

  const handleRefreshProfile = useCallback(async () => {
    setIsRefreshingProfile(true);
    setRefreshError(null);

    try {
      await refreshCurrentUser();
      await loadProfileData();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Unable to refresh your profile.');
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [loadProfileData, refreshCurrentUser]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: routes.Login }],
      });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to log out right now.');
    } finally {
      setIsSigningOut(false);
    }
  }, [navigation, signOut]);

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Player profile"
      onRefresh={() => { void handleRefreshProfile(); }}
      refreshing={isRefreshingProfile}
      title={displayName}
      subtitle={statusLine}
    >
      {refreshError ? <Text style={styles.errorText}>{refreshError}</Text> : null}
      <SectionCard title="Player card">
        <PlayerIdentityCard
          badges={[{ label: currentUser?.status ?? 'Unknown', tone: currentUser?.status === 'online' ? 'success' : 'muted' }]}
          chipsLabel={`Chips: ${formatCount(currentUser?.chips)}`}
          connected={currentUser?.status === 'online'}
          displayName={displayName}
          meta={`Wallet / bankroll: ${formatCurrency(currentUser?.walletBalance)}`}
          seed={currentUser?.id ?? currentUser?.email ?? displayName}
          size="lg"
          stats={profileStats}
          status={playerStatus}
          username={handle}
        />
        <Text style={styles.metaLine}>Player tier: {currentUser?.playerStatus ?? 'NO_STATUS'}</Text>
        {currentUser?.referralCode ? (
          <Text style={styles.metaLine}>Referral code: {currentUser.referralCode}</Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Gameplay stats">
        <View style={styles.statRow}>
          {gameplayStatCards.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Recent gameplay">
        <View style={styles.historyStack}>
          {gameHistory.length > 0 ? (
            gameHistory.map((hand) => (
              <View key={hand.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>{hand.tableName || hand.tableCode}</Text>
                  <Text style={[styles.deltaText, hand.chipsDelta >= 0 ? styles.positiveDelta : styles.negativeDelta]}>
                    {formatSignedCount(hand.chipsDelta)} chips
                  </Text>
                </View>
                <Text style={styles.metaLine}>
                  {hand.tableCode} · Hand #{hand.handNumber} · {hand.gameType}
                </Text>
                <Text style={styles.metaLine}>
                  {hand.result} · Pot {formatCount(hand.pot)} · {formatCompletedDate(hand.completedAt)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>No completed hands yet. Play a hand to see your latest results here.</Text>
          )}
        </View>
      </SectionCard>

      <SectionCard title="Shared invite flow">
        <Text style={styles.bodyText}>
          {activeTableCode
            ? `Your active table is ${activeTableCode}. Friend, feed, and username invites route back through the same in-table invite rail.`
            : 'Create or join a table first, then send invites from friends, posts, or the player directory through the shared table invite flow.'}
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? 'Open active table' : 'Open lobby'}
          onPress={() =>
            navigation.navigate(activeTableCode ? routes.Game : routes.Home)
          }
          tone="primary"
        />
      </SectionCard>

      <SectionCard title="Social routes">
        <View style={styles.actionStack}>
          <ActionButton
            fullWidth
            icon="account-multiple-outline"
            label="Friends"
            onPress={() => navigation.navigate(routes.Friends)}
            variant="secondary"
          />
          <ActionButton
            fullWidth
            icon="post-outline"
            label="Feed"
            onPress={() => navigation.navigate(routes.Feed)}
            variant="secondary"
          />
          <ActionButton
            fullWidth
            icon="account-search-outline"
            label="Player directory"
            onPress={() => navigation.navigate(routes.PlayerDirectory)}
            variant="secondary"
          />
        </View>
      </SectionCard>

      <SectionCard title="">
        {signOutError ? <Text style={styles.errorText}>{signOutError}</Text> : null}
        <ActionButton
          fullWidth
          icon="logout"
          label="Log out"
          loading={isSigningOut}
          onPress={() => { void handleSignOut(); }}
          tone="danger"
        />
      </SectionCard>

      {/* <ComplianceNotice /> */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: 10,
  },
  bodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  historyItem: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  historyStack: {
    gap: 10,
  },
  historyTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  negativeDelta: {
    color: colors.danger,
  },
  positiveDelta: {
    color: colors.success,
  },
  metaLine: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  statCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
