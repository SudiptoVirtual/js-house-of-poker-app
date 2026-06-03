import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ChatRoomListItem } from '../components/chatRooms';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { createChatRoom, fetchActiveChatRoomFriends, fetchChatRooms } from '../services/api/chatRooms';
import { clearAuthSession, getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { ChatRoom, ChatRoomFriend } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

function isInvalidUserTokenError(error: unknown) {
  return error instanceof Error && /invalid user token|jwt expired|jwt malformed/i.test(error.message);
}

export function ChatRoomsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeFriends, setActiveFriends] = useState<ChatRoomFriend[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setRoomsError(null);

    try {
      const session = await getAuthSession();
      const token = session?.token ?? null;

      setAuthToken(token);
      setRooms(await fetchChatRooms(token));

      if (!token) {
        setActiveFriends([]);
        return;
      }

      try {
        setActiveFriends(await fetchActiveChatRoomFriends(token));
      } catch (error) {
        setActiveFriends([]);

        if (isInvalidUserTokenError(error)) {
          await clearAuthSession();
          setAuthToken(null);
          setCreateRoomError('Your sign-in session expired. Sign in again to create rooms or invite friends.');
          return;
        }

        setCreateRoomError(error instanceof Error ? error.message : 'Unable to load active friends.');
      }
    } catch (error) {
      setRoomsError(error instanceof Error ? error.message : 'Unable to load chat rooms.');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  function handleToggleFriend(friendId: string) {
    setSelectedFriendIds((currentIds) =>
      currentIds.includes(friendId)
        ? currentIds.filter((currentId) => currentId !== friendId)
        : [...currentIds, friendId],
    );
  }

  async function handleCreateRoom() {
    const roomName = newRoomName.trim();

    if (!authToken) {
      navigation.navigate(routes.Login);
      return;
    }

    if (!roomName || isCreatingRoom) {
      return;
    }

    setIsCreatingRoom(true);
    setCreateRoomError(null);

    try {
      const createdRoom = await createChatRoom(
        {
          invitedPlayerIds: selectedFriendIds,
          name: roomName,
        },
        authToken,
      );

      setRooms((currentRooms) => [createdRoom.room, ...currentRooms.filter((room) => room.id !== createdRoom.room.id)]);
      setNewRoomName('');
      setSelectedFriendIds([]);
      navigation.navigate(routes.ChatRoomDetail, { roomId: createdRoom.room.id });
    } catch (error) {
      if (isInvalidUserTokenError(error)) {
        await clearAuthSession();
        setAuthToken(null);
        setSelectedFriendIds([]);
        setCreateRoomError('Your sign-in session expired. Sign in again to create rooms.');
      } else {
        setCreateRoomError(error instanceof Error ? error.message : 'Unable to create chat room.');
      }
    } finally {
      setIsCreatingRoom(false);
    }
  }

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

      <SectionCard title="Create New Room">
        {!authToken ? (
          <View style={styles.statusStack}>
            <Text style={styles.helperText}>Sign in to create a private chat room.</Text>
            <ActionButton
              compact
              icon="login"
              label="Sign in"
              onPress={() => navigation.navigate(routes.Login)}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.createRoomStack}>
            <TextInput
              onChangeText={setNewRoomName}
              placeholder="Room name"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
              value={newRoomName}
            />
            {activeFriends.length > 0 ? (
              <View style={styles.friendChipWrap}>
                {activeFriends.map((friend) => {
                  const selected = selectedFriendIds.includes(friend.id);

                  return (
                    <Pressable
                      accessibilityLabel={`${selected ? 'Remove' : 'Invite'} ${friend.displayName}`}
                      accessibilityRole="button"
                      key={friend.id}
                      onPress={() => handleToggleFriend(friend.id)}
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
              <Text style={styles.mutedText}>No active friends are available to invite right now.</Text>
            )}
            {createRoomError ? <Text style={styles.errorText}>{createRoomError}</Text> : null}
            <ActionButton
              fullWidth
              disabled={!newRoomName.trim() || isCreatingRoom}
              icon="plus-circle-outline"
              label={isCreatingRoom ? 'Creating room...' : 'Create Room'}
              loading={isCreatingRoom}
              onPress={() => { void handleCreateRoom(); }}
              tone="success"
            />
          </View>
        )}
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
  createRoomStack: {
    gap: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
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
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mutedText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.78,
  },
  roomStack: {
    gap: 12,
  },
  statusStack: {
    gap: 10,
  },
});
