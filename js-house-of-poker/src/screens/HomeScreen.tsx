import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { usePoker } from '../context/PokerProvider';
import { routes } from '../constants/routes';
import { getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const botOptions = [1, 2, 3, 4, 5];
type SocialRouteName = 'Profile' | 'Friends' | 'Feed' | 'PlayerDirectory';

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
  const {
    createRoom,
    errorMessage,
    joinTable,
    roomState,
    transportKind,
  } = usePoker();
  const [playerName, setPlayerName] = useState('Player');
  const [authPlayerName, setAuthPlayerName] = useState<string | null>(null);
  const [botCount, setBotCount] = useState(3);
  const [tableCode, setTableCode] = useState('');
  const [pendingGameLaunch, setPendingGameLaunch] = useState<{
    roomIdBefore: string | null;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getAuthSession()
      .then((session) => {
        if (!isMounted || !session?.user || typeof session.user !== 'object') {
          return;
        }

        const maybeName = (session.user as { name?: unknown }).name;
        if (typeof maybeName === 'string' && maybeName.trim()) {
          setAuthPlayerName(maybeName.trim());
          setPlayerName((current) => (current === 'Player' ? maybeName.trim() : current));
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

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

  function handleCreateTable() {
    const trimmedName =
      transportKind === 'socket'
        ? authPlayerName || playerName.trim() || 'Player'
        : playerName.trim() || 'Player';

    setPendingGameLaunch({ roomIdBefore: roomState?.roomId ?? null });
    createRoom({
      botCount,
      gameSettings: {
        game: '357',
        mode: 'HOSTEST',
      },
      name: trimmedName,
    });
  }

  function handleJoinTable() {
    const trimmedName =
      transportKind === 'socket'
        ? authPlayerName || playerName.trim() || 'Player'
        : playerName.trim() || 'Player';

    setPendingGameLaunch({ roomIdBefore: roomState?.roomId ?? null });
    joinTable({ name: trimmedName, tableId: tableCode.trim().toUpperCase() });
  }

  return (
    <Screen
      eyebrow="Free-play social poker"
      title="House of Poker Lobby"
      subtitle="Create private tables, explore player surfaces, and keep invites flowing through one shared table system."
    >
      <ComplianceNotice />

      <SectionCard title="Play now">
        <Text style={styles.helper}>
          {roomState?.roomId
            ? `Active table ${roomState.roomId} is live. Open it directly or use the social lounge to queue friend and username invites through the same invite rail.`
            : 'Start a free-play table for a quick session, or join an existing table code from a host.'}
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

        <Text style={styles.label}>Bot opponents</Text>
        <View style={styles.optionRow}>
          {botOptions.map((option) => {
            const selected = option === botCount;

            return (
              <Pressable
                key={option}
                onPress={() => setBotCount(option)}
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
          Create a private free-play table with bots, then use the social surfaces to bring more players into the same invite flow.
        </Text>

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
          Table codes take you into an existing free-play room so invites, gifts, and seats stay attached to one shared table state.
        </Text>
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
});
