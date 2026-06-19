import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, type Socket } from 'socket.io-client';

import { ActionButton } from '../components/ActionButton';
import { confirmLeaveChatRoom } from '../components/confirmDestructiveAction';
import {
  AIPrimeActionPanel,
  type AIPrimeActionId,
  ChatInputBar,
  ChatMessageItem,
  defaultGameOptions,
  defaultTableRulesOptions,
  defaultTableTierOptions,
  RoomPlayerList,
  SetUpTableFlow,
} from '../components/chatRooms';
import { Screen } from '../components/Screen';
import { GiftClipsModal, type GiftClipsRecipientOption } from '../components/feed/GiftClipsModal';
import { env } from '../config/env';
import { useChatNotifications } from '../context/ChatNotificationProvider';
import { usePoker } from '../context/PokerProvider';
import { routes } from '../constants/routes';
import { fetchActiveChatRoomFriends, fetchChatRoom, inviteChatRoomFriends } from '../services/api/chatRooms';
import { uploadFeedMedia } from '../services/api/feed';
import { clearAuthSession, getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import { chatRoomSocketEvents } from '../services/chatRooms/events';
import type {
  AIPrimeActionRequest,
  AIPrimeActionResponse,
  ChatRoomMessageNotificationPayload,
  ChatRoomPlayerInvitedPayload,
  LaunchFromChatRoomPayload,
  ChatRoomSystemMessageRequest,
  ChatRoomSystemMessageResponse,
  ChatRoomPresencePayload,
  ChatRoomSocketAck,
  CreateTableFromAiPrimeRequest,
  CreateTableFromAiPrimeResponse,
  InviteRoomPlayersRequest,
  InviteRoomPlayersResponse,
  JoinChatRoomRequest,
  JoinChatRoomResponse,
  LeaveChatRoomRequest,
  NewChatRoomMessagePayload,
  SendChatRoomGiftClipRequest,
  SendChatRoomGiftClipResponse,
  SendChatRoomMessageRequest,
  SendChatRoomMessageResponse,
} from '../services/chatRooms/types';
import type { PokerGameSettingsUpdate } from '../services/poker';
import type { ChatRoom, ChatRoomFriend, ChatRoomMediaAttachment, ChatRoomMessage, ChatRoomPlayer } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoomDetail'>;

const chatDetailWatermarkIcon = require('../../assets/images/chat-watermark-icon.png');
const DIRECT_ACTION_MENU_BUTTON_SIZE = 36;
const DIRECT_ACTION_MENU_GAP = 8;
const DIRECT_ACTION_MENU_HEADER_SIDE_PADDING = 14;
const DIRECT_ACTION_MENU_OPEN_DURATION_MS = 180;
const DIRECT_ACTION_MENU_CLOSE_DURATION_MS = 120;

type ChatRoomTableRules = Pick<PokerGameSettingsUpdate, 'lowRule' | 'mode' | 'wildCards'>;

type ChatRoomNotificationRecord = {
  body?: string;
  chatRoomId?: string | null;
  data?: {
    invites?: ChatRoomTableInviteNotificationData[];
    launchedAt?: string;
    roomName?: string;
    senderDisplayName?: string;
    tableCode?: string | null;
    tableName?: string | null;
  } | null;
  tableId?: string | null;
  title?: string;
  type?: string;
  userId?: string;
};

type ChatRoomTableInviteNotificationData = {
  id?: string;
  message?: string | null;
  recipientAccountId?: string;
  status?: string;
};

type TableInviteDeliveryStatus = 'delivered' | 'failed' | 'invited' | 'launched' | 'pending';

type TableInviteDelivery = {
  delivered: boolean;
  error?: string | null;
  inviteId?: string;
  playerId: string;
  recipientName: string;
  status: TableInviteDeliveryStatus;
  tableCode?: string | null;
  tableId?: string | null;
  tableName?: string | null;
  updatedAt: string;
};

const fallbackUser = { id: 'signed-in-player', name: 'Player' };
const expiredSessionMessage = 'Your sign-in session expired. Sign in again to use realtime chat and room invites.';

const defaultRulesByTierId: Record<string, ChatRoomTableRules> = {
  '5k-casual': {
    lowRule: '8-or-better',
  },
  'free-training': {
    wildCards: [],
  },
  'private-study': {
    mode: 'HOSTEST',
    wildCards: [],
  },
};

function getGameIdFromRoomLabel(gameLabel?: string) {
  return gameLabel?.toLowerCase().includes('3-5-7') ? '3-5-7' : 'texas-holdem';
}

function getInviteEligiblePlayerIds(players: ChatRoomPlayer[], playerIds: string[], invitedPlayerIds: string[]) {
  const invitedIds = new Set(invitedPlayerIds);
  const eligibleIds = new Set(
    players
      .filter((player) => player.status === 'available' && !invitedIds.has(player.id))
      .map((player) => player.id),
  );

  return playerIds.filter((playerId) => eligibleIds.has(playerId));
}


function getPlayerIdsFromInvitePayload(payload: ChatRoomPlayerInvitedPayload) {
  return Array.from(new Set([
    ...(payload.invitedPlayerIds ?? []),
    ...(payload.playerIds ?? []),
    ...(payload.invitedPlayerId ? [payload.invitedPlayerId] : []),
    ...(payload.playerId ? [payload.playerId] : []),
  ].filter(Boolean)));
}

function getSuccessfulInvitePlayerIds(payload: ChatRoomPlayerInvitedPayload) {
  const successfulResultIds = payload.results?.filter((result) => result.ok || result.success).map((result) => result.playerId) ?? [];
  const payloadIds = payload.invitedPlayerIds ?? (payload.invitedPlayerId ? [payload.invitedPlayerId] : []);

  return Array.from(new Set([...(successfulResultIds.length > 0 ? successfulResultIds : payloadIds)].filter(Boolean)));
}

function getPlayerDisplayName(players: ChatRoomPlayer[], playerId: string, fallback?: string | null) {
  const player = players.find((candidate) => candidate.id === playerId || candidate.userId === playerId);
  return player?.displayName ?? fallback ?? `Player ${playerId.slice(-4)}`;
}

function getInviteRecipientName(payload: ChatRoomPlayerInvitedPayload, playerId: string, players: ChatRoomPlayer[]) {
  const invite = payload.invites?.find((candidate) => candidate.recipientAccountId === playerId)
    ?? (payload.invite?.recipientAccountId === playerId ? payload.invite : undefined);

  return getPlayerDisplayName(players, playerId, invite?.recipientLabel ?? invite?.recipientHandle ?? null);
}

function getInviteFailureReason(reason?: string) {
  if (!reason) {
    return null;
  }

  return reason
    .split('-')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function getDeliveredInviteSummary(deliveries: TableInviteDelivery[]) {
  const deliveredCount = deliveries.filter((delivery) => delivery.delivered).length;
  const failedCount = deliveries.filter((delivery) => delivery.status === 'failed').length;
  const latest = deliveries[0];

  if (!latest) {
    return null;
  }

  const tableLabel = latest.tableName ?? latest.tableCode ?? 'the table';
  const deliveredLabel = deliveredCount > 0 ? `${deliveredCount} delivered` : 'No realtime deliveries yet';
  const failedLabel = failedCount > 0 ? ` • ${failedCount} failed` : '';

  return `${deliveredLabel}${failedLabel} for ${tableLabel}.`;
}

function mergeTableInviteDeliveries(
  currentDeliveries: TableInviteDelivery[],
  incomingDeliveries: TableInviteDelivery[],
) {
  const deliveryByPlayerAndTable = new Map(
    currentDeliveries.map((delivery) => [`${delivery.playerId}:${delivery.tableId ?? delivery.tableCode ?? ''}`, delivery]),
  );

  incomingDeliveries.forEach((delivery) => {
    deliveryByPlayerAndTable.set(`${delivery.playerId}:${delivery.tableId ?? delivery.tableCode ?? ''}`, {
      ...deliveryByPlayerAndTable.get(`${delivery.playerId}:${delivery.tableId ?? delivery.tableCode ?? ''}`),
      ...delivery,
    });
  });

  return [...deliveryByPlayerAndTable.values()].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function isChatRoomNotificationRecord(notification: unknown): notification is ChatRoomNotificationRecord {
  return typeof notification === 'object' && notification !== null;
}

function getTierIdFromRoomConfig(room: ChatRoom | null) {
  if (room?.tableConfig.stakesLabel.toLowerCase().includes('5k')) {
    return '5k-casual';
  }

  return room?.tableConfig.isPrivate ? 'private-study' : 'free-training';
}

function normalizeSocketError(error: ChatRoomSocketAck['error']) {
  if (typeof error === 'string') {
    return error;
  }

  return error?.message ?? 'Realtime chat request failed.';
}

function isInvalidUserTokenMessage(message: string) {
  return /invalid user token|invalid player token|jwt expired|jwt malformed/i.test(message);
}

function isInvalidUserTokenError(error: unknown) {
  return error instanceof Error && isInvalidUserTokenMessage(error.message);
}

function mergeMessages(currentMessages: ChatRoomMessage[], incomingMessages: ChatRoomMessage[]) {
  const messageById = new Map(currentMessages.map((message) => [message.id, message]));

  incomingMessages.forEach((message) => {
    messageById.set(message.id, message);
  });

  return [...messageById.values()].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join('') || 'P'
  );
}

function getDirectRecipientName(room: ChatRoom) {
  return room.directRecipient?.displayName ?? room.title;
}

function getDirectRecipientId(room: ChatRoom, currentUserId: string) {
  const recipientId = room.directRecipientUserId ?? room.directRecipient?.userId ?? room.directRecipient?.id;

  if (recipientId) {
    return recipientId;
  }

  const recipientPlayer = room.players.find((player) => ![player.id, player.userId].filter(Boolean).includes(currentUserId));

  return recipientPlayer?.userId ?? recipientPlayer?.id ?? null;
}

function getDirectTableSetupPlayers(room: ChatRoom, currentUserId: string): ChatRoomPlayer[] {
  const recipientId = getDirectRecipientId(room, currentUserId);

  if (!recipientId) {
    return room.players;
  }

  const hasRecipientPlayer = room.players.some((player) => player.id === recipientId || player.userId === recipientId);

  if (hasRecipientPlayer) {
    return room.players;
  }

  const recipientName = getDirectRecipientName(room);

  return [
    {
      avatarInitials: room.directRecipient?.avatarInitials ?? getInitials(recipientName),
      chipStackLabel: 'Available',
      displayName: recipientName,
      handle: room.directRecipient?.handle ?? recipientName,
      id: recipientId,
      status: 'available' as const,
      userId: room.directRecipient?.userId ?? recipientId,
    },
    ...room.players,
  ];
}

export function ChatRoomDetailScreen({ navigation, route }: Props) {
  const { clearActiveRoom, markRoomRead, setActiveRoom } = useChatNotifications();

  useFocusEffect(useCallback(() => {
    setActiveRoom(route.params.roomId);
    void markRoomRead(route.params.roomId);
    return () => clearActiveRoom(route.params.roomId);
  }, [clearActiveRoom, markRoomRead, route.params.roomId, setActiveRoom]));
  const { roomState, sendTableInvite, transportKind } = usePoker();
  const socketRef = useRef<Socket | null>(null);
  const directMessageListRef = useRef<FlatList<ChatRoomMessage>>(null);
  const authRef = useRef<{ token: string | null; user: { id?: string; name?: string; email?: string } } | null>(null);
  const roomPlayersRef = useRef<ChatRoomPlayer[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [isRefreshingRoom, setIsRefreshingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeFriends, setActiveFriends] = useState<ChatRoomFriend[]>([]);
  const [isAIPrimePanelVisible, setIsAIPrimePanelVisible] = useState(false);
  const [isOpeningAIPrime, setIsOpeningAIPrime] = useState(false);
  const [isSetUpTableFlowVisible, setIsSetUpTableFlowVisible] = useState(false);
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<string[]>([]);
  const [roomInvitedFriendIds, setRoomInvitedFriendIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [selectedRoomFriendIds, setSelectedRoomFriendIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState('texas-holdem');
  const [selectedTierId, setSelectedTierId] = useState('free-training');
  const [selectedRuleId, setSelectedRuleId] = useState('friendly-holdem');
  const [selectedRules, setSelectedRules] = useState<ChatRoomTableRules>({});
  const [isLaunchingTable, setIsLaunchingTable] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const isSendingMessageRef = useRef(false);
  const [isGiftClipsModalVisible, setIsGiftClipsModalVisible] = useState(false);
  const [isSendingGiftClip, setIsSendingGiftClip] = useState(false);
  const [selectedGiftRecipientId, setSelectedGiftRecipientId] = useState<string | null>(null);
  const [isInvitingFriends, setIsInvitingFriends] = useState(false);
  const [isDirectActionDialogVisible, setIsDirectActionDialogVisible] = useState(false);
  const [isSendingDirectTableInvite, setIsSendingDirectTableInvite] = useState(false);
  const [directActionFeedback, setDirectActionFeedback] = useState<string | null>(null);
  const [directBottomInset, setDirectBottomInset] = useState(0);
  const [roomInviteStatus, setRoomInviteStatus] = useState<string | null>(null);
  const [tableInviteDeliveries, setTableInviteDeliveries] = useState<TableInviteDelivery[]>([]);
  const [tableInviteFeedback, setTableInviteFeedback] = useState<string | null>(null);
  const directActionDialogProgress = useRef(new Animated.Value(0)).current;
  const directActionDialogAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentUserId = authRef.current?.user.id ?? fallbackUser.id;
  const currentUserName = authRef.current?.user.name ?? authRef.current?.user.email ?? fallbackUser.name;


  useEffect(() => {
    roomPlayersRef.current = room?.players ?? [];
  }, [room?.players]);

  useEffect(() => () => {
    directActionDialogAnimationRef.current?.stop();
    directActionDialogProgress.stopAnimation();
  }, [directActionDialogProgress]);

  useEffect(() => {
    if (!room || room.messages.length === 0) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      directMessageListRef.current?.scrollToEnd({ animated: true });
    }, 0);

    return () => clearTimeout(timeout);
  }, [room, room?.messages.length]);

  function applyTableInvitePayload(payload: ChatRoomPlayerInvitedPayload) {
    const successfulPlayerIds = getSuccessfulInvitePlayerIds(payload);
    const allPlayerIds = getPlayerIdsFromInvitePayload(payload);
    const failedResults = payload.results?.filter((result) => !result.ok && !result.success) ?? [];
    const failedPlayerIds = failedResults.map((result) => result.playerId);
    const deliveredPlayerIds = new Set(payload.deliveredPlayerIds ?? []);
    const now = new Date().toISOString();
    const players = roomPlayersRef.current;
    const deliveries: TableInviteDelivery[] = [
      ...successfulPlayerIds.map((playerId) => ({
        delivered: deliveredPlayerIds.has(playerId) || payload.recipient === true,
        inviteId: payload.invites?.find((invite) => invite.recipientAccountId === playerId)?.id ?? payload.inviteId,
        playerId,
        recipientName: getInviteRecipientName(payload, playerId, players),
        status: deliveredPlayerIds.has(playerId) || payload.recipient === true ? ('delivered' as const) : ('invited' as const),
        tableCode: payload.tableCode,
        tableId: payload.tableDbId ?? payload.tableId,
        tableName: payload.tableName,
        updatedAt: now,
      })),
      ...failedResults.map((result) => ({
        delivered: false,
        error: getInviteFailureReason(result.reason),
        inviteId: result.inviteId,
        playerId: result.playerId,
        recipientName: getPlayerDisplayName(players, result.playerId),
        status: 'failed' as const,
        tableCode: payload.tableCode,
        tableId: payload.tableDbId ?? payload.tableId,
        tableName: payload.tableName,
        updatedAt: now,
      })),
    ];

    if (successfulPlayerIds.length > 0) {
      setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...successfulPlayerIds])));
      setSelectedPlayerIds((currentIds) => currentIds.filter((currentId) => !successfulPlayerIds.includes(currentId)));
    }

    if (deliveries.length > 0) {
      setTableInviteDeliveries((currentDeliveries) => mergeTableInviteDeliveries(currentDeliveries, deliveries));
    }

    const tableLabel = payload.tableName ?? payload.tableCode ?? 'the table';

    if (failedPlayerIds.length > 0) {
      const failedNames = failedPlayerIds.map((playerId) => getPlayerDisplayName(players, playerId)).join(', ');
      setTableInviteFeedback(`Invite failed for ${failedNames} (${tableLabel}).`);
      return;
    }

    if (successfulPlayerIds.length > 0 || allPlayerIds.length > 0) {
      const recipientNames = (successfulPlayerIds.length > 0 ? successfulPlayerIds : allPlayerIds)
        .map((playerId) => getInviteRecipientName(payload, playerId, players))
        .join(', ');
      const deliveredCount = payload.deliveredPlayerIds?.length ?? 0;
      setTableInviteFeedback(
        `${deliveredCount > 0 ? `${deliveredCount} delivered, ` : ''}${recipientNames} invited to ${tableLabel}.`,
      );
    }
  }

  function applyLaunchFromChatRoomPayload(payload: LaunchFromChatRoomPayload) {
    const launchedPlayerIds = payload.invitedPlayerIds ?? [];
    const deliveredPlayerIds = new Set(payload.deliveredPlayerIds ?? []);
    const now = new Date().toISOString();
    const deliveries = launchedPlayerIds.map((playerId) => ({
      delivered: deliveredPlayerIds.has(playerId),
      playerId,
      recipientName: getPlayerDisplayName(roomPlayersRef.current, playerId),
      status: deliveredPlayerIds.has(playerId) ? ('delivered' as const) : ('launched' as const),
      tableCode: payload.tableCode,
      tableId: payload.tableDbId ?? payload.tableId,
      tableName: payload.tableName,
      updatedAt: now,
    }));

    if (launchedPlayerIds.length > 0) {
      setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...launchedPlayerIds])));
    }

    if (deliveries.length > 0) {
      setTableInviteDeliveries((currentDeliveries) => mergeTableInviteDeliveries(currentDeliveries, deliveries));
    }

    const tableLabel = payload.tableName ?? payload.tableCode ?? 'the launched table';
    setTableInviteFeedback(
      payload.sender
        ? `${tableLabel} launched. ${payload.deliveredPlayerIds?.length ?? 0} invited player${payload.deliveredPlayerIds?.length === 1 ? '' : 's'} notified.`
        : `${tableLabel} launched from this chat room.`,
    );
  }

  function applyMessageNotificationPayload(payload: ChatRoomMessageNotificationPayload) {
    if (payload.message) {
      setRoom((currentRoom) => currentRoom ? {
        ...currentRoom,
        lastMessagePreview: payload.preview ?? payload.message?.body ?? currentRoom.lastMessagePreview,
        messages: mergeMessages(currentRoom.messages, [payload.message!]),
        unreadCount: payload.unreadCount ?? currentRoom.unreadCount,
      } : currentRoom);
    }

    if (!isChatRoomNotificationRecord(payload.notification)) {
      return;
    }

    const notification = payload.notification;
    const tableCode = notification.data?.tableCode ?? null;
    const tableName = notification.data?.tableName ?? null;
    const tableId = notification.tableId ?? null;

    if (notification.type === 'table_invite') {
      const now = new Date().toISOString();
      const deliveries = (notification.data?.invites ?? [])
        .filter((invite) => invite.recipientAccountId)
        .map((invite) => ({
          delivered: true,
          inviteId: invite.id,
          playerId: invite.recipientAccountId!,
          recipientName: getPlayerDisplayName(roomPlayersRef.current, invite.recipientAccountId!),
          status: 'delivered' as const,
          tableCode,
          tableId,
          tableName,
          updatedAt: now,
        }));

      if (deliveries.length > 0) {
        setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...deliveries.map((delivery) => delivery.playerId)])));
        setTableInviteDeliveries((currentDeliveries) => mergeTableInviteDeliveries(currentDeliveries, deliveries));
      }

      setTableInviteFeedback(payload.preview ?? notification.body ?? `Table invite delivered for ${tableName ?? tableCode ?? 'a table'}.`);
    }

    if (notification.type === 'table_launched_from_chat') {
      setTableInviteFeedback(payload.preview ?? notification.body ?? `${tableName ?? tableCode ?? 'A table'} launched from this room.`);
    }
  }

  function handleRealtimeAckError(ack: ChatRoomSocketAck) {
    const message = normalizeSocketError(ack.error);
    setRealtimeError(isInvalidUserTokenMessage(message) ? expiredSessionMessage : message);

    if (isInvalidUserTokenMessage(message)) {
      void clearAuthSession();
      authRef.current = { token: null, user: fallbackUser };
    }
  }

  function requireLiveChatSocket(actionLabel: string) {
    const token = authRef.current?.token;

    if (!room || !token || !socketRef.current?.connected) {
      setRealtimeError(`${actionLabel} requires a live room connection.`);
      return null;
    }

    return { room, socket: socketRef.current, token };
  }

  async function emitChatRoomEvent<Response extends ChatRoomSocketAck>(
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    const live = requireLiveChatSocket('AI Prime');

    if (!live) {
      return null;
    }

    try {
      const ack = await new Promise<Response>((resolve, reject) => {
        live.socket.timeout(10000).emit(
          eventName,
          { roomId: live.room.id, token: live.token, ...payload },
          (error: Error | null, response: Response) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(response);
          },
        );
      });

      if (!ack.ok && !ack.success) {
        handleRealtimeAckError(ack);
        return null;
      }

      setRealtimeError(null);
      return ack;
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : 'Realtime AI Prime request failed.');
      return null;
    }
  }

  const loadRoom = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingRoom(true);
    } else {
      setIsLoadingRoom(true);
    }
    setRoomError(null);

    try {
      const session = await getAuthSession();
      authRef.current = session
        ? { token: session.token, user: session.user as { id?: string; name?: string; email?: string } }
        : { token: null, user: fallbackUser };

      const nextRoom = await fetchChatRoom(route.params.roomId, session?.token ?? null);
      const nextGameId = getGameIdFromRoomLabel(nextRoom.tableConfig.gameLabel);
      const nextTierId = getTierIdFromRoomConfig(nextRoom);

      setRoom((currentRoom) => currentRoom ? {
        ...nextRoom,
        messages: mergeMessages(currentRoom.messages, nextRoom.messages),
      } : nextRoom);

      if (!isRefresh) {
        setIsPrivate(nextRoom.tableConfig.isPrivate);
        setSelectedGameId(nextGameId);
        setSelectedTierId(nextTierId);
        setSelectedRuleId(nextGameId === '3-5-7' ? '357-hostest' : nextTierId === '5k-casual' ? '8-or-better' : 'friendly-holdem');
        setSelectedRules({
          ...(defaultRulesByTierId[nextTierId] ?? {}),
          ...(nextGameId === '3-5-7' ? { mode: 'HOSTEST' } : {}),
        });
      }

      if (!session?.token) {
        setActiveFriends([]);
        return;
      }

      try {
        setActiveFriends(await fetchActiveChatRoomFriends(session.token));
      } catch (error) {
        setActiveFriends([]);

        if (isInvalidUserTokenError(error)) {
          await clearAuthSession();
          authRef.current = { token: null, user: fallbackUser };
          setRealtimeError(expiredSessionMessage);
          return;
        }

        setRoomInviteStatus(error instanceof Error ? error.message : 'Unable to load active friends.');
      }
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Unable to load chat room.');
    } finally {
      if (isRefresh) {
        setIsRefreshingRoom(false);
      } else {
        setIsLoadingRoom(false);
      }
    }
  }, [route.params.roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    let isMounted = true;

    async function connectRealtime() {
      const session = await getAuthSession();
      authRef.current = session
        ? { token: session.token, user: session.user as { id?: string; name?: string; email?: string } }
        : { token: null, user: fallbackUser };

      if (!session?.token) {
        setRealtimeError('Sign in to send realtime chat messages.');
        return;
      }

      if (!env.poker.socketUrl) {
        setRealtimeError('Realtime chat socket URL is not configured.');
        return;
      }

      const socket = io(env.poker.socketUrl, {
        autoConnect: false,
        reconnection: true,
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (!isMounted) {
          return;
        }

        setIsRealtimeConnected(true);
        setRealtimeError(null);
        socket.emit(
          chatRoomSocketEvents.joinRoom,
          { roomId: route.params.roomId, token: session.token } satisfies JoinChatRoomRequest,
          (ack: JoinChatRoomResponse = {}) => {
            if (!ack.ok && !ack.success) {
              const message = normalizeSocketError(ack.error);
              setRealtimeError(isInvalidUserTokenMessage(message) ? expiredSessionMessage : message);

              if (isInvalidUserTokenMessage(message)) {
                void clearAuthSession();
                authRef.current = { token: null, user: fallbackUser };
              }

              return;
            }

            if (ack.roomId) {
              setRoom((currentRoom) => currentRoom ? { ...currentRoom, id: ack.roomId ?? currentRoom.id } : currentRoom);
            }

            if (ack.messages?.length) {
              setRoom((currentRoom) => currentRoom ? { ...currentRoom, messages: mergeMessages(currentRoom.messages, ack.messages ?? []) } : currentRoom);
            }

            if (ack.players) {
              setRoom((currentRoom) => currentRoom ? { ...currentRoom, activePlayerCount: ack.players?.length ?? currentRoom.activePlayerCount, players: ack.players ?? currentRoom.players } : currentRoom);
            }
          },
        );
      });

      socket.on('disconnect', () => {
        if (isMounted) {
          setIsRealtimeConnected(false);
        }
      });
      socket.on('connect_error', (error) => {
        if (isMounted) {
          setRealtimeError(isInvalidUserTokenMessage(error.message) ? expiredSessionMessage : error.message);

          if (isInvalidUserTokenMessage(error.message)) {
            void clearAuthSession();
            authRef.current = { token: null, user: fallbackUser };
          }
        }
      });
      socket.on(chatRoomSocketEvents.error, (payload: ChatRoomSocketAck['error']) => {
        const message = normalizeSocketError(payload);
        setRealtimeError(isInvalidUserTokenMessage(message) ? expiredSessionMessage : message);

        if (isInvalidUserTokenMessage(message)) {
          void clearAuthSession();
          authRef.current = { token: null, user: fallbackUser };
        }
      });
      socket.on(chatRoomSocketEvents.newMessage, (payload: Partial<NewChatRoomMessagePayload>) => {
        if (!payload.message) {
          return;
        }

        setRoom((currentRoom) => currentRoom ? { ...currentRoom, messages: mergeMessages(currentRoom.messages, [payload.message!]), lastMessagePreview: payload.message!.kind === 'gift_clip' || payload.message!.messageType === 'gift_clip' ? `${payload.message!.authorName} sent Gift Clips` : payload.message!.body } : currentRoom);
      });
      socket.on(chatRoomSocketEvents.chatSystemMessage, (payload: Partial<NewChatRoomMessagePayload>) => {
        if (!payload.message) {
          return;
        }

        setRoom((currentRoom) => currentRoom ? {
          ...currentRoom,
          lastMessagePreview: payload.message!.body,
          messages: mergeMessages(currentRoom.messages, [payload.message!]),
        } : currentRoom);
      });
      socket.on(chatRoomSocketEvents.activePlayers, (payload: Partial<ChatRoomPresencePayload>) => {
        setRoom((currentRoom) => currentRoom ? { ...currentRoom, activePlayerCount: payload.activePlayerCount ?? payload.players?.length ?? currentRoom.activePlayerCount, players: payload.players ?? currentRoom.players } : currentRoom);
      });
      socket.on(chatRoomSocketEvents.presence, (payload: Partial<ChatRoomPresencePayload>) => {
        setRoom((currentRoom) => currentRoom ? { ...currentRoom, activePlayerCount: payload.activePlayerCount ?? payload.players?.length ?? currentRoom.activePlayerCount, players: payload.players ?? currentRoom.players } : currentRoom);
      });
      socket.on(chatRoomSocketEvents.messageNotification, (payload: ChatRoomMessageNotificationPayload) => {
        applyMessageNotificationPayload(payload);
      });
      socket.on(chatRoomSocketEvents.playerInvited, (payload: ChatRoomPlayerInvitedPayload) => {
        applyTableInvitePayload(payload);
      });
      socket.on(chatRoomSocketEvents.notificationTableInvite, (payload: ChatRoomPlayerInvitedPayload) => {
        applyTableInvitePayload(payload);
      });
      socket.on(chatRoomSocketEvents.launchFromChatRoom, (payload: LaunchFromChatRoomPayload) => {
        applyLaunchFromChatRoomPayload(payload);
      });

      socket.connect();
    }

    void connectRealtime();

    return () => {
      isMounted = false;
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.emit(chatRoomSocketEvents.leaveRoom, { roomId: route.params.roomId, token: authRef.current?.token } satisfies LeaveChatRoomRequest);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, [route.params.roomId]);

  const isolatedLaunchMetadata = useMemo(
    () => ({
      chatRoomId: room?.id ?? route.params.roomId,
      invitedPlayerIds,
      isPrivate,
      selectedPlayerIds,
      tableTierId: selectedTierId,
      transportKind,
    }),
    [invitedPlayerIds, isPrivate, room?.id, route.params.roomId, selectedPlayerIds, selectedTierId, transportKind],
  );

  const selectedTier = defaultTableTierOptions.find((option) => option.id === selectedTierId);
  const selectedRule = defaultTableRulesOptions.find((option) => option.id === selectedRuleId);
  const rulesSummary = selectedRule?.label ?? selectedTier?.rulesLabel ?? room?.tableConfig.stakesLabel ?? 'Room table rules';
  const giftClipRecipients = useMemo<GiftClipsRecipientOption[]>(() => {
    if (!room) {
      return [];
    }

    return room.players
      .filter((player) => {
        const candidateIds = [player.id, player.userId].filter(Boolean);

        return !candidateIds.includes(currentUserId);
      })
      .map((player) => ({
        id: player.userId ?? player.id,
        label: player.displayName,
        subtitle: player.handle,
      }));
  }, [currentUserId, room]);

  const inviteableFriends = useMemo(() => {
    if (!room) {
      return [];
    }

    const activeRoomPlayerIds = new Set(
      room.players.flatMap((player) => [player.id, player.userId].filter(Boolean) as string[]),
    );
    const invitedIds = new Set(roomInvitedFriendIds);

    return activeFriends.filter((friend) => !activeRoomPlayerIds.has(friend.id) && !invitedIds.has(friend.id));
  }, [activeFriends, room, roomInvitedFriendIds]);

  const isDirectChatRoom = room?.chatType === 'direct';
  const directRecipientId = room ? getDirectRecipientId(room, currentUserId) : null;
  const directRecipientName = room ? getDirectRecipientName(room) : 'Player';
  const chatHeaderTitle = isDirectChatRoom ? directRecipientName : room?.title ?? 'Chat room';
  const chatHeaderStatusLabel = room && !isDirectChatRoom
    ? `${room.topic} - ${isRealtimeConnected ? 'Live' : 'Connecting'} - ${room.activePlayerCount} active`
    : null;
  const directActiveTableCode = roomState?.roomId ?? null;
  const tableSetupPlayers = useMemo(
    () => (room?.chatType === 'direct' ? getDirectTableSetupPlayers(room, currentUserId) : room?.players ?? []),
    [currentUserId, room],
  );
  const directActionDialogAnimatedStyle = useMemo(() => ({
    opacity: directActionDialogProgress,
    transform: [
      {
        translateX: directActionDialogProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        translateY: directActionDialogProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-4, 0],
        }),
      },
      {
        scale: directActionDialogProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  }), [directActionDialogProgress]);

  if (isLoadingRoom) {
    return (
      <Screen showPlatformNavigation eyebrow="Chat room" title="Loading room" subtitle="Fetching live chat room data…" />
    );
  }

  if (!room) {
    return (
      <Screen
        showPlatformNavigation
        eyebrow="Chat room"
        onRefresh={() => { void loadRoom(true); }}
        refreshing={isRefreshingRoom}
        title="Room not found"
        subtitle={roomError ?? 'This social chat room is unavailable. Return to the chat room directory to pick another space.'}
      >
        <ActionButton
          fullWidth
          icon="chat-outline"
          label="Back to chat rooms"
          onPress={() => navigation.navigate(routes.ChatRooms)}
          variant="secondary"
        />
      </Screen>
    );
  }

  async function handleSendMessage(attachments: ChatRoomMediaAttachment[] = []) {
    const trimmedDraft = draft.trim();
    const token = authRef.current?.token;

    if ((!trimmedDraft && attachments.length === 0) || !room || !token || !socketRef.current?.connected || isSendingMessage || isSendingMessageRef.current) {
      return;
    }

    isSendingMessageRef.current = true;
    setIsSendingMessage(true);

    try {
      const ack = await new Promise<SendChatRoomMessageResponse>((resolve, reject) => {
        socketRef.current?.timeout(10000).emit(
          chatRoomSocketEvents.sendMessage,
          { attachments, body: trimmedDraft, roomId: room.id, token } satisfies SendChatRoomMessageRequest,
          (error: Error | null, response: SendChatRoomMessageResponse) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(response);
          },
        );
      });

      if (!ack.ok && !ack.success) {
        setRealtimeError(normalizeSocketError(ack.error));
        return;
      }

      setDraft('');
      setRealtimeError(null);
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : 'Unable to send chat message.');
    } finally {
      isSendingMessageRef.current = false;
      setIsSendingMessage(false);
    }
  }

  function handleOpenGiftClips() {
    const token = authRef.current?.token;

    if (!token) {
      setRealtimeError('Sign in to send Gift Clips.');
      return;
    }

    if (giftClipRecipients.length === 0) {
      setRealtimeError('No other room participants are available for Gift Clips right now.');
      return;
    }

    setSelectedGiftRecipientId((currentRecipientId) => currentRecipientId ?? giftClipRecipients[0]?.id ?? null);
    setRealtimeError(null);
    setIsGiftClipsModalVisible(true);
  }

  function animateDirectActionDialog(toValue: 0 | 1, onComplete?: () => void) {
    directActionDialogAnimationRef.current?.stop();
    directActionDialogAnimationRef.current = Animated.timing(directActionDialogProgress, {
      duration: toValue === 1 ? DIRECT_ACTION_MENU_OPEN_DURATION_MS : DIRECT_ACTION_MENU_CLOSE_DURATION_MS,
      easing: toValue === 1 ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      toValue,
      useNativeDriver: true,
    });

    directActionDialogAnimationRef.current.start(({ finished }) => {
      if (!finished) {
        return;
      }

      directActionDialogAnimationRef.current = null;
      onComplete?.();
    });
  }

  function handleOpenDirectActions() {
    setDirectActionFeedback(null);
    directActionDialogProgress.setValue(0);
    setIsDirectActionDialogVisible(true);
    animateDirectActionDialog(1);
  }

  function handleCloseDirectActions(onClosed?: () => void) {
    if (!isDirectActionDialogVisible) {
      onClosed?.();
      return;
    }

    animateDirectActionDialog(0, () => {
      setIsDirectActionDialogVisible(false);
      onClosed?.();
    });
  }

  async function handleInviteDirectRecipientToTable() {
    if (!directRecipientId) {
      setDirectActionFeedback('Unable to resolve this player for a table invite.');
      return;
    }

    if (!directActiveTableCode) {
      setDirectActionFeedback('Create or join a table before sending an invite.');
      return;
    }

    if (isSendingDirectTableInvite) {
      return;
    }

    setIsSendingDirectTableInvite(true);
    setDirectActionFeedback(null);

    try {
      await sendTableInvite({
        message: `Join my table ${directActiveTableCode}`,
        recipientAccountId: directRecipientId,
        source: 'friend-list',
      });
      handleCloseDirectActions();
    } catch (error) {
      setDirectActionFeedback(error instanceof Error ? error.message : `Unable to invite ${directRecipientName} to a table.`);
    } finally {
      setIsSendingDirectTableInvite(false);
    }
  }

  function handleOpenChatTableSetup() {
    setDirectActionFeedback(null);
    if (room?.chatType === 'direct') {
      setSelectedPlayerIds(directRecipientId ? [directRecipientId] : []);
      setIsPrivate(true);
    } else if (room) {
      setIsPrivate(room.tableConfig.isPrivate);
    }
    handleCloseDirectActions(() => setIsSetUpTableFlowVisible(true));
  }

  async function handleSendGiftClip(amount: number, message: string, recipientUserId?: string) {
    const token = authRef.current?.token;
    const resolvedRecipientUserId = recipientUserId ?? selectedGiftRecipientId;

    if (!room || !token || !resolvedRecipientUserId || !socketRef.current?.connected || isSendingGiftClip) {
      setRealtimeError('Gift Clips require a live room connection and selected recipient.');
      return;
    }

    setIsSendingGiftClip(true);

    try {
      const ack = await new Promise<SendChatRoomGiftClipResponse>((resolve, reject) => {
        socketRef.current?.timeout(10000).emit(
          chatRoomSocketEvents.sendGiftClip,
          { amount, message, recipientUserId: resolvedRecipientUserId, roomId: room.id, token } satisfies SendChatRoomGiftClipRequest,
          (error: Error | null, response: SendChatRoomGiftClipResponse) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(response);
          },
        );
      });

      if (!ack.ok && !ack.success) {
        const messageText = normalizeSocketError(ack.error);
        setRealtimeError(isInvalidUserTokenMessage(messageText) ? expiredSessionMessage : messageText);
        return;
      }

      if (ack.message) {
        setRoom((currentRoom) => currentRoom ? {
          ...currentRoom,
          lastMessagePreview: `${ack.message?.authorName ?? 'Player'} sent Gift Clips`,
          messages: mergeMessages(currentRoom.messages, [ack.message!]),
        } : currentRoom);
      }

      setIsGiftClipsModalVisible(false);
      setRealtimeError(null);
    } catch (error) {
      setRealtimeError(error instanceof Error ? error.message : 'Unable to send Gift Clips.');
    } finally {
      setIsSendingGiftClip(false);
    }
  }

  function handleTogglePlayerSelection(playerId: string) {
    if (!room) {
      return;
    }

    const eligiblePlayers = room.chatType === 'direct' ? tableSetupPlayers : room.players;
    const [eligiblePlayerId] = getInviteEligiblePlayerIds(eligiblePlayers, [playerId], invitedPlayerIds);

    if (!eligiblePlayerId) {
      return;
    }

    setSelectedPlayerIds((currentIds) =>
      currentIds.includes(eligiblePlayerId)
        ? currentIds.filter((currentId) => currentId !== eligiblePlayerId)
        : [...currentIds, eligiblePlayerId],
    );
  }

  function handleToggleRoomFriend(friendId: string) {
    setSelectedRoomFriendIds((currentIds) =>
      currentIds.includes(friendId)
        ? currentIds.filter((currentId) => currentId !== friendId)
        : [...currentIds, friendId],
    );
  }

  async function handleInviteFriendsToRoom() {
    const token = authRef.current?.token;

    if (!room || !token || selectedRoomFriendIds.length === 0 || isInvitingFriends) {
      return;
    }

    setIsInvitingFriends(true);
    setRoomInviteStatus(null);

    try {
      const result = await inviteChatRoomFriends(room.id, selectedRoomFriendIds, token);
      const invitedIds = result.invitedPlayerIds;

      if (result.room) {
        setRoom(result.room);
      }

      setRoomInvitedFriendIds((currentIds) => Array.from(new Set([...currentIds, ...invitedIds])));
      setSelectedRoomFriendIds([]);
      setRoomInviteStatus(
        invitedIds.length > 0
          ? `${invitedIds.length} friend${invitedIds.length === 1 ? '' : 's'} invited to this room.`
          : 'Selected friends were already in this room.',
      );
    } catch (error) {
      if (isInvalidUserTokenError(error)) {
        await clearAuthSession();
        authRef.current = { token: null, user: fallbackUser };
        setSelectedRoomFriendIds([]);
        setRoomInviteStatus(expiredSessionMessage);
      } else {
        setRoomInviteStatus(error instanceof Error ? error.message : 'Unable to invite friends to this room.');
      }
    } finally {
      setIsInvitingFriends(false);
    }
  }

  async function appendSystemMessage(body: string) {
    const ack = await emitChatRoomEvent<ChatRoomSystemMessageResponse>(
      chatRoomSocketEvents.chatSystemMessage,
      { body, senderDisplayName: 'AI Prime' } satisfies Omit<ChatRoomSystemMessageRequest, 'roomId' | 'token'>,
    );

    if (ack?.message) {
      setRoom((currentRoom) => currentRoom ? {
        ...currentRoom,
        lastMessagePreview: ack.message!.body,
        messages: mergeMessages(currentRoom.messages, [ack.message!]),
      } : currentRoom);
    }

    return ack;
  }

  async function handleInviteSelectedPlayers() {
    if (!room) {
      return;
    }

    const eligibleSelectedPlayerIds = getInviteEligiblePlayerIds(room.players, selectedPlayerIds, invitedPlayerIds);

    if (eligibleSelectedPlayerIds.length === 0) {
      setSelectedPlayerIds([]);
      return;
    }

    const ack = await appendSystemMessage(
      `AI Prime queued ${eligibleSelectedPlayerIds.length} room table invite${eligibleSelectedPlayerIds.length === 1 ? '' : 's'} for launch.`,
    );

    if (ack === null) {
      return;
    }

    const now = new Date().toISOString();
    const pendingDeliveries = eligibleSelectedPlayerIds.map((playerId) => ({
      delivered: false,
      playerId,
      recipientName: getPlayerDisplayName(room.players, playerId),
      status: 'pending' as const,
      tableCode: room.tableConfig.tableCode,
      tableId: null,
      tableName: `${room.title} Table`,
      updatedAt: now,
    }));

    setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...eligibleSelectedPlayerIds])));
    setTableInviteDeliveries((currentDeliveries) => mergeTableInviteDeliveries(currentDeliveries, pendingDeliveries));
    setTableInviteFeedback(
      `${eligibleSelectedPlayerIds.map((playerId) => getPlayerDisplayName(room.players, playerId)).join(', ')} queued for ${room.title} Table.`,
    );
    setSelectedPlayerIds((currentIds) =>
      currentIds.filter((currentId) => !eligibleSelectedPlayerIds.includes(currentId)),
    );
  }

  function handleSelectGame(gameId: string) {
    setSelectedGameId(gameId);

    if (gameId === '3-5-7') {
      setSelectedRuleId('357-hostest');
      setSelectedRules({ mode: 'HOSTEST', wildCards: [] });
      return;
    }

    setSelectedRuleId('friendly-holdem');
    setSelectedRules({});
  }

  function handleSelectTier(tierId: string) {
    setSelectedTierId(tierId);
    if (tierId === '5k-casual') {
      setSelectedRuleId('8-or-better');
    }
    setSelectedRules((currentRules) => ({
      ...currentRules,
      ...(defaultRulesByTierId[tierId] ?? {}),
    }));
  }

  function handleSelectRules(rules: ChatRoomTableRules) {
    const matchingRule = defaultTableRulesOptions.find((option) => JSON.stringify(option.value) === JSON.stringify(rules));
    setSelectedRuleId(matchingRule?.id ?? 'friendly-holdem');
    setSelectedRules(rules);
  }

  async function handleSelectAIPrimeAction(actionId: AIPrimeActionId) {
    if (actionId !== 'setUpTable') {
      await emitChatRoomEvent<AIPrimeActionResponse>(
        chatRoomSocketEvents.aiPrimeAction,
        { actionId } satisfies Omit<AIPrimeActionRequest, 'roomId' | 'token'>,
      );
      setIsAIPrimePanelVisible(false);
      return;
    }

    const ack = await emitChatRoomEvent<AIPrimeActionResponse>(
      chatRoomSocketEvents.aiPrimeSetUpTable,
      {
        actionId,
        tableTierId: selectedTierId,
        visibility: isPrivate ? 'private' : 'room',
      } satisfies Omit<AIPrimeActionRequest, 'roomId' | 'token'>,
    );

    if (ack) {
      setIsAIPrimePanelVisible(false);
      setIsSetUpTableFlowVisible(true);
    }
  }

  async function handleOpenAIPrime() {
    if (isOpeningAIPrime) {
      return;
    }

    setIsOpeningAIPrime(true);

    try {
      const ack = await emitChatRoomEvent<AIPrimeActionResponse>(chatRoomSocketEvents.aiPrimeOpen, {});

      if (ack) {
        setIsAIPrimePanelVisible(true);
      }
    } finally {
      setIsOpeningAIPrime(false);
    }
  }

  async function handleLaunchTable() {
    if (!room || isLaunchingTable) {
      return;
    }

    const live = requireLiveChatSocket('Launching an AI Prime table');

    if (!live) {
      return;
    }

    const gameSettings: PokerGameSettingsUpdate = {
      game: selectedGameId === '3-5-7' ? '357' : 'holdem',
      ...(selectedGameId === '3-5-7' ? { mode: selectedRules.mode ?? 'HOSTEST' } : {}),
      ...(selectedRules.lowRule ? { lowRule: selectedRules.lowRule } : {}),
      ...(selectedRules.wildCards ? { wildCards: selectedRules.wildCards } : {}),
    };
    const allInviteIds = Array.from(new Set([...invitedPlayerIds, ...selectedPlayerIds]));

    setIsLaunchingTable(true);

    try {
      const launchAcknowledgement = await emitChatRoomEvent<CreateTableFromAiPrimeResponse>(
        chatRoomSocketEvents.createTableFromAiPrime,
        {
          chatRoomId: isolatedLaunchMetadata.chatRoomId,
          gameSettings,
          invitedPlayerIds: allInviteIds,
          name: currentUserName,
          playerCount: room.tableConfig.maxSeats,
          tableName: `${room.title} Table`,
          tableTierId: selectedTierId,
          visibility: isPrivate ? 'private' : 'room',
        } satisfies Omit<CreateTableFromAiPrimeRequest, 'roomId' | 'token'>,
      );

      if (!launchAcknowledgement) {
        return;
      }

      const launchedTableId = launchAcknowledgement.tableDbId ?? launchAcknowledgement.tableId;

      if (allInviteIds.length > 0 && launchedTableId) {
        const inviteAcknowledgement = await emitChatRoomEvent<InviteRoomPlayersResponse>(
          chatRoomSocketEvents.inviteRoomPlayers,
          {
            alreadyInvitedPlayerIds: [],
            invitedPlayerIds: allInviteIds,
            message: `AI Prime invited you to ${launchAcknowledgement.tableName ?? room.title}.`,
            playerIds: allInviteIds,
            source: 'ai-prime',
            tableCode: launchAcknowledgement.tableCode,
            tableId: launchedTableId,
          } satisfies Omit<InviteRoomPlayersRequest, 'roomId' | 'token'> & { source: string },
        );

        if (inviteAcknowledgement) {
          applyTableInvitePayload(inviteAcknowledgement);
        }
      }

      setSelectedPlayerIds([]);
      setIsSetUpTableFlowVisible(false);
      navigation.navigate(routes.Game);
    } finally {
      setIsLaunchingTable(false);
    }
  }

  function handleLeaveChatRoom() {
    if (!room) {
      return;
    }

    confirmLeaveChatRoom(room.title, () => {
      socketRef.current?.emit(
        chatRoomSocketEvents.leaveRoom,
        { roomId: room.id, token: authRef.current?.token } satisfies LeaveChatRoomRequest,
      );
      navigation.goBack();
    });
  }

  if (room.chatType === 'direct') {
    return (
      <Screen
        bodyStyle={styles.directScreenBody}
        contentStyle={styles.directScreenContent}
        scrollable={false}
        title=""
        topSafeAreaScale={0}
      >
        <View style={styles.directChatRoot}>
          <View pointerEvents="none" style={styles.chatDetailWatermarkLayer}>
            <Image
              resizeMode="contain"
              source={chatDetailWatermarkIcon}
              style={styles.chatDetailWatermarkIcon}
            />
          </View>

          <View style={styles.directHeader}>
            <Text numberOfLines={1} style={styles.directHeaderTitle}>{directRecipientName}</Text>
            <Pressable
              accessibilityLabel="Open chat actions"
              accessibilityRole="button"
              onPress={handleOpenDirectActions}
              style={({ pressed }) => [styles.directHeaderAction, pressed ? styles.pressed : null]}
            >
              <MaterialCommunityIcons color={colors.text} name="dots-vertical" size={22} />
            </Pressable>
          </View>

          {isDirectActionDialogVisible ? (
            <View style={styles.directActionOverlay}>
              <Pressable
                accessibilityLabel="Close chat actions"
                accessibilityRole="button"
                onPress={() => handleCloseDirectActions()}
                style={styles.directActionDismissLayer}
              />
              <Animated.View style={[styles.directDialogCard, directActionDialogAnimatedStyle]}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!directActiveTableCode || !directRecipientId || isSendingDirectTableInvite}
                  onPress={() => { void handleInviteDirectRecipientToTable(); }}
                  style={({ pressed }) => [
                    styles.directDialogAction,
                    !directActiveTableCode || !directRecipientId ? styles.directDialogActionDisabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialCommunityIcons color={colors.success} name="cards-playing-outline" size={21} />
                  <View style={styles.directDialogActionCopy}>
                    <Text style={styles.directDialogActionText}>
                      {isSendingDirectTableInvite ? 'Sending invite...' : 'Invite to a table'}
                    </Text>
                    {!directActiveTableCode ? (
                      <Text style={styles.directDialogHelper}>Create or join a table before inviting.</Text>
                    ) : null}
                    {directActiveTableCode && !directRecipientId ? (
                      <Text style={styles.directDialogHelper}>Player invite target unavailable.</Text>
                    ) : null}
                    {directActiveTableCode ? (
                      <Text style={styles.directDialogHelper}>Active table {directActiveTableCode}</Text>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleOpenChatTableSetup}
                  style={({ pressed }) => [styles.directDialogAction, pressed ? styles.pressed : null]}
                >
                  <MaterialCommunityIcons color={colors.primary} name="table-plus" size={21} />
                  <View style={styles.directDialogActionCopy}>
                    <Text style={styles.directDialogActionText}>Create a table</Text>
                  </View>
                </Pressable>
                {directActionFeedback ? <Text style={styles.directDialogFeedback}>{directActionFeedback}</Text> : null}
              </Animated.View>
            </View>
          ) : null}

          <FlatList
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[styles.directMessageListContent, { paddingBottom: directBottomInset + 12 }]}
            data={room.messages}
            keyExtractor={(message) => message.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => directMessageListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => directMessageListRef.current?.scrollToEnd({ animated: false })}
            ref={directMessageListRef}
            renderItem={({ item }) => (
              <ChatMessageItem
                chatType={room.chatType}
                currentUserId={currentUserId}
                message={item}
                players={room.players}
              />
            )}
            showsVerticalScrollIndicator={false}
            style={styles.directMessageList}
          />

          <View
            onLayout={({ nativeEvent }) => {
              const nextHeight = nativeEvent.layout.height;
              setDirectBottomInset((currentHeight) => Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight);
            }}
            style={styles.directBottomStack}
          >
            {roomError || realtimeError ? (
              <View style={styles.directErrorBanner}>
                {roomError ? <Text style={styles.errorText}>{roomError}</Text> : null}
                {realtimeError ? <Text style={styles.errorText}>{realtimeError}</Text> : null}
              </View>
            ) : null}

            <View style={styles.directComposerWrap}>
              <ChatInputBar
                draft={draft}
                onChangeDraft={setDraft}
                onOpenGiftClips={handleOpenGiftClips}
                onOpenAIPrime={() => { void handleOpenAIPrime(); }}
                onSend={(attachments) => { void handleSendMessage(attachments); }}
                onUploadAttachment={async (attachment) => uploadFeedMedia(attachment, authRef.current?.token ?? '') as Promise<ChatRoomMediaAttachment>}
                openingAIPrime={isOpeningAIPrime}
                placeholder={isSendingMessage ? 'Sending...' : 'Message'}
                sending={isSendingMessage}
                variant="direct"
              />
            </View>
          </View>

          <AIPrimeActionPanel
            visible={isAIPrimePanelVisible}
            onClose={() => setIsAIPrimePanelVisible(false)}
            onSelectAction={handleSelectAIPrimeAction}
          />

          <GiftClipsModal
            disabled={!selectedGiftRecipientId || isSendingGiftClip}
            helperText="Send Gift Clips directly to another participant in this room."
            onClose={() => setIsGiftClipsModalVisible(false)}
            onSelectRecipient={setSelectedGiftRecipientId}
            onSendGift={(amount, message, recipientId) => handleSendGiftClip(amount, message, recipientId)}
            loading={isSendingGiftClip}
            post={null}
            recipientOptions={giftClipRecipients}
            selectedRecipientId={selectedGiftRecipientId}
            sendLabelPrefix={isSendingGiftClip ? 'Sending' : 'Send'}
            title="Send Gift Clips in chat"
            visible={isGiftClipsModalVisible}
          />

          <SetUpTableFlow
            gameOptions={defaultGameOptions}
            invitedPlayerIds={invitedPlayerIds}
            isLaunching={isLaunchingTable}
            isPrivate={isPrivate}
            onClose={() => setIsSetUpTableFlowVisible(false)}
            onConfirmSetup={() => { void handleLaunchTable(); }}
            onSelectGame={handleSelectGame}
            onSelectRules={handleSelectRules}
            onSelectTier={handleSelectTier}
            onTogglePlayerSelection={handleTogglePlayerSelection}
            onTogglePrivacy={setIsPrivate}
            players={tableSetupPlayers}
            rulesSummary={rulesSummary}
            selectedGameId={selectedGameId}
            selectedPlayerIds={selectedPlayerIds}
            selectedRuleId={selectedRuleId}
            selectedTierId={selectedTierId}
            visible={isSetUpTableFlowVisible}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      bodyStyle={styles.directScreenBody}
      contentStyle={styles.directScreenContent}
      scrollable={false}
      title=""
      topSafeAreaScale={0}
    >
      <View style={styles.directChatRoot}>
        <View pointerEvents="none" style={styles.chatDetailWatermarkLayer}>
          <Image
            resizeMode="contain"
            source={chatDetailWatermarkIcon}
            style={styles.chatDetailWatermarkIcon}
          />
        </View>

        <View style={styles.directHeader}>
          <View style={styles.directHeaderTitleGroup}>
            <Text numberOfLines={1} style={styles.directHeaderTitle}>{chatHeaderTitle}</Text>
            {chatHeaderStatusLabel ? (
              <Text numberOfLines={1} style={styles.directHeaderSubtitle}>{chatHeaderStatusLabel}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Open room actions"
            accessibilityRole="button"
            onPress={handleOpenDirectActions}
            style={({ pressed }) => [styles.directHeaderAction, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.text} name="dots-vertical" size={22} />
          </Pressable>
        </View>
        {isDirectActionDialogVisible ? (
          <View style={styles.directActionOverlay}>
            <Pressable
              accessibilityLabel="Close room actions"
              accessibilityRole="button"
              onPress={() => handleCloseDirectActions()}
              style={styles.directActionDismissLayer}
            />
            <Animated.View style={[styles.directDialogCard, directActionDialogAnimatedStyle]}>
              <Pressable
                accessibilityRole="button"
                onPress={handleOpenChatTableSetup}
                style={({ pressed }) => [styles.directDialogAction, pressed ? styles.pressed : null]}
              >
                <MaterialCommunityIcons color={colors.success} name="cards-playing-outline" size={21} />
                <View style={styles.directDialogActionCopy}>
                  <Text style={styles.directDialogActionText}>Invite to a table</Text>
                  <Text style={styles.directDialogHelper}>Choose room players in setup.</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleOpenChatTableSetup}
                style={({ pressed }) => [styles.directDialogAction, pressed ? styles.pressed : null]}
              >
                <MaterialCommunityIcons color={colors.primary} name="table-plus" size={21} />
                <View style={styles.directDialogActionCopy}>
                  <Text style={styles.directDialogActionText}>Create a table</Text>
                  <Text style={styles.directDialogHelper}>Configure game, rules, and room visibility.</Text>
                </View>
              </Pressable>
              {room.canLeave ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleCloseDirectActions(handleLeaveChatRoom)}
                  style={({ pressed }) => [styles.directDialogAction, pressed ? styles.pressed : null]}
                >
                  <MaterialCommunityIcons color={colors.danger} name="exit-to-app" size={21} />
                  <View style={styles.directDialogActionCopy}>
                    <Text style={styles.directDialogActionText}>Leave chat room</Text>
                  </View>
                </Pressable>
              ) : null}
              {directActionFeedback ? <Text style={styles.directDialogFeedback}>{directActionFeedback}</Text> : null}
            </Animated.View>
          </View>
        ) : null}

        <FlatList
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.directMessageListContent, { paddingBottom: directBottomInset + 12 }]}
          data={room.messages}
          keyExtractor={(message) => message.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyMessageText}>No messages yet. Start the conversation.</Text>}
          ListHeaderComponent={(
            <View style={styles.roomToolsPanel}>
              <View style={styles.roomToolsHeader}>
                <View style={styles.roomToolsTitleGroup}>
                  <Text style={styles.subsectionTitle}>Active players</Text>
                  <Text style={styles.roomToolsMeta}>{room.description}</Text>
                </View>
                <View style={styles.roomActivePill}>
                  <MaterialCommunityIcons color={colors.success} name="account-group" size={15} />
                  <Text style={styles.roomActivePillText}>{room.activePlayerCount}</Text>
                </View>
              </View>
              <RoomPlayerList
                invitedPlayerIds={invitedPlayerIds}
                onTogglePlayer={handleTogglePlayerSelection}
                players={room.players}
                selectedPlayerIds={selectedPlayerIds}
              />
        {tableInviteFeedback || tableInviteDeliveries.length > 0 ? (
          <View style={styles.tableInviteStatusCard}>
            <Text style={styles.subsectionTitle}>Table invite delivery</Text>
            {tableInviteFeedback ? <Text style={styles.helperText}>{tableInviteFeedback}</Text> : null}
            {getDeliveredInviteSummary(tableInviteDeliveries) ? (
              <Text style={styles.helperText}>{getDeliveredInviteSummary(tableInviteDeliveries)}</Text>
            ) : null}
            <View style={styles.tableInviteDeliveryStack}>
              {tableInviteDeliveries.slice(0, 6).map((delivery) => (
                <View key={`${delivery.playerId}:${delivery.tableId ?? delivery.tableCode ?? delivery.updatedAt}`} style={styles.tableInviteDeliveryRow}>
                  <View style={styles.tableInviteDeliveryCopy}>
                    <Text style={styles.tableInviteRecipient}>{delivery.recipientName}</Text>
                    <Text style={styles.tableInviteMeta}>
                      {[delivery.tableName, delivery.tableCode ? `Code ${delivery.tableCode}` : null].filter(Boolean).join(' - ')}
                    </Text>
                    {delivery.error ? <Text style={styles.tableInviteError}>{delivery.error}</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.tableInvitePill,
                      delivery.status === 'failed' ? styles.tableInvitePillFailed : null,
                      delivery.delivered ? styles.tableInvitePillDelivered : null,
                    ]}
                  >
                    {delivery.status === 'failed'
                      ? 'Failed'
                      : delivery.delivered
                        ? 'Delivered'
                        : delivery.status === 'pending'
                          ? 'Queued'
                          : delivery.status === 'launched'
                            ? 'Launched'
                            : 'Invited'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.roomInviteStack}>
          <Text style={styles.subsectionTitle}>Invite active friends</Text>
          {!authRef.current?.token ? (
            <Text style={styles.helperText}>Sign in to invite friends to this room.</Text>
          ) : inviteableFriends.length > 0 ? (
            <View style={styles.friendChipWrap}>
              {inviteableFriends.map((friend) => {
                const selected = selectedRoomFriendIds.includes(friend.id);

                return (
                  <Pressable
                    accessibilityLabel={`${selected ? 'Remove' : 'Invite'} ${friend.displayName}`}
                    accessibilityRole="button"
                    key={friend.id}
                    onPress={() => handleToggleRoomFriend(friend.id)}
                    style={({ pressed }) => [
                      styles.friendChip,
                      selected ? styles.friendChipSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.friendChipText, selected ? styles.friendChipTextSelected : null]}>
                      {friend.displayName}
                    </Text>
                    <Text style={styles.friendChipHandle}>{friend.handle}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helperText}>No active friends are available to invite right now.</Text>
          )}
          {roomInviteStatus ? <Text style={styles.helperText}>{roomInviteStatus}</Text> : null}
          <ActionButton
            compact
            disabled={selectedRoomFriendIds.length === 0 || isInvitingFriends}
            icon="account-multiple-plus-outline"
            label={isInvitingFriends ? 'Inviting...' : 'Invite to room'}
            loading={isInvitingFriends}
            onPress={() => { void handleInviteFriendsToRoom(); }}
            tone="success"
          />
              </View>
            </View>
          )}
          onContentSizeChange={() => directMessageListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => directMessageListRef.current?.scrollToEnd({ animated: false })}
          ref={directMessageListRef}
          renderItem={({ item }) => (
            <ChatMessageItem
              chatType={room.chatType}
              currentUserId={currentUserId}
              message={item}
              players={room.players}
            />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.directMessageList}
        />

        <View
          onLayout={({ nativeEvent }) => {
            const nextHeight = nativeEvent.layout.height;
            setDirectBottomInset((currentHeight) => Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight);
          }}
          style={styles.directBottomStack}
        >
          {roomError || realtimeError ? (
            <View style={styles.directErrorBanner}>
              {roomError ? <Text style={styles.errorText}>{roomError}</Text> : null}
              {realtimeError ? <Text style={styles.errorText}>{realtimeError}</Text> : null}
            </View>
          ) : null}

          <View style={styles.directComposerWrap}>
            <ChatInputBar
              draft={draft}
              onChangeDraft={setDraft}
              onOpenGiftClips={handleOpenGiftClips}
              onOpenAIPrime={() => { void handleOpenAIPrime(); }}
              onSend={(attachments) => { void handleSendMessage(attachments); }}
              onUploadAttachment={async (attachment) => uploadFeedMedia(attachment, authRef.current?.token ?? '') as Promise<ChatRoomMediaAttachment>}
              openingAIPrime={isOpeningAIPrime}
              placeholder={isSendingMessage ? 'Sending...' : 'Message'}
              sending={isSendingMessage}
              variant="direct"
            />
          </View>
        </View>

      <AIPrimeActionPanel
        visible={isAIPrimePanelVisible}
        onClose={() => setIsAIPrimePanelVisible(false)}
        onSelectAction={handleSelectAIPrimeAction}
      />

      <GiftClipsModal
        disabled={!selectedGiftRecipientId || isSendingGiftClip}
        helperText="Send Gift Clips directly to another participant in this room."
        onClose={() => setIsGiftClipsModalVisible(false)}
        onSelectRecipient={setSelectedGiftRecipientId}
        onSendGift={(amount, message, recipientId) => handleSendGiftClip(amount, message, recipientId)}
        loading={isSendingGiftClip}
        post={null}
        recipientOptions={giftClipRecipients}
        selectedRecipientId={selectedGiftRecipientId}
        sendLabelPrefix={isSendingGiftClip ? 'Sending' : 'Send'}
        title="Send Gift Clips in chat"
        visible={isGiftClipsModalVisible}
      />

      <SetUpTableFlow
        gameOptions={defaultGameOptions}
        invitedPlayerIds={invitedPlayerIds}
        isLaunching={isLaunchingTable}
        isPrivate={isPrivate}
        onClose={() => setIsSetUpTableFlowVisible(false)}
        onConfirmSetup={() => { void handleLaunchTable(); }}
        onSelectGame={handleSelectGame}
        onSelectRules={handleSelectRules}
        onSelectTier={handleSelectTier}
        onTogglePlayerSelection={handleTogglePlayerSelection}
        onTogglePrivacy={setIsPrivate}
        players={tableSetupPlayers}
        rulesSummary={rulesSummary}
        selectedGameId={selectedGameId}
        selectedPlayerIds={selectedPlayerIds}
        selectedRuleId={selectedRuleId}
        selectedTierId={selectedTierId}
        visible={isSetUpTableFlowVisible}
      />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chatDetailWatermarkIcon: {
    height: 260,
    opacity: 0.100,
    width: 260,
  },
  chatDetailWatermarkLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directChatRoot: {
    alignSelf: 'stretch',
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
  directBottomStack: {
    backgroundColor: colors.background,
    bottom: 0,
    left: 0,
    paddingBottom: 45,
    position: 'absolute',
    right: 0,
  },
  directComposerWrap: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  directActionDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  directActionOverlay: {
    ...StyleSheet.absoluteFillObject,
    elevation: 20,
    zIndex: 20,
  },
  directDialogAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  directDialogActionCopy: {
    flex: 1,
    gap: 3,
  },
  directDialogActionDisabled: {
    opacity: 0.5,
  },
  directDialogActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  directDialogCard: {
    ...colors.shadows.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    maxWidth: '75%',
    padding: 8,
    position: 'absolute',
    right: DIRECT_ACTION_MENU_HEADER_SIDE_PADDING + DIRECT_ACTION_MENU_BUTTON_SIZE + DIRECT_ACTION_MENU_GAP,
    top: 8,
    width: 252,
    zIndex: 2,
  },
  directDialogFeedback: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  directDialogHelper: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  directErrorBanner: {
    backgroundColor: 'rgba(255,91,110,0.10)',
    borderColor: colors.danger,
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  directHeader: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  directHeaderAction: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  directHeaderSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  directHeaderTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
  },
  directHeaderTitleGroup: {
    flex: 1,
    gap: 1,
  },
  directMessageList: {
    flex: 1,
    width: '100%',
  },
  directMessageListContent: {
    gap: 10,
    paddingHorizontal: 5,
    paddingVertical: 12,
  },
  directScreenBody: {
    alignSelf: 'stretch',
    flex: 1,
    gap: 0,
    width: '100%',
  },
  directScreenContent: {
    alignSelf: 'stretch',
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    rowGap: 0,
    width: '100%',
  },
  emptyMessageText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  friendChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  friendChipHandle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  friendChipSelected: {
    backgroundColor: colors.successTint,
    borderColor: colors.success,
  },
  friendChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  friendChipTextSelected: {
    color: colors.success,
  },
  friendChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  messageStack: {
    gap: 10,
  },
  pressed: {
    opacity: 0.78,
  },
  roomActivePill: {
    alignItems: 'center',
    backgroundColor: colors.successTint,
    borderColor: colors.success,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  roomActivePillText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
  },
  roomInviteStack: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  roomToolsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  roomToolsMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  roomToolsPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 4,
    padding: 12,
  },
  roomToolsTitleGroup: {
    flex: 1,
    gap: 3,
  },
  tableInviteDeliveryCopy: {
    flex: 1,
    gap: 3,
  },
  tableInviteDeliveryRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  tableInviteDeliveryStack: {
    gap: 8,
  },
  tableInviteError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  tableInviteMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  tableInvitePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tableInvitePillDelivered: {
    backgroundColor: colors.successTint,
    borderColor: colors.success,
    color: colors.success,
  },
  tableInvitePillFailed: {
    backgroundColor: colors.destructivePanel,
    borderColor: colors.danger,
    color: colors.danger,
  },
  tableInviteRecipient: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  tableInviteStatusCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
});
