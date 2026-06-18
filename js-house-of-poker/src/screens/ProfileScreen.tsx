import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard';
import { routes } from '../constants/routes';
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

export function ProfileScreen({ navigation }: Props) {
  const { currentUser, refreshCurrentUser, signOut } = useAuth();
  const { roomState } = usePoker();
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const activeTableCode = roomState?.roomId ?? null;
  const displayName = currentUser?.name?.trim() || 'Player';
  const handle = buildHandle(currentUser?.email);
  const statusLine = currentUser?.email
    ? `${handle} | ${currentUser.email}`
    : `${handle} | Sign in to sync your profile`;
  const playerStatus = getPokerPlayerStatus(currentUser?.playerStatus);
  const profileStats = [
    { label: 'Friends', value: formatCount(currentUser?.friendCount) },
    { label: 'Posts', value: formatCount(currentUser?.postCount) },
    { label: 'Chips', value: formatCount(currentUser?.chips) },
  ];

  const handleRefreshProfile = useCallback(async () => {
    setIsRefreshingProfile(true);
    setRefreshError(null);

    try {
      await refreshCurrentUser();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Unable to refresh your profile.');
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [refreshCurrentUser]);

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
