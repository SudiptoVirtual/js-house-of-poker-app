import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainPlatformNavigation } from '../navigation/MainPlatformNavigation';
import { routes } from '../../constants/routes';
import { useAuth } from '../../context/AuthProvider';
import { usePoker } from '../../context/PokerProvider';
import { createFeedComment, createFeedPost, createFeedPromotion, createFeedShare, fetchFeedPosts, getApiErrorDetails, sendFeedGiftClip, sendFeedTableInvite, toggleFeedSupport } from '../../services/api';
import { getAuthSession } from '../../services/storage/sessionStorage';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';
import { FeedPostBox, type FeedPostBoxProfile } from './FeedPostBox';
import { FeedPostCard } from './FeedPostCard';
import { GiftClipsModal } from './GiftClipsModal';
import { PromoteForCreatorPanel } from './PromoteForCreatorPanel';
import { ShareMenu } from './ShareMenu';
import { isBackendShareDestination, type FeedNavigationRoute, type FeedPlayer, type FeedPost, type ShareDestinationId } from '../../types/feed';

type PlayerFeedScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Feed'>;
};

function buildCurrentUserHandle(user: { email?: string; id: string; name: string }) {
  const localPart = user.email?.split('@')[0]?.trim();
  const fallback = user.name.trim() || `player-${user.id.slice(-6)}`;
  const handleBase = localPart || fallback;

  return `@${handleBase.toLowerCase().replace(/[^a-z0-9._-]/g, '-')}`;
}

function isBackendFeedPostId(postId: string) {
  return /^[a-f0-9]{24}$/i.test(postId);
}

function buildProfileRoute(playerId: string): FeedNavigationRoute {
  return {
    deepLink: `houseofpoker://profile/${playerId}`,
    params: { playerId, userId: playerId },
    route: 'Profile',
    screen: 'ProfileScreen',
  };
}

