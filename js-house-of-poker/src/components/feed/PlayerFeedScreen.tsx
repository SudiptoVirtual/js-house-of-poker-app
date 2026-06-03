import { useMemo, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MainPlatformNavigation } from '../navigation/MainPlatformNavigation';
import { currentFeedPlayer, mockFeedPosts } from '../../constants/playerFeedMockData';
import { routes } from '../../constants/routes';
import { buildSocialInvitePreset } from '../../constants/social';
import { usePoker } from '../../context/PokerProvider';
import { createFeedComment, createFeedShare, getApiErrorDetails, sendFeedGiftClip, toggleFeedSupport } from '../../services/api';
import { getAuthSession } from '../../services/storage/sessionStorage';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';
import { FeedPostBox, type FeedPostBoxProfile } from './FeedPostBox';
import { FeedPostCard } from './FeedPostCard';
import { GiftClipsModal } from './GiftClipsModal';
import { PromoteForCreatorPanel } from './PromoteForCreatorPanel';
import { ShareMenu } from './ShareMenu';
import { isBackendShareDestination, type FeedPost, type ShareDestinationId } from '../../types/feed';

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

  async function handleSupportChange(postId: string, nextSupportedState: boolean) {
    const targetPost = posts.find((post) => post.id === postId);
    const previousSupportedState = Boolean(targetPost?.supportedByCurrentPlayer);

    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        if (Boolean(post.supportedByCurrentPlayer) === nextSupportedState) {
          return post;
        }

        return {
          ...post,
          reactionCounts: { ...(post.reactionCounts ?? {}), support: Math.max(0, post.supportersCount + (nextSupportedState ? 1 : -1)) },
          supportedByCurrentPlayer: nextSupportedState,
          supportersCount: Math.max(0, post.supportersCount + (nextSupportedState ? 1 : -1)),
        };
      }),
    );

    const session = await getAuthSession();

    if (!session?.token || postId.startsWith('local-feed-')) {
      Alert.alert('Support staged locally', 'Sign in and refresh persisted feed posts to save your support.');
      return;
    }

    try {
      const response = await toggleFeedSupport(postId, nextSupportedState, session.token);

      setPosts((currentPosts) => currentPosts.map((post) => (post.id === postId ? response.post : post)));
    } catch (error) {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId && targetPost
            ? {
                ...post,
                reactionCounts: targetPost.reactionCounts,
                supportedByCurrentPlayer: previousSupportedState,
                supportersCount: targetPost.supportersCount,
              }
            : post,
        ),
      );

      const details = getApiErrorDetails(error, 'Unable to save your support right now.');
      Alert.alert('Support not saved', details.message);
    }
  }

  function handleOpenProfile(playerId: string) {
    // TODO(profile:openFromFeed): Navigate to a player profile route with playerId when profiles accept params.
    // TODO(future friend requests): Add friend requests from feed profile entry points.
    // TODO(future chat room invites): Add chat room invites from feed profile entry points.
    // TODO(future table invites): Add table invites from feed profile entry points.
    // TODO(future player stats): Add player stats for profiles opened from the feed.
    // TODO(future player posts): Add player posts for profiles opened from the feed.
    if (playerId === currentFeedPlayer.id) {
      navigation.navigate(routes.Profile);
      return;
    }

    Alert.alert('Player Profile', 'This player profile will open from the feed when profile discovery is connected.');
  }

  async function handleComment(post: FeedPost, comment: string) {
    // TODO(notification:feedActivity): Notify post owner of new feed comment after backend confirmation.
    const session = await getAuthSession();

    if (!session?.token || post.id.startsWith('local-feed-')) {
      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id ? { ...currentPost, commentCount: currentPost.commentCount + 1 } : currentPost,
        ),
      );
      Alert.alert('Comment staged locally', `Sign in and refresh persisted feed posts to save: ${comment}`);
      return undefined;
    }

    try {
      const response = await createFeedComment(post.id, comment, session.token);

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) => (currentPost.id === post.id ? response.post : currentPost)),
      );

      return response;
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to save your comment right now.');
      Alert.alert('Comment not saved', details.message);
      throw error;
    }
  }

  async function handleShare(destinationId: ShareDestinationId) {
    if (!sharePost || !isBackendShareDestination(destinationId)) {
      return;
    }

    const targetPost = sharePost;
    const session = await getAuthSession();

    if (!session?.token || targetPost.id.startsWith('local-feed-')) {
      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === targetPost.id ? { ...post, shareCount: post.shareCount + 1 } : post)),
      );
      Alert.alert('Share staged locally', `Sign in and refresh persisted feed posts to save your ${destinationId.replace(/-/g, ' ')} share.`);
      setSharePost(null);
      return;
    }

    try {
      const response = await createFeedShare(targetPost.id, { destination: destinationId }, session.token);

      setPosts((currentPosts) => currentPosts.map((post) => (post.id === targetPost.id ? response.post : post)));
      Alert.alert('Share saved', `Shared to ${destinationId.replace(/-/g, ' ')}.`);
      setSharePost(null);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to save your share right now.');
      Alert.alert('Share not saved', details.message);
    }
  }

  async function handleSendGift(amount: number, message: string) {
    if (!giftPost) {
      return;
    }

    const targetPost = giftPost;
    const session = await getAuthSession();

    if (!session?.token || targetPost.id.startsWith('local-feed-')) {
      Alert.alert('Sign in required', 'Sign in and refresh persisted feed posts before sending Gift Clips.');
      return;
    }

    try {
      const response = await sendFeedGiftClip(targetPost.id, { amount, message }, session.token);

      setPosts((currentPosts) => currentPosts.map((post) => (post.id === targetPost.id ? response.post : post)));
      Alert.alert('Gift Clips sent', `${amount.toLocaleString()} clips sent to ${targetPost.player.name}.`);
      setGiftPost(null);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to send Gift Clips right now.');
      Alert.alert('Gift Clips not sent', details.message);
    }
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
                onOpenProfile={(player: FeedPostBoxProfile) => handleOpenProfile(player.id)}
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
