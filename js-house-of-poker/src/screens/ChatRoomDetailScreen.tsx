import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import {
  ChatInputBar,
  ChatMessageItem,
  ChatRoomHeader,
  CreateTablePanel,
  defaultGameOptions,
  defaultTableTierOptions,
  RoomPlayerList,
} from '../components/chatRooms';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { usePoker } from '../context/PokerProvider';
import { chatRooms } from '../constants/chatRooms';
import { routes } from '../constants/routes';
import { colors } from '../theme/colors';
import type { PokerGameSettingsUpdate } from '../services/poker';
import type { ChatRoomMessage, ChatRoomPlayer } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoomDetail'>;

const currentUserId = 'local-player';
const currentUserName = 'Player';

type ChatRoomTableRules = Pick<PokerGameSettingsUpdate, 'lowRule' | 'mode' | 'wildCards'>;

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

function getInitialInvitedPlayerIds(room: (typeof chatRooms)[number] | undefined) {
  if (!room) {
    return [];
  }

  const pendingInviteHandles = new Set(room.inviteState.pendingInvites);

  return room.players
    .filter((player) => pendingInviteHandles.has(player.handle))
    .map((player) => player.id);
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

function getTierIdFromRoomConfig(room: (typeof chatRooms)[number] | undefined) {
  if (room?.tableConfig.stakesLabel.toLowerCase().includes('5k')) {
    return '5k-casual';
  }

  return room?.tableConfig.isPrivate ? 'private-study' : 'free-training';
}

export function ChatRoomDetailScreen({ navigation, route }: Props) {
  const room = chatRooms.find((candidate) => candidate.id === route.params.roomId);
  const { createRoom, errorMessage, roomState, transportKind } = usePoker();
  const [draft, setDraft] = useState('');
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<string[]>(() => getInitialInvitedPlayerIds(room));
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(room?.tableConfig.isPrivate ?? true);
  const [localMessages, setLocalMessages] = useState<ChatRoomMessage[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(() => getGameIdFromRoomLabel(room?.tableConfig.gameLabel));
  const [selectedTierId, setSelectedTierId] = useState(() => getTierIdFromRoomConfig(room));
  const [selectedRules, setSelectedRules] = useState<ChatRoomTableRules>(() => ({
    ...(defaultRulesByTierId[getTierIdFromRoomConfig(room)] ?? {}),
    ...(getGameIdFromRoomLabel(room?.tableConfig.gameLabel) === '3-5-7' ? { mode: 'HOSTEST' } : {}),
  }));
  const [pendingTableLaunch, setPendingTableLaunch] = useState<{
    invitedPlayerIds: string[];
    roomIdBefore: string | null;
  } | null>(null);

  const messages = useMemo(
    () => (room ? [...room.messages, ...localMessages] : []),
    [localMessages, room],
  );

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
    if (
      pendingTableLaunch &&
      roomState?.roomId &&
      roomState.roomId !== pendingTableLaunch.roomIdBefore
    ) {
      const createdTableId = roomState.roomId;

      // TODO(table:inviteRoomPlayers): emit pendingTableLaunch.invitedPlayerIds with createdTableId
      // once createRoom returns a durable table ID through the realtime transport.
      const invitePayloadForFutureSocket = {
        playerIds: pendingTableLaunch.invitedPlayerIds,
        tableId: createdTableId,
      };
      void invitePayloadForFutureSocket;

      navigation.navigate(routes.Game);
      setPendingTableLaunch(null);
    }
  }, [navigation, pendingTableLaunch, roomState?.roomId]);

  useEffect(() => {
    if (errorMessage && pendingTableLaunch) {
      setPendingTableLaunch(null);
    }
  }, [errorMessage, pendingTableLaunch]);

  const selectedTier = defaultTableTierOptions.find((option) => option.id === selectedTierId);
  const rulesSummary = selectedTier?.rulesLabel ?? room?.tableConfig.stakesLabel ?? 'Room table rules';

  if (!room) {
    return (
      <Screen
        showPlatformNavigation
        eyebrow="Chat room"
        title="Room not found"
        subtitle="This social chat room is unavailable. Return to the chat room directory to pick another space."
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

  function handleSendMessage() {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft || !room) {
      return;
    }

    setLocalMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `local-${Date.now()}`,
        roomId: room.id,
        authorId: currentUserId,
        authorName: 'You',
        body: trimmedDraft,
        createdAt: new Date().toISOString(),
        tone: 'player',
      },
    ]);
    setDraft('');
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

  function handleInviteSelectedPlayers() {
    if (!room) {
      return;
    }

    const eligibleSelectedPlayerIds = getInviteEligiblePlayerIds(room.players, selectedPlayerIds, invitedPlayerIds);

    if (eligibleSelectedPlayerIds.length === 0) {
      setSelectedPlayerIds([]);
      return;
    }

    // TODO(table:inviteRoomPlayers): replace this local mock update with a socket emit for selected room players.
    setInvitedPlayerIds((currentIds) => Array.from(new Set([...currentIds, ...eligibleSelectedPlayerIds])));
    // TODO(table:playerInvited): listen for invite acknowledgements and reconcile invited/failed IDs from the server.
    setSelectedPlayerIds((currentIds) =>
      currentIds.filter((currentId) => !eligibleSelectedPlayerIds.includes(currentId)),
    );
  }

  function handleSelectGame(gameId: string) {
    setSelectedGameId(gameId);
    setSelectedRules((currentRules) => {
      const nextRules = { ...currentRules };

      if (gameId === '3-5-7') {
        nextRules.mode = nextRules.mode ?? 'HOSTEST';
      } else {
        delete nextRules.mode;
      }

      return nextRules;
    });
  }

  function handleSelectTier(tierId: string) {
    setSelectedTierId(tierId);
    setSelectedRules((currentRules) => ({
      ...currentRules,
      ...(defaultRulesByTierId[tierId] ?? {}),
    }));
  }

  function handleLaunchTable() {
    if (!room) {
      return;
    }

    const gameSettings: PokerGameSettingsUpdate = {
      game: selectedGameId === '3-5-7' ? '357' : 'holdem',
      ...(selectedGameId === '3-5-7' ? { mode: selectedRules.mode ?? 'HOSTEST' } : {}),
      ...(selectedRules.lowRule ? { lowRule: selectedRules.lowRule } : {}),
      ...(selectedRules.wildCards ? { wildCards: selectedRules.wildCards } : {}),
    };

    // TODO(table:createFromChatRoom): pass chat room launch context once backend/socket transports support it.
    // TODO(table:launchFromChatRoom): replace isolated metadata with realtime chat-room table launch acknowledgement.
    const chatRoomMetadataForFutureTransport = isolatedLaunchMetadata;
    void chatRoomMetadataForFutureTransport;

    setPendingTableLaunch({
      invitedPlayerIds: Array.from(new Set([...invitedPlayerIds, ...selectedPlayerIds])),
      roomIdBefore: roomState?.roomId ?? null,
    });
    createRoom({
      gameSettings,
      name: currentUserName,
      playerCount: room.tableConfig.maxSeats,
      tableName: `${room.title} Table`,
    });
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
        statusLabel={room.topic}
        title={room.title}
      />

      <SectionCard title="Room messages">
        <Text style={styles.helperText}>
          Social-chat mock messages are isolated from gameplay chat. TableChatBar remains reserved for live
          table play only.
        </Text>
        <View style={styles.messageStack}>
          {messages.map((message) => (
            <ChatMessageItem currentUserId={currentUserId} key={message.id} message={message} />
          ))}
        </View>
        <ChatInputBar draft={draft} onChangeDraft={setDraft} onSend={handleSendMessage} />
      </SectionCard>

      <SectionCard title="Active players">
        <RoomPlayerList
          invitedPlayerIds={invitedPlayerIds}
          onTogglePlayer={handleTogglePlayerSelection}
          players={room.players}
          selectedPlayerIds={selectedPlayerIds}
        />
      </SectionCard>

      <CreateTablePanel
        gameOptions={defaultGameOptions}
        invitedPlayerIds={invitedPlayerIds}
        isPrivate={isPrivate}
        onInviteSelectedPlayers={handleInviteSelectedPlayers}
        onLaunchTable={handleLaunchTable}
        onSelectGame={handleSelectGame}
        onSelectTier={handleSelectTier}
        onTogglePlayerSelection={handleTogglePlayerSelection}
        onTogglePrivacy={setIsPrivate}
        players={room.players}
        rulesSummary={rulesSummary}
        selectedPlayerIds={selectedPlayerIds}
        selectedGameId={selectedGameId}
        selectedTierId={selectedTierId}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  messageStack: {
    gap: 10,
  },
});
