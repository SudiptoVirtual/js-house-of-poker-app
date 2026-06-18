import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard';
import { getActivityBadge, getRelationshipBadge } from '../components/player/PlayerMetaBadge';
import { routes } from '../constants/routes';
import { useAuth } from '../context/AuthProvider';
import { createOrGetDirectChatRoom } from '../services/api/chatRooms';
import {
  fetchPublicUserProfile,
  getApiErrorDetails,
  removeFriend,
  type PublicUserProfile,
} from '../services/api';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

const statusLabels: Record<PublicUserProfile['activityStatus'], string> = {
  at_table: 'At a table',
  in_chat_room: 'In a chat room',
  in_lobby: 'In the lobby',
  offline: 'Offline',
  online: 'Online',
  playing_357: 'Playing 3-5-7 Poker',
};

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function formatCount(value: number | undefined) {
  return value == null ? 'Coming soon' : value.toLocaleString('en-US');
}

function formatPercent(value: number | undefined) {
  return value == null ? 'Coming soon' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

export function UserProfileScreen({ navigation, route }: Props) {
  const { token } = useAuth();
  const { userId } = route.params;
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);

  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfile(null);
      setFeedbackMessage('Sign in to view player profiles.');
      return;
    }

    setIsRefreshingProfile(true);

    try {
      const loadedProfile = await fetchPublicUserProfile(userId, token);
      setProfile(loadedProfile);
      setFeedbackMessage(null);
    } catch (error) {
      const { message } = getApiErrorDetails(error, 'Unable to load this player profile.');
      setFeedbackMessage(message);
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleStartDirectChat() {
    if (!token || !profile) {
      setFeedbackMessage('Sign in to start a direct chat.');
      return;
    }

    try {
      const room = await createOrGetDirectChatRoom(profile.id, token);
      navigation.navigate(routes.ChatRoomDetail, { roomId: room.id });
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to start a chat with ${profile.displayName}.`);
      setFeedbackMessage(message);
    }
  }

  async function handleInviteToChatRoom() {
    if (!token || !profile) {
      setFeedbackMessage('Sign in to send chat invites.');
      return;
    }

    try {
      const room = await createOrGetDirectChatRoom(profile.id, token);
      navigation.navigate(routes.ChatRoomDetail, { roomId: room.id });
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to open a chat with ${profile.displayName}.`);
      setFeedbackMessage(message);
    }
  }

  async function handleRemoveFriend() {
    if (!token || !profile) {
      setFeedbackMessage('Sign in to remove friends.');
      return;
    }

    setIsRemovingFriend(true);

    try {
      await removeFriend(profile.id, token);
      setFeedbackMessage(`${profile.displayName} removed from your friends.`);
      setProfile({ ...profile, relationshipStatus: 'not_friends' });
    } catch (error) {
      const { message } = getApiErrorDetails(error, `Unable to remove ${profile.displayName} from your friends.`);
      setFeedbackMessage(message);
    } finally {
      setIsRemovingFriend(false);
    }
  }

  const displayName = profile?.displayName ?? 'Player profile';
  const handle = profile ? `@${profile.username}` : 'Loading public player details';
  const status = profile ? statusLabels[profile.activityStatus] : 'Loading status';

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Player profile"
      onRefresh={() => { void loadProfile(); }}
      refreshing={isRefreshingProfile}
      title={displayName}
      subtitle={`${handle} | ${status}`}
    >
      {feedbackMessage ? <Text style={styles.feedbackText}>{feedbackMessage}</Text> : null}

      <SectionCard title="Public details">
        {profile ? (
          <PlayerIdentityCard
            avatar={profile.avatar}
            badges={[getActivityBadge(profile.activityStatus), getRelationshipBadge(profile.relationshipStatus)]}
            connected={profile.isOnline}
            displayName={displayName}
            meta={status}
            seed={profile.id}
            size="lg"
            stats={[
              { label: 'Games', value: formatCount(profile.gamesPlayed) },
              { label: 'Hands', value: formatCount(profile.handsPlayed) },
              { label: 'Win rate', value: formatPercent(profile.winRate) },
            ]}
            username={handle}
          />
        ) : (
          <Text style={styles.metaLine}>Loading public player details…</Text>
        )}
      </SectionCard>

      <SectionCard title="Gameplay stats">
        <Text style={styles.metaLine}>Total winnings: {formatCount(profile?.totalWinnings)}</Text>
      </SectionCard>

      <SectionCard title="Actions">
        <View style={styles.actionStack}>
          <ActionButton fullWidth icon="message-text-outline" label="One-to-one chat" onPress={() => { void handleStartDirectChat(); }} />
          <ActionButton fullWidth icon="chat-plus-outline" label="Open chat" onPress={() => { void handleInviteToChatRoom(); }} variant="secondary" />
          <ActionButton fullWidth icon="account-remove-outline" label="Remove friend" loading={isRemovingFriend} onPress={() => { void handleRemoveFriend(); }} tone="danger" />
        </View>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionStack: { gap: 10 },
  feedbackText: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
  metaLine: { color: colors.text, fontSize: 15, lineHeight: 22 },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statLabel: { color: colors.mutedText, fontSize: 12, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
