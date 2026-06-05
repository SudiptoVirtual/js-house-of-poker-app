import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, type Socket } from 'socket.io-client';

import { ActionButton } from '../components/ActionButton';
import {
  AIPrimeActionPanel,
  type AIPrimeActionId,
  ChatInputBar,
  ChatMessageItem,
  ChatRoomHeader,
  defaultGameOptions,
  defaultTableRulesOptions,
  defaultTableTierOptions,
  RoomPlayerList,
  SetUpTableFlow,
} from '../components/chatRooms';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { GiftClipsModal, type GiftClipsRecipientOption } from '../components/feed/GiftClipsModal';
import { env } from '../config/env';
import { usePoker } from '../context/PokerProvider';
import { routes } from '../constants/routes';
import { fetchActiveChatRoomFriends, fetchChatRoom, inviteChatRoomFriends } from '../services/api/chatRooms';
import { clearAuthSession, getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { PokerGameSettingsUpdate } from '../services/poker';
import type { ChatRoom, ChatRoomFriend, ChatRoomMessage, ChatRoomPlayer } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoomDetail'>;

type ChatRoomTableRules = Pick<PokerGameSettingsUpdate, 'lowRule' | 'mode' | 'wildCards'>;
type ChatRoomSocketAck = {
  error?: string | { message?: string };
  message?: ChatRoomMessage;
  messages?: ChatRoomMessage[];
  ok?: boolean;
  players?: ChatRoomPlayer[];
  roomId?: string;
  success?: boolean;
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

export function ChatRoomDetailScreen({ navigation, route }: Props) {
  const { createTableFromChatRoom, errorMessage, transportKind } = usePoker();
  const socketRef = useRef<Socket | null>(null);
  const authRef = useRef<{ token: string | null; user: { id?: string; name?: string; email?: string } } | null>(null);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeFriends, setActiveFriends] = useState<ChatRoomFriend[]>([]);
  const [isAIPrimePanelVisible, setIsAIPrimePanelVisible] = useState(false);
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
  const [isGiftClipsModalVisible, setIsGiftClipsModalVisible] = useState(false);
  const [isSendingGiftClip, setIsSendingGiftClip] = useState(false);
  const [selectedGiftRecipientId, setSelectedGiftRecipientId] = useState<string | null>(null);
  const [isInvitingFriends, setIsInvitingFriends] = useState(false);
  const [roomInviteStatus, setRoomInviteStatus] = useState<string | null>(null);
  const currentUserId = authRef.current?.user.id ?? fallbackUser.id;
  const currentUserName = authRef.current?.user.name ?? authRef.current?.user.email ?? fallbackUser.name;

  const loadRoom = useCallback(async () => {
    setIsLoadingRoom(true);
    setRoomError(null);

    try {
      const session = await getAuthSession();
      authRef.current = session
        ? { token: session.token, user: session.user as { id?: string; name?: string; email?: string } }
        : { token: null, user: fallbackUser };

      const nextRoom = await fetchChatRoom(route.params.roomId, session?.token ?? null);
      const nextGameId = getGameIdFromRoomLabel(nextRoom.tableConfig.gameLabel);
      const nextTierId = getTierIdFromRoomConfig(nextRoom);

      setRoom(nextRoom);
      setIsPrivate(nextRoom.tableConfig.isPrivate);
      setSelectedGameId(nextGameId);
      setSelectedTierId(nextTierId);
      setSelectedRuleId(nextGameId === '3-5-7' ? '357-hostest' : nextTierId === '5k-casual' ? '8-or-better' : 'friendly-holdem');
      setSelectedRules({
        ...(defaultRulesByTierId[nextTierId] ?? {}),
        ...(nextGameId === '3-5-7' ? { mode: 'HOSTEST' } : {}),
      });

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
      setIsLoadingRoom(false);
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
          'chat:joinRoom',
          { roomId: route.params.roomId, token: session.token },
          (ack: ChatRoomSocketAck = {}) => {
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
      socket.on('chat:error', (payload: { message?: string }) => {
        const message = payload?.message ?? 'Realtime chat error.';
        setRealtimeError(isInvalidUserTokenMessage(message) ? expiredSessionMessage : message);

        if (isInvalidUserTokenMessage(message)) {
          void clearAuthSession();
          authRef.current = { token: null, user: fallbackUser };
        }
      });
      socket.on('chat:newMessage', (payload: { message?: ChatRoomMessage }) => {
        if (!payload.message) {
          return;
        }

        setRoom((currentRoom) => currentRoom ? { ...currentRoom, messages: mergeMessages(currentRoom.messages, [payload.message!]), lastMessagePreview: payload.message!.kind === 'gift_clip' || payload.message!.messageType === 'gift_clip' ? `${payload.message!.authorName} sent Gift Clips` : payload.message!.body } : currentRoom);
      });
      socket.on('chat:activePlayers', (payload: { players?: ChatRoomPlayer[]; activePlayerCount?: number }) => {
        setRoom((currentRoom) => currentRoom ? { ...currentRoom, activePlayerCount: payload.activePlayerCount ?? payload.players?.length ?? currentRoom.activePlayerCount, players: payload.players ?? currentRoom.players } : currentRoom);
      });
      socket.on('chat:presence', (payload: { players?: ChatRoomPlayer[]; activePlayerCount?: number }) => {
        setRoom((currentRoom) => currentRoom ? { ...currentRoom, activePlayerCount: payload.activePlayerCount ?? payload.players?.length ?? currentRoom.activePlayerCount, players: payload.players ?? currentRoom.players } : currentRoom);
      });
      // TODO(aiPrime/socket): Replace this listener with notification:tableInvite and table:playerInvited handling once backend notification payloads are finalized.
      socket.on('table:playerInvited', (payload: { invitedPlayerIds?: string[]; playerIds?: string[] }) => {
        const playerIds = payload.invitedPlayerIds ?? payload.playerIds ?? [];
        setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...playerIds])));
      });

      socket.connect();
    }

    void connectRealtime();

    return () => {
      isMounted = false;
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.emit('chat:leaveRoom', { roomId: route.params.roomId, token: authRef.current?.token });
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

  useEffect(() => {
    if (errorMessage && isLaunchingTable) {
      setIsLaunchingTable(false);
    }
  }, [errorMessage, isLaunchingTable]);

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

  async function handleSendMessage() {
    const trimmedDraft = draft.trim();
    const token = authRef.current?.token;

    if (!trimmedDraft || !room || !token || !socketRef.current?.connected || isSendingMessage) {
      return;
    }

    setIsSendingMessage(true);

    try {
      const ack = await new Promise<ChatRoomSocketAck>((resolve, reject) => {
        socketRef.current?.timeout(10000).emit(
          'chat:sendMessage',
          { body: trimmedDraft, roomId: room.id, token },
          (error: Error | null, response: ChatRoomSocketAck) => {
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

  async function handleSendGiftClip(amount: number, message: string, recipientUserId?: string) {
    const token = authRef.current?.token;
    const resolvedRecipientUserId = recipientUserId ?? selectedGiftRecipientId;

    if (!room || !token || !resolvedRecipientUserId || !socketRef.current?.connected || isSendingGiftClip) {
      setRealtimeError('Gift Clips require a live room connection and selected recipient.');
      return;
    }

    setIsSendingGiftClip(true);

    try {
      const ack = await new Promise<ChatRoomSocketAck>((resolve, reject) => {
        socketRef.current?.timeout(10000).emit(
          'chat:sendGiftClip',
          { amount, message, recipientUserId: resolvedRecipientUserId, roomId: room.id, token },
          (error: Error | null, response: ChatRoomSocketAck) => {
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

    const [eligiblePlayerId] = getInviteEligiblePlayerIds(room.players, [playerId], invitedPlayerIds);

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

  function appendSystemMessage(body: string) {
    if (!room) {
      return;
    }

    // TODO(aiPrime/socket): Replace this local placeholder with chat:systemMessage when the backend broadcasts AI Prime room activity.
    const systemMessage: ChatRoomMessage = {
      id: `ai-prime-${Date.now()}`,
      roomId: room.id,
      authorId: null,
      authorName: 'AI Prime',
      body,
      createdAt: new Date().toISOString(),
      tone: 'system',
    };

    setRoom((currentRoom) => currentRoom ? {
      ...currentRoom,
      lastMessagePreview: body,
      messages: mergeMessages(currentRoom.messages, [systemMessage]),
    } : currentRoom);
  }

  function handleInviteSelectedPlayers() {
    if (!room) {
      return;
    }

    const eligibleSelectedPlayerIds = getInviteEligiblePlayerIds(room.players, selectedPlayerIds, invitedPlayerIds);

    if (eligibleSelectedPlayerIds.length === 0) {
      setSelectedPlayerIds([]);
      return;
    }

    // TODO(aiPrime/socket): Emit table:inviteRoomPlayers and handle table:playerInvited / notification:tableInvite once backend invites are ready.
    setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...eligibleSelectedPlayerIds])));
    setSelectedPlayerIds((currentIds) =>
      currentIds.filter((currentId) => !eligibleSelectedPlayerIds.includes(currentId)),
    );
    appendSystemMessage(`AI Prime queued ${eligibleSelectedPlayerIds.length} room table invite${eligibleSelectedPlayerIds.length === 1 ? '' : 's'}.`);
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

  function handleSelectAIPrimeAction(actionId: AIPrimeActionId) {
    if (actionId !== 'setUpTable') {
      appendSystemMessage(`AI Prime placeholder: ${actionId} will be connected after assistant services are ready.`);
      setIsAIPrimePanelVisible(false);
      return;
    }

    // TODO(aiPrime/socket): Emit aiPrime:setUpTable when assistant telemetry and orchestration are available.
    setIsAIPrimePanelVisible(false);
    setIsSetUpTableFlowVisible(true);
  }

  async function handleLaunchTable() {
    if (!room || isLaunchingTable) {
      return;
    }

    const gameSettings: PokerGameSettingsUpdate = {
      game: selectedGameId === '3-5-7' ? '357' : 'holdem',
      ...(selectedGameId === '3-5-7' ? { mode: selectedRules.mode ?? 'HOSTEST' } : {}),
      ...(selectedRules.lowRule ? { lowRule: selectedRules.lowRule } : {}),
      ...(selectedRules.wildCards ? { wildCards: selectedRules.wildCards } : {}),
    };

    // TODO(aiPrime/socket): Emit table:createFromAiPrime before table:createFromChatRoom when backend supports the AI Prime handoff.
    setIsLaunchingTable(true);

    try {
      const launchAcknowledgement = await createTableFromChatRoom({
        chatRoomId: isolatedLaunchMetadata.chatRoomId,
        gameSettings,
        invitedPlayerIds: Array.from(new Set([...invitedPlayerIds, ...selectedPlayerIds])),
        name: currentUserName,
        playerCount: room.tableConfig.maxSeats,
        tableName: `${room.title} Table`,
        tableTierId: selectedTierId,
        visibility: isPrivate ? 'private' : 'room',
      });

      if (launchAcknowledgement.ok || launchAcknowledgement.success) {
        const allInviteIds = Array.from(new Set([...invitedPlayerIds, ...selectedPlayerIds]));
        setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...allInviteIds])));
        appendSystemMessage(`AI Prime launched a ${isPrivate ? 'private' : 'public'} table and sent ${allInviteIds.length} invite${allInviteIds.length === 1 ? '' : 's'}.`);
        // TODO(aiPrime/socket): Emit table:launchFromChatRoom after table:createFromAiPrime and broadcast notification:tableInvite.
        setIsSetUpTableFlowVisible(false);
        navigation.navigate(routes.Game);
      }
    } finally {
      setIsLaunchingTable(false);
    }
  }

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Social chat room"
      title={room.title}
      subtitle={room.description}
    >
      <ChatRoomHeader
        activePlayerCount={room.activePlayerCount}
        description={room.description}
        notificationsEnabled={room.unreadCount > 0}
        statusLabel={`${room.topic} • ${isRealtimeConnected ? 'Live' : 'Connecting'}`}
        title={room.title}
      />

      <SectionCard title="Room messages">
        <Text style={styles.helperText}>
          Messages are loaded from the backend and streamed over the chat room socket in realtime. Gameplay chat
          remains isolated inside active tables.
        </Text>
        {realtimeError ? <Text style={styles.errorText}>{realtimeError}</Text> : null}
        <View style={styles.messageStack}>
          {room.messages.length === 0 ? <Text style={styles.helperText}>No messages yet. Start the conversation.</Text> : null}
          {room.messages.map((message) => (
            <ChatMessageItem currentUserId={currentUserId} key={message.id} message={message} players={room.players} />
          ))}
        </View>
        <ChatInputBar
          draft={draft}
          onChangeDraft={setDraft}
          onOpenGiftClips={handleOpenGiftClips}
          onOpenAIPrime={() => {
            // TODO(aiPrime/socket): Emit aiPrime:open when AI Prime analytics are connected.
            setIsAIPrimePanelVisible(true);
          }}
          onSend={() => { void handleSendMessage(); }}
          placeholder={isSendingMessage ? 'Sending…' : 'Message the live room…'}
        />
      </SectionCard>

      <SectionCard title="Active players">
        <Text style={styles.helperText}>Use AI Prime beside the message box to turn the room conversation into a table setup.</Text>
        <RoomPlayerList
          invitedPlayerIds={invitedPlayerIds}
          players={room.players}
          selectedPlayerIds={selectedPlayerIds}
        />
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
      </SectionCard>

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
        onSendGift={(amount, message, recipientId) => { void handleSendGiftClip(amount, message, recipientId); }}
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
        players={room.players}
        rulesSummary={rulesSummary}
        selectedGameId={selectedGameId}
        selectedPlayerIds={selectedPlayerIds}
        selectedRuleId={selectedRuleId}
        selectedTierId={selectedTierId}
        visible={isSetUpTableFlowVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(77,243,199,0.14)',
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
  roomInviteStack: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
});
