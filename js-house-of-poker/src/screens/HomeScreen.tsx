import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { BotTrainingPromoBanner } from '../components/BotTrainingPromoBanner';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthProvider';
import { usePoker } from '../context/PokerProvider';
import { routes } from '../constants/routes';
import { BOT_TRAINING_TABLES } from '../constants/botTrainingTables';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const playerCountOptions = [2, 3, 4, 5, 6, 7];
const gameTypeOptions = ['3-5-7', "Texas Hold'em"] as const;
type GameTypeOption = (typeof gameTypeOptions)[number];
type SocialRouteName = 'Profile' | 'Friends' | 'Feed' | 'PlayerDirectory';
type TrainingActionId = 'quickStart' | 'learn357' | 'inviteFriends' | 'watchDemo';

const TRAINING_DEFAULT_TABLE_ID = BOT_TRAINING_TABLES[0]?.id ?? 'TRN357A';
const TRAINING_357_TABLE_ID =
  BOT_TRAINING_TABLES.find((table) => table.game === '357')?.id ?? TRAINING_DEFAULT_TABLE_ID;

const trainingLobbyActions: Array<{
  actionId: TrainingActionId;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}> = [
  { actionId: 'quickStart', icon: 'flash-outline', label: 'Quick Start' },
  { actionId: 'learn357', icon: 'school-outline', label: 'Learn 3-5-7' },
  { actionId: 'inviteFriends', icon: 'account-multiple-plus-outline', label: 'Invite Friends' },
  { actionId: 'watchDemo', icon: 'play-box-multiple-outline', label: 'Watch Demo Hand' },
];

const socialEntrypoints: Array<{
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: SocialRouteName;
  title: string;
}> = [
  {
    description: 'Tune your player identity and see how the shared invite flow works.',
    icon: 'account-circle-outline',
    route: routes.Profile,
    title: 'Player profile',
  },
  {
    description: 'Track regulars and send friend-based invites into the active table.',
    icon: 'account-multiple-outline',
    route: routes.Friends,
    title: 'Friends',
  },
  {
    description: 'Use posts as invite entry points without creating a second send path.',
    icon: 'post-outline',
    route: routes.Feed,
    title: 'Feed',
  },
  {
    description: 'Search handles and launch username invites through the table invite rail.',
    icon: 'account-search-outline',
    route: routes.PlayerDirectory,
    title: 'Player directory',
  },
];

