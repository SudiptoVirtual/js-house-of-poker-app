import { useMemo, useState } from 'react';
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
import { chatRooms } from '../constants/chatRooms';
import { routes } from '../constants/routes';
import { colors } from '../theme/colors';
import type { ChatRoomMessage } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoomDetail'>;

const currentUserId = 'local-player';

export function ChatRoomDetailScreen({ navigation, route }: Props) {
  const room = chatRooms.find((candidate) => candidate.id === route.params.roomId);
  const [draft, setDraft] = useState('');
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(room?.tableConfig.isPrivate ?? true);
  const [localMessages, setLocalMessages] = useState<ChatRoomMessage[]>([]);
  const [selectedGameId, setSelectedGameId] = useState(() => {
    const gameLabel = room?.tableConfig.gameLabel.toLowerCase() ?? '';
    return gameLabel.includes('3-5-7') ? '3-5-7' : 'texas-holdem';
  });
  const [selectedTierId, setSelectedTierId] = useState(() => {
    if (room?.tableConfig.stakesLabel.toLowerCase().includes('5k')) {
      return '5k-casual';
    }

    return room?.tableConfig.isPrivate ? 'private-study' : 'free-training';
  });

  const messages = useMemo(
    () => (room ? [...room.messages, ...localMessages] : []),
    [localMessages, room],
  );

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
        onLaunchTable={() => navigation.navigate(routes.Home)}
        onSelectGame={setSelectedGameId}
        onSelectTier={setSelectedTierId}
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
