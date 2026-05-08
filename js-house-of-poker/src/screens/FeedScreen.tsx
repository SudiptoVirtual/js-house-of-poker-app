import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { buildSocialInvitePreset, socialFeedPosts } from '../constants/social';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

export function FeedScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  function handleInvite(recipientHandle: string) {
    if (!activeTableCode) {
      navigation.navigate(routes.Home);
      return;
    }

    navigation.navigate(routes.Game, {
      invitePreset: buildSocialInvitePreset(recipientHandle, 'Inviting from the feed'),
    });
  }

  return (
    <Screen
      eyebrow="Player feed"
      title="Social posts"
      subtitle="Use public posts as lightweight discovery, then send the actual invite from the shared table flow."
    >
      <SectionCard title="Feed invite status">
        <Text style={styles.helperText}>
          {activeTableCode
            ? `Post-based invites will open the same invite rail for table ${activeTableCode}.`
            : 'Open a free-play table first. Feed actions should point into a live table instead of creating a second invite system.'}
        </Text>
      </SectionCard>

      <SectionCard title="Recent posts">
        <View style={styles.postStack}>
          {socialFeedPosts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postMood}>{post.mood}</Text>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postAuthor}>
                {post.authorName} | {post.authorHandle}
              </Text>
              <Text style={styles.postBody}>{post.body}</Text>
              <ActionButton
                compact
                fullWidth
                icon={activeTableCode ? 'account-plus-outline' : 'door-open'}
                label={activeTableCode ? 'Invite from this post' : 'Open lobby to invite'}
                onPress={() => handleInvite(post.authorHandle)}
                tone={activeTableCode ? 'accent' : 'neutral'}
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
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  postAuthor: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  postBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  postCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  postMood: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  postStack: {
    gap: 12,
  },
  postTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
