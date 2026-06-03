import { useMemo, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainPlatformNavigation } from '../navigation/MainPlatformNavigation';
import { currentFeedPlayer, mockFeedPosts } from '../../constants/playerFeedMockData';
import { routes } from '../../constants/routes';
import { buildSocialInvitePreset } from '../../constants/social';
import { usePoker } from '../../context/PokerProvider';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';
import { FeedPostBox, type FeedPostBoxProfile } from './FeedPostBox';
import { FeedPostCard } from './FeedPostCard';
import { GiftClipsModal } from './GiftClipsModal';
import { PromoteForCreatorPanel } from './PromoteForCreatorPanel';
import { ShareMenu } from './ShareMenu';
import type { FeedPlayer, FeedPost } from '../../types/feed';

type PlayerFeedScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Feed'>;
};

export function PlayerFeedScreen({ navigation }: PlayerFeedScreenProps) {
  const { roomState } = usePoker();
  const [posts, setPosts] = useState<FeedPost[]>(mockFeedPosts);
  const [giftPost, setGiftPost] = useState<FeedPost | null>(null);
  const [promotePost, setPromotePost] = useState<FeedPost | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);

  const activeTableCode = roomState?.roomId ?? null;

  const feedSubtitle = useMemo(
    () =>
      activeTableCode
        ? `Discover players, support creators, and route invites through active table ${activeTableCode}.`
        : 'Discover players, support creators, and turn table talk into future invites.',
    [activeTableCode],
  );

  function handleCreatePost(content: string) {
    const createdPost: FeedPost = {
      commentCount: 0,
      content,
      id: `local-feed-${Date.now()}`,
      isPromoted: false,
      isTableRelated: false,
      player: currentFeedPlayer,
      shareCount: 0,
      supportedByCurrentPlayer: false,
      supportersCount: 0,
      timestamp: 'Now',
    };

    setPosts((currentPosts) => [createdPost, ...currentPosts]);
  }

  function handleSupportChange(postId: string, nextSupportedState: boolean) {
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        const previousSupportedState = Boolean(post.supportedByCurrentPlayer);

        if (previousSupportedState === nextSupportedState) {
          return post;
        }

        return {
          ...post,
          supportedByCurrentPlayer: nextSupportedState,
          supportersCount: Math.max(0, post.supportersCount + (nextSupportedState ? 1 : -1)),
        };
      }),
    );
  }

  function handleOpenProfile(player: FeedPlayer | FeedPostBoxProfile) {
    // TODO(profile:openFromFeed): Navigate to a player profile route with player.id when profiles accept params.
    // Future profile modules should expose friend requests, chat room invites, table invites, stats, and player posts.
    if (player.id === currentFeedPlayer.id) {
      navigation.navigate(routes.Profile);
      return;
    }

    Alert.alert('Player Profile', `${player.name}'s profile will open from the feed when profile discovery is connected.`);
  }

  function handleComment(post: FeedPost, comment: string) {
    // TODO(feed:addComment): Persist comment to backend and subscribe to live comment updates.
    // TODO(notification:feedActivity): Notify post owner of new feed comment after backend confirmation.
    setPosts((currentPosts) =>
      currentPosts.map((currentPost) =>
        currentPost.id === post.id ? { ...currentPost, commentCount: currentPost.commentCount + 1 } : currentPost,
      ),
    );
    Alert.alert('Comment added locally', `Mock comment: ${comment}`);
  }

  function handleShare(destinationId: string) {
    if (!sharePost) {
      return;
    }

    // TODO(feed:sharePost): Persist share destination and return updated share count.
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === sharePost.id ? { ...post, shareCount: post.shareCount + 1 } : post)),
    );
    Alert.alert('Share placeholder', `Shared to ${destinationId.replace(/-/g, ' ')} locally.`);
    setSharePost(null);
  }

  function handleSendGift(amount: number) {
    if (!giftPost) {
      return;
    }

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === giftPost.id
          ? {
              ...post,
              giftClipsCount: (post.giftClipsCount ?? 0) + 1,
              giftClipsTotal: (post.giftClipsTotal ?? 0) + amount,
            }
          : post,
      ),
    );
    Alert.alert('Gift Clips placeholder', `${amount.toLocaleString()} clips staged locally for ${giftPost.player.name}.`);
    setGiftPost(null);
  }

  function handlePromote() {
    if (!promotePost) {
      return;
    }

    // TODO(feed:promoteForCreator): Persist paid promotion intent and update sponsored stats.
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === promotePost.id
          ? { ...post, isPromoted: true, promotedCount: (post.promotedCount ?? 0) + 1 }
          : post,
      ),
    );
    Alert.alert('Promote placeholder', `Promotion sponsorship staged locally for ${promotePost.player.name}.`);
    setPromotePost(null);
  }

  function handleInviteToTable(post: FeedPost) {
    // TODO(feed:inviteToTable): Connect feed invites to backend table invite and chat-room invite systems.
    // TODO(notification:tableInvite): Notify invited player once backend invite is accepted.
    if (!activeTableCode) {
      navigation.navigate(routes.Home);
      return;
    }

    navigation.navigate(routes.Game, {
      invitePreset: buildSocialInvitePreset(post.player.handle, `Inviting from feed post ${post.id}`),
    });
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <FlatList
          contentContainerStyle={styles.content}
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <View style={styles.screenHeader}>
                <Text style={styles.eyebrow}>Player Feed</Text>
                <Text style={styles.title}>Table Talk</Text>
                <Text style={styles.subtitle}>{feedSubtitle}</Text>
              </View>
              <FeedPostBox
                currentPlayer={currentFeedPlayer}
                onOpenProfile={handleOpenProfile}
                onPostCreated={handleCreatePost}
              />
            </View>
          }
          renderItem={({ item }) => (
            <FeedPostCard
              onComment={handleComment}
              onGiftClips={setGiftPost}
              onInviteToTable={handleInviteToTable}
              onOpenProfile={handleOpenProfile}
              onPromote={setPromotePost}
              onShare={setSharePost}
              onSupportChange={handleSupportChange}
              post={item}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
      <SafeAreaView style={styles.bottomNavigationSafeArea}>
        <MainPlatformNavigation />
      </SafeAreaView>
      <ShareMenu
        onClose={() => setSharePost(null)}
        onPromote={() => setPromotePost(sharePost)}
        onShare={handleShare}
        post={sharePost}
        visible={Boolean(sharePost)}
      />
      <GiftClipsModal
        onClose={() => setGiftPost(null)}
        onSendGift={handleSendGift}
        post={giftPost}
        visible={Boolean(giftPost)}
      />
      <PromoteForCreatorPanel
        onClose={() => setPromotePost(null)}
        onPromote={handlePromote}
        post={promotePost}
        visible={Boolean(promotePost)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavigationSafeArea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  content: {
    gap: 14,
    padding: 18,
    paddingBottom: 116,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerStack: {
    gap: 14,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  screenHeader: {
    gap: 8,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
});
