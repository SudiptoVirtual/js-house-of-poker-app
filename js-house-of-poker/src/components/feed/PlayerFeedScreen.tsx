import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Clipboard,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeView } from '../KeyboardSafeView';
import { MainPlatformNavigation } from '../navigation/MainPlatformNavigation';
import { routes } from '../../constants/routes';
import { useAuth } from '../../context/AuthProvider';
import { useFeedNotifications } from '../../context/FeedNotificationProvider';
import { usePoker } from '../../context/PokerProvider';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';
import { createFeedRealtimeClient } from '../../services/feed/feedRealtimeClient';
import {
  createFeedComment,
  createFeedPost,
  createFeedPromotion,
  createFeedShare,
  deleteFeedComment,
  deleteFeedPost,
  fetchFeedComments,
  fetchFeedPosts,
  getApiErrorDetails,
  sendFeedGiftClip,
  toggleFeedSupport,
  updateFeedComment,
  updateFeedPost,
  uploadFeedMedia,
  type CreateFeedPostInput,
  type CreateFeedShareInput,
} from '../../services/api';
import { createOrGetDirectChatRoom, fetchChatRooms } from '../../services/api/chatRooms';
import { fetchFriends } from '../../services/api/friends';
import { getAuthSession } from '../../services/storage/sessionStorage';
import { env } from '../../config/env';
import type { RootStackParamList } from '../../types/navigation';
import { FeedPostBox, type ComposeFeedPostInput, type FeedPostBoxProfile } from './FeedPostBox';
import { FeedPostCard } from './FeedPostCard';
import { getJoinTableErrorMessage, joinFeedTableInvite } from './tableInviteActions';
import { GiftClipsModal } from './GiftClipsModal';
import { PromoteForCreatorPanel } from './PromoteForCreatorPanel';
import { ShareMenu, type ShareSelection } from './ShareMenu';
import {
  isBackendShareDestination,
  type BackendShareDestinationId,
  type FeedComment,
  type FeedNavigationRoute,
  type FeedPlayer,
  type FeedPost,
} from '../../types/feed';
import type { ChatRoom } from '../../types/chatRooms';
import type { FriendsPlayer } from '../../types/friends';
import { mergeRealtimePostList } from './mergeRealtimePostList';
import { selectActiveVideoPostId } from './feedVideoSelection';

import { colors } from '../../theme/colors';
type FeedLoadState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'session-expired';

type PromotionPaymentState = 'idle' | 'creating' | 'pending-payment';
type FeedToast = { tone: 'success' | 'error'; message: string } | null;
type ToastAwareError = Error & { feedToastShown?: boolean };

type PlayerFeedScreenProps = {
  mode?: 'feed' | 'profile-history';
  navigation: NativeStackNavigationProp<RootStackParamList, 'Feed' | 'MyFeed'>;
  route: RouteProp<RootStackParamList, 'Feed' | 'MyFeed'>;
};

function buildCurrentUserHandle(user: {
  email?: string;
  id: string;
  name: string;
}) {
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

function buildFeedPostDeepLink(postId: string) {
  return `houseofpoker://feed/posts/${encodeURIComponent(postId)}`;
}

function buildFeedPostUrl(postId: string) {
  return env.apiBaseUrl
    ? `${env.apiBaseUrl}/feed/posts/${encodeURIComponent(postId)}`
    : buildFeedPostDeepLink(postId);
}

function buildFacebookShareUrl(postUrl: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
}

type ShareTargetOption = {
  helperText?: string;
  id: string;
  label: string;
};

function getRecentActivityTime(friend: FriendsPlayer) {
  if (!friend.recentActivityAt) {
    return 0;
  }

  const time = new Date(friend.recentActivityAt).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function sortShareFriendsByRecentActivity(friends: FriendsPlayer[]) {
  return [...friends].sort((left, right) => {
    const activityDifference = getRecentActivityTime(right) - getRecentActivityTime(left);

    if (activityDifference !== 0) {
      return activityDifference;
    }

    if (left.isOnline !== right.isOnline) {
      return left.isOnline ? -1 : 1;
    }

    const leftName = left.displayName || left.username || `Player ${left.id.slice(-6)}`;
    const rightName = right.displayName || right.username || `Player ${right.id.slice(-6)}`;
    const nameDifference = leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });

    return nameDifference || left.id.localeCompare(right.id);
  });
}