export function PlayerFeedScreen({ navigation }: PlayerFeedScreenProps) {
  const { currentUser, token } = useAuth();
  const { roomState } = usePoker();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [giftPost, setGiftPost] = useState<FeedPost | null>(null);
  const [promotePost, setPromotePost] = useState<FeedPost | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);

  const activeTableCode = roomState?.roomId ?? null;
  const currentPlayer = useMemo<FeedPlayer | undefined>(
    () =>
      currentUser
        ? {
            avatarUrl: currentUser.avatar,
            handle: buildCurrentUserHandle(currentUser),
            id: currentUser.id,
            name: currentUser.name,
            profileRoute: buildProfileRoute(currentUser.id),
            status: currentUser.isOnline ? 'Online' : 'In Lobby',
            statusTier: 'none',
          }
        : undefined,
    [currentUser],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadFeedPosts() {
      const session = await getAuthSession();
      const response = await fetchFeedPosts(session?.token ?? null);

      if (isMounted) {
        setPosts(response.posts);
      }
    }

    void loadFeedPosts().catch((error) => {
      console.warn('Unable to load backend feed posts.', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const feedSubtitle = useMemo(
    () =>
      activeTableCode
        ? `Discover players, support creators, and route invites through active table ${activeTableCode}.`
        : 'Discover players, support creators, and turn table talk into future invites.',
    [activeTableCode],
  );

  async function handleCreatePost(content: string) {
    if (!token || !currentUser) {
      Alert.alert('Sign in required', 'Sign in to publish posts to the player feed.');
      throw new Error('Sign in required to publish feed posts.');
    }

    try {
      const response = await createFeedPost(
        {
          content,
          ...(activeTableCode ? { tableCode: activeTableCode } : {}),
        },
        token,
      );

      setPosts((currentPosts) => [response.post, ...currentPosts]);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to publish your post right now.');
      Alert.alert('Post not published', details.message);
      throw error;
    }
  }

  async function handleSupportChange(postId: string, nextSupportedState: boolean) {
    const targetPost = posts.find((post) => post.id === postId);
    const previousSupportedState = Boolean(targetPost?.supportedByCurrentPlayer);

    if (!isBackendFeedPostId(postId)) {
      Alert.alert('Action unavailable', 'Refresh the feed before supporting this post.');
      return;
    }

    const session = await getAuthSession();

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in to save your support.');
      return;
    }

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
    const matchingPost = posts.find((post) => post.player.id === playerId);
    const profileRoute = matchingPost?.actorProfileLink ?? matchingPost?.player.profileRoute;

    if (profileRoute?.screen === 'FriendsScreen') {
      navigation.navigate(routes.Friends);
      return;
    }

    if (playerId === currentPlayer?.id) {
      navigation.navigate(routes.Profile);
      return;
    }

    navigation.navigate(routes.Profile);
  }

  async function handleComment(post: FeedPost, comment: string) {
    // TODO(notification:feedActivity): Notify post owner of new feed comment after backend confirmation.
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      Alert.alert('Action unavailable', 'Refresh the feed before commenting on this post.');
      return undefined;
    }

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in to save your comment.');
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

    if (!isBackendFeedPostId(targetPost.id)) {
      Alert.alert('Action unavailable', 'Refresh the feed before sharing this post.');
      setSharePost(null);
      return;
    }

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in to save your share.');
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

    if (!isBackendFeedPostId(targetPost.id)) {
      Alert.alert('Action unavailable', 'Refresh the feed before sending Gift Clips.');
      return;
    }

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in before sending Gift Clips.');
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

  async function handlePromote() {
    if (!promotePost) {
      return;
    }

    const targetPost = promotePost;
    const session = await getAuthSession();

    if (!isBackendFeedPostId(targetPost.id)) {
      Alert.alert('Action unavailable', 'Refresh the feed before sponsoring a promotion.');
      return;
    }

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in before sponsoring a promotion.');
      return;
    }

    try {
      const response = await createFeedPromotion(
        targetPost.id,
        {
          amount: 500,
          durationDays: 7,
          paymentProvider: 'mock',
          targeting: {
            audience: ['feed'],
            metadata: { source: 'FeedActionBar' },
          },
        },
        session.token,
      );

      setPosts((currentPosts) => currentPosts.map((post) => (post.id === targetPost.id ? response.post : post)));
      Alert.alert('Promotion sponsored', `${targetPost.player.name}'s post is now sponsored in the feed.`);
      setPromotePost(null);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to sponsor this promotion right now.');
      Alert.alert('Promotion not saved', details.message);
    }
  }

  async function handleInviteToTable(post: FeedPost) {
    const tableCode = post.tableContext?.tableCode;
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      Alert.alert('Action unavailable', 'Refresh the feed before sending table invites from feed.');
      return;
    }

    if (!session?.token) {
      Alert.alert('Sign in required', 'Sign in before sending table invites from feed.');
      return;
    }

    if (!tableCode) {
      Alert.alert('Table unavailable', 'This feed post does not include a joinable table context yet.');
      return;
    }

    try {
      const response = await sendFeedTableInvite(
        post.id,
        {
          message: `Inviting from feed post ${post.id}`,
          recipientUserId: post.player.id,
          tableCode,
        },
        session.token,
      );

      setPosts((currentPosts) => currentPosts.map((currentPost) => (currentPost.id === post.id ? response.post : currentPost)));
      Alert.alert('Table invite sent', `${post.player.name} can join ${response.table.tableName || response.table.tableCode || 'the table'} from their feed notification.`);
    } catch (error) {
      const details = getApiErrorDetails(error, 'Unable to send this feed table invite right now.');
      Alert.alert('Invite not sent', details.message);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <StatusBar style="light" />
        <FlatList
          contentContainerStyle={styles.content}
          data={posts}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No feed posts yet</Text>
              <Text style={styles.emptyText}>Be the first to start table talk by publishing a post.</Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <View style={styles.screenHeader}>
                <Text style={styles.eyebrow}>Player Feed</Text>
                <Text style={styles.title}>Table Talk</Text>
                <Text style={styles.subtitle}>{feedSubtitle}</Text>
              </View>
              <FeedPostBox
                currentPlayer={currentPlayer}
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
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomNavigationSafeArea}>
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
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
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
