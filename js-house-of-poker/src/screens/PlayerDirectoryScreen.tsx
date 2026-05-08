import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { buildSocialInvitePreset, socialPlayers } from '../constants/social';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PlayerDirectory'>;

export function PlayerDirectoryScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const [query, setQuery] = useState('');
  const activeTableCode = roomState?.roomId ?? null;

  const filteredPlayers = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return socialPlayers;
    }

    return socialPlayers.filter((player) =>
      [player.name, player.handle, player.bio].some((value) =>
        value.toLowerCase().includes(trimmedQuery),
      ),
    );
  }, [query]);

  function handleInvite(recipientHandle: string) {
    if (!activeTableCode) {
      navigation.navigate(routes.Home);
      return;
    }

    navigation.navigate(routes.Game, {
      invitePreset: buildSocialInvitePreset(recipientHandle, 'Inviting by username'),
    });
  }

  return (
    <Screen
      eyebrow="Player directory"
      title="Find players by username"
      subtitle="Search handles, review social context, and hand the actual invite off to the shared table invite rail."
    >
      <SectionCard title="Search usernames">
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search @username or player name"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          value={query}
        />
        <Text style={styles.helperText}>
          {activeTableCode
            ? `Directory invites will open the shared flow for table ${activeTableCode}.`
            : 'Open a free-play table first so username invites can route into a live seat flow.'}
        </Text>
      </SectionCard>

      <SectionCard title="Results">
        <View style={styles.resultStack}>
          {filteredPlayers.map((player) => (
            <View key={player.id} style={styles.resultCard}>
              <Text style={styles.resultName}>{player.name}</Text>
              <Text style={styles.resultHandle}>{player.handle}</Text>
              <Text style={styles.resultStatus}>{player.statusLabel}</Text>
              <Text style={styles.resultMeta}>{player.mutualTables}</Text>
              <Text style={styles.resultBio}>{player.bio}</Text>
              <ActionButton
                compact
                fullWidth
                icon={activeTableCode ? 'magnify-plus-outline' : 'door-open'}
                label={activeTableCode ? 'Invite by username' : 'Open lobby to invite'}
                onPress={() => handleInvite(player.handle)}
                tone={activeTableCode ? 'success' : 'neutral'}
                variant={activeTableCode ? 'primary' : 'secondary'}
              />
            </View>
          ))}
          {filteredPlayers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No players match that username yet.</Text>
            </View>
          ) : null}
        </View>
      </SectionCard>

      <ComplianceNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultBio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  resultCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  resultHandle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  resultMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resultName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  resultStack: {
    gap: 12,
  },
  resultStatus: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
});