export function HomeScreen({ navigation }: Props) {
  const { currentUser, refreshCurrentUser, token } = useAuth();
  const {
    connect,
    createRoom,
    errorMessage,
    joinTable,
    roomState,
    transportKind,
  } = usePoker();
  const [playerName, setPlayerName] = useState('Player');
  const [authPlayerName, setAuthPlayerName] = useState<string | null>(null);
  const [hasAuthSession, setHasAuthSession] = useState(false);
  const [playerCount, setPlayerCount] = useState(3);
  const [gameType, setGameType] = useState<GameTypeOption>('3-5-7');
  const [tableCode, setTableCode] = useState('');
  const [joinGuardMessage, setJoinGuardMessage] = useState<string | null>(null);
  const [isRefreshingLobby, setIsRefreshingLobby] = useState(false);
  const [pendingGameLaunch, setPendingGameLaunch] = useState<{
    roomIdBefore: string | null;
  } | null>(null);

  useEffect(() => {
    setHasAuthSession(Boolean(token));

    const maybeName = currentUser?.name?.trim();
    if (maybeName) {
      setAuthPlayerName(maybeName);
      setPlayerName((current) => (current === 'Player' ? maybeName : current));
    }
  }, [currentUser?.name, token]);

  useEffect(() => {
    if (
      pendingGameLaunch &&
      roomState?.roomId &&
      roomState.roomId !== pendingGameLaunch.roomIdBefore
    ) {
      navigation.navigate(routes.Game);
      setPendingGameLaunch(null);
    }
  }, [navigation, pendingGameLaunch, roomState?.roomId]);

  useEffect(() => {
    if (errorMessage && pendingGameLaunch) {
      setPendingGameLaunch(null);
    }
  }, [errorMessage, pendingGameLaunch]);

  const handleRefreshLobby = useCallback(async () => {
    setIsRefreshingLobby(true);

    try {
      await Promise.all([connect(), refreshCurrentUser()]);
    } catch (error) {
      setJoinGuardMessage(error instanceof Error ? error.message : 'Unable to refresh the lobby.');
    } finally {
      setIsRefreshingLobby(false);
    }
  }, [connect, refreshCurrentUser]);

  function handleCreateTable() {
    const trimmedName =
      transportKind === 'socket'
        ? authPlayerName || playerName.trim() || 'Player'
        : playerName.trim() || 'Player';

    setPendingGameLaunch({ roomIdBefore: roomState?.roomId ?? null });
    createRoom({
      gameSettings: {
        game: gameType === '3-5-7' ? '357' : 'holdem',
        ...(gameType === '3-5-7' ? { mode: 'HOSTEST' } : {}),
      },
      name: trimmedName,
      playerCount,
    });
  }

  async function handleJoinTable() {
    if (transportKind === 'socket') {
      if (!token) {
        setPendingGameLaunch(null);
        setHasAuthSession(false);
        setJoinGuardMessage('Please sign in to join a table by code.');
        return;
      }
      setHasAuthSession(true);
    }

    setJoinGuardMessage(null);

    const trimmedName =
      transportKind === 'socket'
        ? authPlayerName || playerName.trim() || 'Player'
        : playerName.trim() || 'Player';

    setPendingGameLaunch({ roomIdBefore: roomState?.roomId ?? null });
    joinTable({ name: trimmedName, tableId: tableCode.trim().toUpperCase() });
  }

  function handleEnterBotTrainingTable(tableId: string) {
    const trimmedName =
      transportKind === 'socket'
        ? authPlayerName || playerName.trim() || 'Player'
        : playerName.trim() || 'Player';
    setPendingGameLaunch({ roomIdBefore: roomState?.roomId ?? null });
    joinTable({ name: trimmedName, tableId });
  }

  const trainingActionHandlers: Record<TrainingActionId, () => void> = {
    inviteFriends: () => {
      navigation.navigate(routes.Friends);
    },
    learn357: () => {
      handleEnterBotTrainingTable(TRAINING_357_TABLE_ID);
    },
    quickStart: () => {
      handleEnterBotTrainingTable(TRAINING_DEFAULT_TABLE_ID);
    },
    watchDemo: () => {
      navigation.navigate(routes.Feed);
    },
  };

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Free-play social poker"
      onRefresh={() => { void handleRefreshLobby(); }}
      refreshing={isRefreshingLobby}
      title="J's House of Poker Lobby"
      subtitle="Create private tables, explore player surfaces, and keep invites flowing through one shared table system."
    >
      {/* <ComplianceNotice /> */}

      <SectionCard title="Play now">
        <Text style={styles.helper}>
          {roomState?.roomId
            ? `Active table ${roomState.roomId} is live. Open it directly or use the social lounge to queue friend and username invites through the same invite rail.`
            : 'Start a free-play table for a quick session, or join an existing table code from a host. Realtime tables require an active signed-in session.'}
        </Text>
        {roomState?.roomId ? (
          <ActionButton
            fullWidth
            icon="cards-playing-outline"
            label="Open active table"
            onPress={() => navigation.navigate(routes.Game)}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Establish Bot Table">
        {/* <BotTrainingPromoBanner
          placement="lobby"
          onPressPrimary={() => trainingActionHandlers.quickStart()}
          onPressSecondary={() => trainingActionHandlers.learn357()}
        /> */}

        <View style={styles.featuredTrainingCard}>
          <View style={styles.featuredTrainingHeader}>
            <Text style={styles.featuredPill}>Training Feature • AI Opponents</Text>
            <Text style={styles.featuredTitle}>LEARN WITH BOT TABLES</Text>
            <Text style={styles.featuredSubtitle}>You can safely learn here before playing real players.</Text>
            <Text style={styles.featuredSafetyCallout}>No real-player pressure • No real clip risk • Instant AI seats</Text>
          </View>
          <View style={styles.featuredActionRow}>
            {trainingLobbyActions.map((action) => (
              <View key={action.actionId} style={styles.featuredActionButton}>
                <ActionButton
                  fullWidth
                  icon={action.icon}
                  label={action.label}
                  onPress={trainingActionHandlers[action.actionId]}
                  variant={action.actionId === 'quickStart' ? 'primary' : 'secondary'}
                />
              </View>
            ))}
          </View>
          <Text style={styles.featuredSupportCopy}>
            Start here to build confidence, learn pacing, and practice decisions before entering competitive tables.
          </Text>
        </View>

        {/* {BOT_TRAINING_TABLES.map((table) => (
          <View
            key={table.id}
            style={styles.trainingCard}
          >
            <View style={styles.trainingHeaderRow}>
              <Text style={styles.trainingTitle}>{table.label}</Text>
              <View style={styles.trainingBadgeCluster}>
                <Text style={styles.trainingBadge}>
                  {table.difficulty}
                </Text>
                <Text style={styles.trainingModeBadge}>{table.modeLabel}</Text>
              </View>
            </View>
            <Text style={styles.trainingDescription}>{table.description}</Text>
            <Text style={styles.trainingEducation}>{table.educationalCopy}</Text>
            <Text style={styles.trainingModeSummary}>{table.modeSummary}</Text>
            <Text style={styles.helper}>
              Practice-only table • {table.seatCount} total seats • Bot-focused learning flow • Simulated clips only
            </Text>
            <View style={styles.buttonRow}>
              <ActionButton
                icon="robot-outline"
                label="Enter bot training"
                onPress={() => handleEnterBotTrainingTable(table.id)}
                variant="secondary"
              />
            </View>
          </View>
        ))} */}
      </SectionCard>

      <SectionCard title="Create a table">
        <Text style={styles.label}>Player name</Text>
        <TextInput
          autoCapitalize="words"
          autoCorrect={false}
          onChangeText={setPlayerName}
          placeholder="Enter your player name"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          value={playerName}
        />

        <Text style={styles.label}>Total players</Text>
        <View style={styles.optionRow}>
          {playerCountOptions.map((option) => {
            const selected = option === playerCount;

            return (
              <Pressable
                key={option}
                onPress={() => setPlayerCount(option)}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helper}>
          Includes you. Remaining seats use bots for the quick table, up to seven total players.
        </Text>

        {/* <Text style={styles.label}>Game type</Text>
        <View style={styles.optionRow}>
          {gameTypeOptions.map((option) => {
            const selected = option === gameType;

            return (
              <Pressable
                key={option}
                onPress={() => setGameType(option)}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View> */}

        <View style={styles.buttonRow}>
          <ActionButton
            label="Create table"
            onPress={handleCreateTable}
          />
        </View>
      </SectionCard>

      <SectionCard title="Join a table">
        <Text style={styles.label}>Table code</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={(value) => setTableCode(value.toUpperCase())}
          placeholder="Enter the table code"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          value={tableCode}
        />
        <Text style={styles.helper}>
          Table-code join requires sign-in so invites, gifts, and seats stay attached to your player identity in one shared table state.
        </Text>
        {!hasAuthSession ? (
          <Text style={styles.joinRequirement}>Sign in is required before joining by table code.</Text>
        ) : null}
        {joinGuardMessage ? <Text style={styles.error}>{joinGuardMessage}</Text> : null}
        <View style={styles.buttonRow}>
          <ActionButton
            label="Join table"
            onPress={handleJoinTable}
            variant="secondary"
          />
        </View>
      </SectionCard>

      <SectionCard title="Social lounge">
        <View style={styles.socialStack}>
          {socialEntrypoints.map((entry) => (
            <Pressable
              key={entry.title}
              onPress={() => navigation.navigate(entry.route)}
              style={styles.socialCard}
            >
              <View style={styles.socialIconFrame}>
                <MaterialCommunityIcons color={colors.secondary} name={entry.icon} size={20} />
              </View>
              <View style={styles.socialCopy}>
                <Text style={styles.socialTitle}>{entry.title}</Text>
                <Text style={styles.socialDescription}>{entry.description}</Text>
              </View>
              <MaterialCommunityIcons
                color={colors.mutedText}
                name="chevron-right"
                size={22}
              />
            </Pressable>
          ))}
        </View>
      </SectionCard>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    gap: 10,
  },
  joinRequirement: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  featuredActionButton: {
    minWidth: 0,
    width: '100%',
  },
  featuredActionRow: {
    gap: 10,
  },
  featuredPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(54, 231, 255, 0.18)',
    borderRadius: 999,
    color: '#BFFAFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  featuredSubtitle: {
    color: '#D2E4FF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  featuredSafetyCallout: {
    color: '#B9D7FF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  featuredSupportCopy: {
    color: '#C5D3EA',
    fontSize: 13,
    lineHeight: 20,
  },
  featuredTitle: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  featuredTrainingCard: {
    backgroundColor: '#101A36',
    borderColor: '#3A5FA8',
    borderRadius: 22,
    borderWidth: 1,
    gap: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  featuredTrainingHeader: {
    gap: 8,
  },
  helper: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  line: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  optionChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionChipSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: colors.white,
  },
  socialCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  socialCopy: {
    flex: 1,
    gap: 4,
  },
  socialDescription: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  socialIconFrame: {
    alignItems: 'center',
    backgroundColor: 'rgba(54, 231, 255, 0.08)',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  socialStack: {
    gap: 10,
  },
  socialTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  trainingBadge: {
    backgroundColor: 'rgba(54, 231, 255, 0.15)',
    borderRadius: 999,
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  trainingCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  trainingDescription: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  trainingEducation: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  trainingHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  trainingBadgeCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  trainingModeBadge: {
    backgroundColor: '#1D4ED8',
    borderRadius: 999,
    color: '#E0EAFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: 'uppercase',
  },
  trainingModeSummary: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  trainingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
