import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import {
  SocialChatComposer,
  SocialChatInvitePanel,
  SocialChatMessageList,
  SocialChatPlayerStrip,
  SocialChatTableSetupCard,
} from '../components/social-chat/SocialChatComponents';
import { chatRooms } from '../constants/chatRooms';
import { routes } from '../constants/routes';
import { colors } from '../theme/colors';
import type { ChatRoomMessage } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoomDetail'>;

export function ChatRoomDetailScreen({ navigation, route }: Props) {
  const room = chatRooms.find((candidate) => candidate.id === route.params.roomId);
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatRoomMessage[]>([]);

  const messages = useMemo(
    () => (room ? [...room.messages, ...localMessages] : []),
    [localMessages, room],
  );

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
        authorId: 'local-player',
        authorName: 'You',
        body: trimmedDraft,
        createdAt: new Date().toISOString(),
        tone: 'player',
      },
    ]);
    setDraft('');
  }

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Social chat room"
      title={room.title}
      subtitle={room.description}
    >
      <SectionCard title="Room messages">
        <Text style={styles.helperText}>
          Social-chat mock messages are isolated from gameplay chat. TableChatBar remains reserved for live
          table play only.
        </Text>
        <SocialChatMessageList messages={messages} />
        <SocialChatComposer draft={draft} onChangeDraft={setDraft} onSend={handleSendMessage} />
      </SectionCard>

      <SectionCard title="Active players">
        <SocialChatPlayerStrip players={room.players} />
      </SectionCard>

      <SectionCard title="Table setup">
        <SocialChatTableSetupCard
          config={room.tableConfig}
          onOpenTable={() => navigation.navigate(routes.Home)}
        />
      </SectionCard>

      <SectionCard title="Invites">
        <SocialChatInvitePanel inviteState={room.inviteState} />
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
});
