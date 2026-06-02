import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ChatRoomListItem } from '../components/chatRooms';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { fetchChatRooms } from '../services/api/chatRooms';
import { colors } from '../theme/colors';
import type { ChatRoom } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

export function ChatRoomsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError(null);

    try {
      setRooms(await fetchChatRooms());
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : 'Unable to load chat rooms.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Chat rooms"
      title="Platform chat rooms"
      subtitle="Join production social rooms backed by the API and realtime socket messaging."
    >
      <SectionCard title="Social chat hub">
        <Text style={styles.helperText}>
          Chat Rooms are first-class platform spaces for planning games, meeting players, and sharing
          invites before a hand begins. They do not replace or reuse live table chat.
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? `Open active table ${activeTableCode}` : 'Create or join a table'}
          onPress={() => navigation.navigate(activeTableCode ? routes.Game : routes.Home)}
          tone="primary"
          variant={activeTableCode ? 'primary' : 'secondary'}
        />
      </SectionCard>

      <SectionCard title="Rooms">
        {roomsError ? (
          <View style={styles.statusStack}>
            <Text style={styles.errorText}>{roomsError}</Text>
            <ActionButton compact icon="refresh" label="Retry" onPress={() => { void loadRooms(); }} variant="secondary" />
          </View>
        ) : null}
        {isLoadingRooms ? <Text style={styles.helperText}>Loading live chat rooms…</Text> : null}
        {!isLoadingRooms && rooms.length === 0 && !roomsError ? (
          <Text style={styles.helperText}>No chat rooms are available yet.</Text>
        ) : null}
        <View style={styles.roomStack}>
          {rooms.map((room) => (
            <ChatRoomListItem
              key={room.id}
              onEnter={() => navigation.navigate(routes.ChatRoomDetail, { roomId: room.id })}
              room={room}
            />
          ))}
        </View>
      </SectionCard>

      {/* <ComplianceNotice /> */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  roomStack: {
    gap: 12,
  },
  statusStack: {
    gap: 10,
  },
});
