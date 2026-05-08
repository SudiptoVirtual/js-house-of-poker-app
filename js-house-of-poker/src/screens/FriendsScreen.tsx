import { StyleSheet, Text, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

export function FriendsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  function handleInvite(recipientHandle: string) {
    if (!activeTableCode) {
      navigation.navigate(routes.Home);
      return;
    }

    navigation.navigate(routes.Game, {
      invitePreset: buildSocialInvitePreset(recipientHandle, 'Inviting from friends'),
    });
  }

  return (
    <Screen
      eyebrow="Friends"
      title="Your table crew"
      subtitle="Track regulars, see who is ready, and route invites back into the active table rail."
    >
      <SectionCard title="Invite status">
        <Text style={styles.helperText}>
          {activeTableCode
            ? `Invites from this list will open the shared table invite flow for ${activeTableCode}.`
            : 'No active table yet. Start or join a free-play table from the lobby before inviting friends.'}
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? 'Open active table' : 'Open lobby'}
          onPress={() =>
            navigation.navigate(activeTableCode ? routes.Game : routes.Home)
          }
          variant="secondary"
        />
      </SectionCard>

      <SectionCard title="Friend list">
        <View style={styles.friendStack}>
          {socialPlayers.map((player) => (
            <View key={player.id} style={styles.friendCard}>
              <Text style={styles.friendName}>{player.name}</Text>
              <Text style={styles.friendHandle}>{player.handle}</Text>
              <Text style={styles.friendStatus}>{player.statusLabel}</Text>
              <Text style={styles.friendMeta}>{player.mutualTables}</Text>
              <Text style={styles.friendBio}>{player.bio}</Text>
              <Text style={styles.friendSeat}>{player.favoriteSeat}</Text>
              <ActionButton
                compact
                fullWidth
                icon={activeTableCode ? 'account-plus-outline' : 'door-open'}
                label={activeTableCode ? 'Invite to active table' : 'Open lobby to invite'}
                onPress={() => handleInvite(player.handle)}
                tone={activeTableCode ? 'primary' : 'neutral'}
                variant={activeTableCode ? 'primary' : 'secondary'}
              />
            </View>
          ))}
        </View>
      </SectionCard>

      <ComplianceNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  friendBio: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  friendCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  friendHandle: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  friendMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  friendName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  friendSeat: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  friendStack: {
    gap: 12,
  },
  friendStatus: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
});