function getFriendShareHelperText(friend: FriendsPlayer) {
  if (friend.activityStatus === 'at_table') {
    return 'At a table';
  }

  if (friend.activityStatus === 'playing_357') {
    return 'Playing 3-5-7';
  }

  if (friend.activityStatus === 'in_chat_room') {
    return 'In a chat room';
  }

  if (friend.activityStatus === 'in_lobby') {
    return 'In the lobby';
  }

  if (friend.isOnline || friend.activityStatus === 'online') {
    return 'Online now';
  }

  return friend.username || 'Friend';
}

export function PlayerFeedScreen({ mode = 'feed', navigation, route }: PlayerFeedScreenProps) {
  const { currentUser, token } = useAuth();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisible();
  const { markFeedNotificationsRead, notifications } = useFeedNotifications();
  const { joinTable, roomState } = usePoker();
  const feedListRef = useRef<FlatList<FeedPost>>(null);
  const feedScrollOffsetRef = useRef(0);
  const postsRef = useRef<FeedPost[]>([]);
  const isMountedRef = useRef(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoadState, setFeedLoadState] = useState<FeedLoadState>('idle');
  const [feedLoadMessage, setFeedLoadMessage] = useState('');
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [giftPost, setGiftPost] = useState<FeedPost | null>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [promotePost, setPromotePost] = useState<FeedPost | null>(null);
  const [promotionPaymentState, setPromotionPaymentState] =
    useState<PromotionPaymentState>('idle');
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [shareFriends, setShareFriends] = useState<FriendsPlayer[]>([]);
  const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
  const [isFeedFocused, setIsFeedFocused] = useState(false);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [feedToast, setFeedToast] = useState<FeedToast>(null);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const isProfileHistoryMode = mode === 'profile-history';
  const routeParams = route.name === routes.Feed ? route.params : undefined;
  const focusedNotificationId = routeParams?.notificationId ?? null;
  const focusedPostId = routeParams?.postId ?? null;
  const activeTableCode = roomState?.roomId ?? null;
  const activeTableId = roomState?.tableId ?? roomState?.roomId ?? null;
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

  const mergeRealtimePost = useCallback(
    (payload: { post?: FeedPost; userId?: string | null }) => {
      if (!payload.post) {
        return;
      }

      setPosts((currentPosts) =>
        mergeRealtimePostList(currentPosts, payload.post as FeedPost, {
          currentUserId: currentUser?.id ?? null,
          eventUserId: payload.userId ?? null,
        }),
      );
      setFeedLoadState('ready');
      setFeedLoadMessage('');
    },
    [currentUser?.id],
  );

  const handleCommentInputFocus = useCallback((inputHandle: number) => {
    setTimeout(() => {
      const keyboardTop = Keyboard.metrics()?.screenY;

      if (keyboardTop == null) {
        return;
      }

      UIManager.measure(
        inputHandle,
        (_inputX, _inputY, _inputWidth, inputHeight, _inputPageX, inputPageY) => {
          const overlap = inputPageY + inputHeight + 16 - keyboardTop;

          if (overlap > 0) {
            feedListRef.current?.scrollToOffset({
              animated: true,
              offset: feedScrollOffsetRef.current + overlap,
            });
          }
        },
      );
    }, Platform.OS === 'android' ? 350 : 0);
  }, []);

  const loadFeedPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingFeed(true);
    } else {
      setFeedLoadState('loading');
      setFeedLoadMessage('');
    }

    try {
      if (isProfileHistoryMode && !currentUser?.id) {
        setPosts([]);
        setFeedLoadState('session-expired');
        setFeedLoadMessage('Sign in to view your feed history.');
        return;
      }

      const session = await getAuthSession();
      const response = isProfileHistoryMode && currentUser?.id
        ? await fetchFeedPosts(session?.token ?? null, { authorUserId: currentUser.id })
        : await fetchFeedPosts(session?.token ?? null);

      if (!isMountedRef.current) {
        return;
      }

      setPosts(response.posts);
      setFeedLoadState(response.posts.length > 0 ? 'ready' : 'empty');
      setFeedLoadMessage('');
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to load feed posts right now.',
      );

      if (!isMountedRef.current) {
        return;
      }

      if (isRefresh) {
        setFeedToast({ tone: 'error', message: details.message });
      } else {
        setPosts([]);
        setFeedLoadState(
          details.status === 401 || details.status === 403
            ? 'session-expired'
            : 'error',
        );
        setFeedLoadMessage(details.message);
      }
    } finally {
      if (isRefresh && isMountedRef.current) {
        setIsRefreshingFeed(false);
      }
    }
  }, [currentUser?.id, isProfileHistoryMode]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadFeedPosts();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadFeedPosts]);

  useEffect(() => {
    let isMounted = true;

    async function loadShareTargets() {
      try {
        const session = await getAuthSession();
        const [rooms, acceptedFriends] = await Promise.all([
          fetchChatRooms(session?.token ?? null),
          session?.token ? fetchFriends(session.token) : Promise.resolve([]),
        ]);

        if (isMounted) {
          setChatRooms(rooms);
          setShareFriends(acceptedFriends);
        }
      } catch {
        if (isMounted) {
          setChatRooms([]);
          setShareFriends([]);
        }
      }
    }

    void loadShareTargets();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const feedRealtimeClient = createFeedRealtimeClient({
      onPostUpdate: mergeRealtimePost,
    });

    async function connectFeedSocket() {
      const session = await getAuthSession();

      if (!isMounted || !session?.token) {
        return;
      }

      try {
        await feedRealtimeClient.connect(session.token);
      } catch {
        // Keep the REST-loaded feed usable if the realtime socket is unavailable.
      }
    }

    void connectFeedSocket();

    return () => {
      isMounted = false;
      feedRealtimeClient.destroy();
    };
  }, [mergeRealtimePost]);


  useFocusEffect(
    useCallback(() => {
      markFeedNotificationsRead();
      setIsFeedFocused(true);
      return () => setIsFeedFocused(false);
    }, [markFeedNotificationsRead]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) =>
      setIsAppActive(nextState === 'active'),
    );
    return () => subscription.remove();
  }, []);

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null; isViewable: boolean; item: FeedPost }> }) => {
      setActiveVideoPostId(
        selectActiveVideoPostId(
          viewableItems.map(({ isViewable, item }) => ({
            hasVideo: item.media.some((media) => media.type === 'video'),
            isViewable,
            postId: item.id,
          })),
        ),
      );

      const visibleIndices = viewableItems
        .filter(({ index, isViewable }) => isViewable && index != null)
        .map(({ index }) => index as number);
      const nearbyVideoThumbnailUrls = new Set<string>();

      for (const visibleIndex of visibleIndices) {
        for (let index = Math.max(0, visibleIndex - 1); index <= visibleIndex + 2; index += 1) {
          const nearbyPost = postsRef.current[index];
          nearbyPost?.media.forEach((media) => {
            const thumbnailUrl = media.type === 'video' && typeof media.thumbnailUrl === 'string' ? media.thumbnailUrl.trim() : '';
            if (thumbnailUrl) nearbyVideoThumbnailUrls.add(thumbnailUrl);
          });
        }
      }

      nearbyVideoThumbnailUrls.forEach((thumbnailUrl) => {
        void Image.prefetch(thumbnailUrl);
      });
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const focusedNotification = useMemo(
    () => notifications.find((notification) => notification.id === focusedNotificationId) ?? null,
    [focusedNotificationId, notifications],
  );

  const feedSubtitle = useMemo(
    () => {
      if (isProfileHistoryMode) {
        return 'Review your published posts with owner controls for editing or deleting your history.';
      }

      return activeTableCode
        ? `Discover players, support creators, and route invites through active table ${activeTableCode}.`
        : 'Discover players, support creators, and turn table talk into future invites.';
    },
    [activeTableCode, isProfileHistoryMode],
  );

  const chatRoomShareOptions = useMemo<ShareTargetOption[]>(
    () =>
      chatRooms.map((room) => ({
        helperText: `${room.activePlayerCount.toLocaleString()} active • ${room.topic}`,
        id: room.id,
        label: room.title,
      })),
    [chatRooms],
  );

  const friendShareOptions = useMemo<ShareTargetOption[]>(
    () =>
      sortShareFriendsByRecentActivity(shareFriends.filter((friend) => friend.relationshipStatus === 'friend'))
        .map((friend) => ({
          helperText: getFriendShareHelperText(friend),
          id: friend.id,
          label: friend.displayName || friend.username || `Player ${friend.id.slice(-6)}`,
        })),
    [shareFriends],
  );

  async function handleCreatePost(input: ComposeFeedPostInput) {
    if (!token || !currentUser) {
      const error = new Error('Sign in to publish posts to the player feed.') as ToastAwareError;
      error.feedToastShown = true;
      setFeedToast({ tone: 'error', message: error.message });
      throw error;
    }

    try {
      if (input.postType === 'table_invite' && !activeTableCode && !activeTableId) {
        throw new Error('Select a joinable table before publishing a table invite.');
      }
      const request: CreateFeedPostInput = input.postType === 'table_invite'
        ? {
            content: input.content,
            media: input.media,
            postType: 'table_invite',
            ...(activeTableCode ? { tableCode: activeTableCode } : { tableId: activeTableId as string }),
            ...(activeTableId ? { tableId: activeTableId } : {}),
            tableContext: {
              gameLabel: roomState?.gameSettings.game === '357' ? '3-5-7' : "Texas Hold'em",
              seatsOpen: Math.max(0, (roomState?.maxSeats ?? 0) - (roomState?.players.length ?? 0)),
              ...(activeTableCode ? { tableCode: activeTableCode } : {}),
              ...(activeTableId ? { tableId: activeTableId } : {}),
              tableName: roomState?.tableName ?? activeTableCode ?? 'Poker table',
            },
          }
        : input.postType === 'media'
          ? { content: input.content, media: input.media, postType: 'media' }
          : { content: input.content, postType: 'text' };
      const response = await createFeedPost(request, token);

      setPosts((currentPosts) =>
        mergeRealtimePostList(currentPosts, response.post, {
          currentUserId: currentUser.id,
          eventUserId: currentUser.id,
        }),
      );
      setFeedLoadState('ready');
      setFeedLoadMessage('');
      return response.post;
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to publish your post right now.',
      );
      if (error instanceof Error) {
        (error as ToastAwareError).feedToastShown = true;
      }
      setFeedToast({ tone: 'error', message: details.message });
      throw error;
    }
  }

  function getPostActionDisabledMessage(post: FeedPost) {
    if (!isBackendFeedPostId(post.id)) {
      return 'This post must be saved to the backend before support, comments, shares, gifts, invites, or promotions are available.';
    }

    if (!token || !currentUser) {
      return 'Sign in to use support, comments, shares, gifts, table invites, and promotion actions.';
    }

    return undefined;
  }

  async function handleSupportChange(
    postId: string,
    nextSupportedState: boolean,
  ) {
    const targetPost = posts.find((post) => post.id === postId);
    const previousSupportedState = Boolean(
      targetPost?.supportedByCurrentPlayer,
    );

    if (!isBackendFeedPostId(postId)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before supporting this post.',
      });
      return;
    }

    const session = await getAuthSession();

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in to save your support.' });
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
          reactionCounts: {
            ...(post.reactionCounts ?? {}),
            support: Math.max(
              0,
              post.supportersCount + (nextSupportedState ? 1 : -1),
            ),
          },
          supportedByCurrentPlayer: nextSupportedState,
          supportersCount: Math.max(
            0,
            post.supportersCount + (nextSupportedState ? 1 : -1),
          ),
        };
      }),
    );

    try {
      const response = await toggleFeedSupport(
        postId,
        nextSupportedState,
        session.token,
      );

      setPosts((currentPosts) =>
        currentPosts.map((post) => (post.id === postId ? response.post : post)),
      );
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

      const details = getApiErrorDetails(
        error,
        'Unable to save your support right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
    }
  }

  function handleOpenProfile(playerId: string) {
    const matchingPost = posts.find((post) => post.player.id === playerId);
    const profileRoute =
      matchingPost?.actorProfileLink ?? matchingPost?.player.profileRoute;

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

  async function handleFetchComments(post: FeedPost) {
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      throw new Error(
        'Refresh the feed before loading comments for this post.',
      );
    }

    if (!session?.token) {
      throw new Error('Sign in to load comments for this post.');
    }

    try {
      const response = await fetchFeedComments(post.id, session.token);

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id ? response.post : currentPost,
        ),
      );

      return response;
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to load comments right now.',
      );
      throw new Error(details.message);
    }
  }

  async function handleComment(post: FeedPost, comment: string) {
    // TODO(notification:feedActivity): Notify post owner of new feed comment after backend confirmation.
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before commenting on this post.',
      });
      return undefined;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in to save your comment.' });
      return undefined;
    }

    try {
      const response = await createFeedComment(post.id, comment, session.token);

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id ? response.post : currentPost,
        ),
      );

      return response;
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to save your comment right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
      throw error;
    }
  }

  async function handleUpdateComment(
    post: FeedPost,
    comment: FeedComment,
    body: string,
  ) {
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before editing this comment.',
      });
      return undefined;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in to edit your comment.' });
      return undefined;
    }

    try {
      const response = await updateFeedComment(
        post.id,
        comment.id,
        body,
        session.token,
      );

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost.id === post.id ? response.post : currentPost,
        ),
      );

      return response;
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to update your comment right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
      throw error;
    }
  }

  async function handleDeleteComment(post: FeedPost, comment: FeedComment) {
    const session = await getAuthSession();

    if (!isBackendFeedPostId(post.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before deleting this comment.',
      });
      return undefined;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in to delete your comment.' });
      return undefined;
    }

    try {
      const response = await deleteFeedComment(
        post.id,
        comment.id,
        session.token,
      );

      if (response.post) {
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === post.id
              ? (response.post ?? currentPost)
              : currentPost,
          ),
        );
      }

      return response;
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to delete your comment right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
      throw error;
    }
  }

  async function handleUpdatePost(post: FeedPost, content: string) {
    const session = await getAuthSession();
    if (!session?.token) {
      const error = new Error('Sign in to edit your post.');
      setFeedToast({ tone: 'error', message: error.message });
      throw error;
    }
    try {
      const response = await updateFeedPost(post.id, { content, media: post.media }, session.token);
      setPosts((currentPosts) =>
        currentPosts.map((currentPost) => currentPost.id === post.id ? response.post : currentPost),
      );
      setFeedToast({ tone: 'success', message: 'Post updated.' });
    } catch (error) {
      setFeedToast({
        tone: 'error',
        message: getApiErrorDetails(error, 'Unable to update your post right now.').message,
      });
      throw error;
    }
  }

  async function handleDeletePost(post: FeedPost) {
    const session = await getAuthSession();
    if (!session?.token) {
      const error = new Error('Sign in to delete your post.');
      setFeedToast({ tone: 'error', message: error.message });
      throw error;
    }
    try {
      await deleteFeedPost(post.id, session.token);
      setPosts((currentPosts) => currentPosts.filter((currentPost) => currentPost.id !== post.id));
      setFeedToast({ tone: 'success', message: 'Post deleted.' });
    } catch (error) {
      setFeedToast({
        tone: 'error',
        message: getApiErrorDetails(error, 'Unable to delete your post right now.').message,
      });
      throw error;
    }
  }

  async function saveFeedShare(
    targetPost: FeedPost,
    destination: BackendShareDestinationId,
    input: Omit<CreateFeedShareInput, 'destination'>,
    token: string,
  ) {
    const response = await createFeedShare(
      targetPost.id,
      { destination, ...input },
      token,
    );

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === targetPost.id ? response.post : post,
      ),
    );
    return response;
  }

  async function handleCopyPostLink(
    targetPost: FeedPost,
    sessionToken: string,
  ) {
    const postUrl = buildFeedPostUrl(targetPost.id);
    const deepLink = buildFeedPostDeepLink(targetPost.id);

    Clipboard.setString(postUrl);
    await saveFeedShare(
      targetPost,
      'copy-link',
      {
        metadata: { deepLink, postUrl },
        targetId: targetPost.id,
        targetType: 'feed-post',
      },
      sessionToken,
    );
    setFeedToast({ tone: 'success', message: `Copied ${postUrl}` });
  }

  async function handlePlatformShare(
    targetPost: FeedPost,
    destination: Extract<BackendShareDestinationId, 'external' | 'facebook'>,
    sessionToken: string,
  ) {
    const postUrl = buildFeedPostUrl(targetPost.id);
    const deepLink = buildFeedPostDeepLink(targetPost.id);
    const message = `Check out ${targetPost.player.name}'s House of Poker post: ${postUrl}`;

    if (destination === 'facebook') {
      const facebookShareUrl = buildFacebookShareUrl(postUrl);
      const openedFacebookShare = await Linking.openURL(facebookShareUrl)
        .then(() => true)
        .catch(() => false);

      if (!openedFacebookShare) {
        await Share.share({
          message,
          title: 'Share House of Poker post',
          url: postUrl,
        });
      }
    } else {
      await Share.share({
        message,
        title: 'Share House of Poker post',
        url: postUrl,
      });
    }

    try {
      await saveFeedShare(
        targetPost,
        destination,
        {
          metadata: { deepLink, postUrl, sharedVia: destination },
          targetId: targetPost.id,
          targetType: 'feed-post',
        },
        sessionToken,
      );
      setFeedToast({
        tone: 'success',
        message: destination === 'facebook'
          ? 'Facebook share recorded.'
          : 'External share recorded.',
      });
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        destination === 'facebook'
          ? 'Facebook share could not be recorded.'
          : 'External share could not be recorded.',
      );
      setFeedToast({ tone: 'error', message: details.message });
    }
  }

  async function handleShare(selection: ShareSelection) {
    if (!sharePost || !isBackendShareDestination(selection.destinationId)) {
      return;
    }

    const targetPost = sharePost;
    const session = await getAuthSession();

    if (!isBackendFeedPostId(targetPost.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before sharing this post.',
      });
      setSharePost(null);
      return;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in to save your share.' });
      return;
    }

    try {
      if (selection.destinationId === 'copy-link') {
        await handleCopyPostLink(targetPost, session.token);
      } else if (
        selection.destinationId === 'facebook' ||
        selection.destinationId === 'external'
      ) {
        await handlePlatformShare(
          targetPost,
          selection.destinationId,
          session.token,
        );
      } else if (selection.destinationId === 'friend') {
        if (!selection.targetUserId) {
          setFeedToast({
            tone: 'error',
            message: 'Select a friend before sharing this post.',
          });
          return;
        }

        await saveFeedShare(
          targetPost,
          'friend',
          {
            metadata: {
              deepLink: buildFeedPostDeepLink(targetPost.id),
              postUrl: buildFeedPostUrl(targetPost.id),
            },
            targetId: selection.targetUserId,
            targetType: 'friend',
            targetUserId: selection.targetUserId,
          },
          session.token,
        );
        setFeedToast({ tone: 'success', message: 'Shared with friend.' });
      } else if (selection.destinationId === 'direct-message') {
        if (!selection.targetUserId) {
          setFeedToast({
            tone: 'error',
            message: 'Select a friend before sharing this post by direct message.',
          });
          return;
        }

        const directRoom = await createOrGetDirectChatRoom(selection.targetUserId, session.token);

        await saveFeedShare(
          targetPost,
          'direct-message',
          {
            metadata: {
              deepLink: buildFeedPostDeepLink(targetPost.id),
              postUrl: buildFeedPostUrl(targetPost.id),
            },
            roomId: directRoom.id,
            targetId: directRoom.id,
            targetType: 'direct-message',
            targetUserId: selection.targetUserId,
          },
          session.token,
        );
        setFeedToast({ tone: 'success', message: 'Shared by direct message.' });
      } else if (selection.destinationId === 'chat-room') {
        if (!selection.roomId) {
          setFeedToast({
            tone: 'error',
            message: 'Select a chat room before sharing this post.',
          });
          return;
        }

        await saveFeedShare(
          targetPost,
          'chat-room',
          {
            metadata: {
              deepLink: buildFeedPostDeepLink(targetPost.id),
              postUrl: buildFeedPostUrl(targetPost.id),
            },
            roomId: selection.roomId,
            targetId: selection.roomId,
            targetType: 'chat-room',
          },
          session.token,
        );
        setFeedToast({ tone: 'success', message: 'Shared to chat room.' });
      } else if (selection.destinationId === 'table') {
        const tableId = selection.tableId ?? activeTableId;

        if (!tableId) {
          setFeedToast({
            tone: 'error',
            message: 'Join a table or select a post table before sharing this post.',
          });
          return;
        }

        await saveFeedShare(
          targetPost,
          'table',
          {
            metadata: {
              deepLink: buildFeedPostDeepLink(targetPost.id),
              postUrl: buildFeedPostUrl(targetPost.id),
            },
            tableId,
            targetId: tableId,
            targetType: 'table',
          },
          session.token,
        );
        setFeedToast({ tone: 'success', message: `Shared to table ${tableId}.` });
      } else {
        await saveFeedShare(
          targetPost,
          selection.destinationId,
          {
            metadata: {
              deepLink: buildFeedPostDeepLink(targetPost.id),
              postUrl: buildFeedPostUrl(targetPost.id),
            },
            targetId: currentUser?.id,
            targetType:
              selection.destinationId === 'profile' ? 'profile' : 'feed',
          },
          session.token,
        );
        setFeedToast({
          tone: 'success',
          message: `Shared to ${selection.destinationId.replace(/-/g, ' ')}.`,
        });
      }

      setSharePost(null);
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to save your share right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
    }
  }

  async function handleSendGift(amount: number, message: string) {
    if (!giftPost || isSendingGift) {
      return;
    }

    const targetPost = giftPost;
    const session = await getAuthSession();

    if (!isBackendFeedPostId(targetPost.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before sending Gift Clips.',
      });
      return;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in before sending Gift Clips.' });
      return;
    }

    setIsSendingGift(true);

    try {
      const response = await sendFeedGiftClip(
        targetPost.id,
        { amount, message },
        session.token,
      );

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === targetPost.id ? response.post : post,
        ),
      );
      setFeedToast({
        tone: 'success',
        message: `${amount.toLocaleString()} clips sent to ${targetPost.player.name}.`,
      });
      setGiftPost(null);
    } catch (error) {
      const details = getApiErrorDetails(
        error,
        'Unable to send Gift Clips right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
    } finally {
      setIsSendingGift(false);
    }
  }

  async function handlePromote() {
    if (!promotePost) {
      return;
    }

    const targetPost = promotePost;
    const session = await getAuthSession();

    if (!isBackendFeedPostId(targetPost.id)) {
      setFeedToast({
        tone: 'error',
        message: 'Refresh the feed before sponsoring a promotion.',
      });
      return;
    }

    if (!session?.token) {
      setFeedToast({ tone: 'error', message: 'Sign in before sponsoring a promotion.' });
      return;
    }

    try {
      setPromotionPaymentState('creating');
      const response = await createFeedPromotion(
        targetPost.id,
        {
          amount: 500,
          durationDays: 7,
          ...(env.feedPromotion.paymentProvider
            ? { paymentProvider: env.feedPromotion.paymentProvider }
            : {}),
          targeting: {
            audience: ['feed'],
            metadata: { source: 'FeedActionBar' },
          },
        },
        session.token,
      );

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === targetPost.id ? response.post : post,
        ),
      );
      if (response.checkoutUrl) {
        await Linking.openURL(response.checkoutUrl);
        setPromotionPaymentState('pending-payment');
        setFeedToast({
          tone: 'success',
          message: 'Complete Stripe checkout in the browser window. This post will be sponsored after payment is confirmed.',
        });
        return;
      }

      if (
        response.promotion.paymentStatus === 'pending' ||
        response.promotion.state === 'pending'
      ) {
        setPromotionPaymentState('pending-payment');
        setFeedToast({
          tone: 'success',
          message: 'Your promotion was created and will become sponsored after payment is confirmed.',
        });
        return;
      }

      setFeedToast({
        tone: 'success',
        message: `${targetPost.player.name}'s post is now sponsored in the feed.`,
      });
      setPromotionPaymentState('idle');
      setPromotePost(null);
    } catch (error) {
      setPromotionPaymentState('idle');
      const details = getApiErrorDetails(
        error,
        'Unable to sponsor this promotion right now.',
      );
      setFeedToast({ tone: 'error', message: details.message });
    }
  }

  async function handleJoinTable(post: FeedPost) {
    try {
      await joinFeedTableInvite({
        joinTable,
        navigateToGame: (tableCode) => navigation.navigate(routes.Game, { tableCode }),
        playerName: currentUser?.name,
        post,
      });
    } catch (error) {
      setFeedToast({ tone: 'error', message: getJoinTableErrorMessage(error) });
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardSafeView>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
          <StatusBar style="light" />
          <FlatList
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.feedContent}
          data={posts}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          onScroll={(event) => {
            feedScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          onViewableItemsChanged={handleViewableItemsChanged}
          ref={feedListRef}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {feedLoadState === 'loading'
                  ? isProfileHistoryMode
                    ? 'Loading your posts…'
                    : 'Loading feed…'
                  : feedLoadState === 'session-expired'
                    ? 'Session expired'
                    : feedLoadState === 'error'
                      ? 'Feed unavailable'
                      : isProfileHistoryMode
                        ? 'No posts in your history yet'
                        : 'No feed posts yet'}
              </Text>
              <Text style={styles.emptyText}>
                {feedLoadState === 'loading'
                  ? isProfileHistoryMode
                    ? 'Fetching your latest persisted posts from the backend.'
                    : 'Fetching the latest persisted posts from the backend.'
                  : feedLoadState === 'session-expired'
                    ? 'Sign in again to refresh your player feed and publish new posts.'
                    : feedLoadState === 'error'
                      ? feedLoadMessage ||
                        'Unable to load feed posts right now. Pull back later after the backend is reachable.'
                      : isProfileHistoryMode
                        ? 'Publish posts from the main feed to build your profile history.'
                        : 'The backend feed is empty. Be the first to start table talk by publishing a post.'}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={styles.headerStack}>
              <View style={styles.screenHeader}>
                <Text style={styles.eyebrow}>
                  {isProfileHistoryMode ? 'Profile history' : 'Player Feed'}
                </Text>
                <Text style={styles.title}>
                  {isProfileHistoryMode ? 'My Feed' : 'Table Talk'}
                </Text>
                <Text style={styles.subtitle}>{feedSubtitle}</Text>
                {focusedNotification ? (
                  <View style={styles.notificationCallout}>
                    <Text style={styles.notificationCalloutLabel}>{focusedNotification.label}</Text>
                    <Text style={styles.notificationCalloutText}>{focusedNotification.body}</Text>
                  </View>
                ) : focusedPostId ? (
                  <View style={styles.notificationCallout}>
                    <Text style={styles.notificationCalloutLabel}>Feed notification</Text>
                    <Text style={styles.notificationCalloutText}>Showing activity for post {focusedPostId}.</Text>
                  </View>
                ) : null}
              </View>
              {!isProfileHistoryMode ? (
                <FeedPostBox
                  canInviteToTable={Boolean(activeTableCode && activeTableId)}
                  currentPlayer={currentPlayer}
                  isAuthenticated={Boolean(token && currentUser)}
                  onCreatePost={handleCreatePost}
                  onToast={setFeedToast}
                  onUploadAttachment={(attachment) => {
                    if (!token) throw new Error('Sign in to upload attachments.');
                    return uploadFeedMedia(attachment, token);
                  }}
                  onOpenProfile={(player: FeedPostBoxProfile) =>
                    handleOpenProfile(player.id)
                  }
                />
              ) : null}
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary, colors.secondary]}
              onRefresh={() => { void loadFeedPosts(true); }}
              progressBackgroundColor={colors.surface}
              refreshing={isRefreshingFeed}
              tintColor={colors.primary}
              title="Refreshing..."
              titleColor={colors.mutedText}
            />
          }
          renderItem={({ item }) => (
            <FeedPostCard
              variant={isProfileHistoryMode ? 'ownerHistory' : 'feed'}
              actionsDisabled={Boolean(getPostActionDisabledMessage(item))}
              actionsDisabledMessage={getPostActionDisabledMessage(item)}
              currentUserId={currentUser?.id}
              isActive={isFeedFocused && isAppActive && activeVideoPostId === item.id}
              onComment={handleComment}
              onCommentInputFocus={handleCommentInputFocus}
              onDeleteComment={handleDeleteComment}
              onDeletePost={handleDeletePost}
              onFetchComments={handleFetchComments}
              onGiftClips={setGiftPost}
              onJoinTable={handleJoinTable}
              onOpenProfile={handleOpenProfile}
              onPromote={setPromotePost}
              onRequestVideoActive={setActiveVideoPostId}
              onShare={setSharePost}
              onShowToast={setFeedToast}
              onSupportChange={handleSupportChange}
              onUpdateComment={handleUpdateComment}
              onUpdatePost={handleUpdatePost}
              post={item}
            />
          )}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            viewabilityConfig={viewabilityConfig}
          />
        </SafeAreaView>
      </KeyboardSafeView>
      {!isKeyboardVisible ? (
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={styles.bottomNavigationSafeArea}
        >
          <MainPlatformNavigation />
        </SafeAreaView>
      ) : null}
      {feedToast ? (
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          pointerEvents="box-none"
          style={[
            styles.toastSafeArea,
            { bottom: isKeyboardVisible ? 16 : insets.bottom + 84 },
          ]}
        >
          <View
            accessibilityRole="alert"
            style={[
              styles.toast,
              feedToast.tone === 'success' ? styles.toastSuccess : styles.toastError,
            ]}
          >
            <Text style={styles.toastText}>{feedToast.message}</Text>
            <Pressable
              accessibilityLabel="Dismiss feed notification"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setFeedToast(null)}
              style={styles.toastDismiss}
            >
              <Text style={styles.toastDismissText}>×</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
      <ShareMenu
        chatRoomOptions={chatRoomShareOptions}
        friendOptions={friendShareOptions}
        onClose={() => setSharePost(null)}
        onPromote={() => setPromotePost(sharePost)}
        onShare={handleShare}
        post={sharePost}
        visible={Boolean(sharePost)}
      />
      <GiftClipsModal
        disabled={isSendingGift}
        loading={isSendingGift}
        onClose={() => setGiftPost(null)}
        onSendGift={handleSendGift}
        post={giftPost}
        sendLabelPrefix={isSendingGift ? 'Sending' : 'Send'}
        visible={Boolean(giftPost)}
      />
      <PromoteForCreatorPanel
        onClose={() => {
          setPromotePost(null);
          setPromotionPaymentState('idle');
        }}
        onPromote={handlePromote}
        paymentState={promotionPaymentState}
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
  feedContent: {
    gap: colors.spacing[16],
    padding: colors.spacing[20],
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
    gap: colors.spacing[16],
  },
  notificationCallout: {
    backgroundColor: 'rgba(54,231,255,0.12)',
    borderColor: colors.secondary,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  notificationCalloutLabel: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  notificationCalloutText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
  toast: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: colors.black,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  toastDismiss: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  toastDismissText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  toastError: {
    backgroundColor: 'rgba(170, 36, 36, 0.96)',
    borderColor: '#ff8a8a',
  },
  toastSafeArea: {
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  toastSuccess: {
    backgroundColor: 'rgba(20, 128, 74, 0.96)',
    borderColor: '#74d99f',
  },
  toastText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
});
