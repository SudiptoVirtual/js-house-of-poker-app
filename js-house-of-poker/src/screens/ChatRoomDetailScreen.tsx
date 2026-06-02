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
import type { ChatRoomMessage } from '../types/chatRooms';
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
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(room?.tableConfig.isPrivate ?? true);
  const [localMessages, setLocalMessages] = useState<ChatRoomMessage[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(() => getGameIdFromRoomLabel(room?.tableConfig.gameLabel));
  const [selectedTierId, setSelectedTierId] = useState(() => getTierIdFromRoomConfig(room));
  const [selectedRules, setSelectedRules] = useState<ChatRoomTableRules>(() => ({
    ...(defaultRulesByTierId[getTierIdFromRoomConfig(room)] ?? {}),
    ...(getGameIdFromRoomLabel(room?.tableConfig.gameLabel) === '3-5-7' ? { mode: 'HOSTEST' } : {}),
  }));
  const [pendingTableLaunch, setPendingTableLaunch] = useState<{
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
      tableTierId: selectedTierId,
      transportKind,
    }),
    [invitedPlayerIds, isPrivate, room?.id, route.params.roomId, selectedTierId, transportKind],
  );

  useEffect(() => {
    if (
      pendingTableLaunch &&
      roomState?.roomId &&
      roomState.roomId !== pendingTableLaunch.roomIdBefore
    ) {
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

  function handleTogglePlayerInvite(playerId: string) {
    setInvitedPlayerIds((currentIds) =>
      currentIds.includes(playerId)
        ? currentIds.filter((currentId) => currentId !== playerId)
        : [...currentIds, playerId],
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
    // TODO(table:inviteRoomPlayers): send invited room player IDs through the shared table invite rail when supported.
    // TODO(table:playerInvited): surface per-player invite status updates back into this chat room UI.
    // TODO(table:launchFromChatRoom): replace isolated metadata with realtime chat-room table launch acknowledgement.
    const chatRoomMetadataForFutureTransport = isolatedLaunchMetadata;
    void chatRoomMetadataForFutureTransport;

    setPendingTableLaunch({ roomIdBefore: roomState?.roomId ?? null });
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
          onInvitePlayer={handleTogglePlayerInvite}
          players={room.players}
        />
      </SectionCard>

      <CreateTablePanel
        gameOptions={defaultGameOptions}
        invitedPlayerIds={invitedPlayerIds}
        isPrivate={isPrivate}
        onLaunchTable={handleLaunchTable}
        onSelectGame={handleSelectGame}
        onSelectTier={handleSelectTier}
        onTogglePlayerInvite={handleTogglePlayerInvite}
        onTogglePrivacy={setIsPrivate}
        players={room.players}
        rulesSummary={rulesSummary}
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
