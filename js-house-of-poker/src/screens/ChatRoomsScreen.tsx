import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ChatInboxListItem } from '../components/chatRooms';
import { Screen } from '../components/Screen';
import { routes } from '../constants/routes';
import { createChatRoom, fetchActiveChatRoomFriends, fetchChatRooms } from '../services/api/chatRooms';
import { clearAuthSession, getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { ChatRoom, ChatRoomFriend } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

const ACTION_MENU_GAP = 8;
const ACTION_MENU_MIN_EDGE = 12;
const ACTION_MENU_WIDTH = 210;

type ActionMenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function isInvalidUserTokenError(error: unknown) {
  return error instanceof Error && /invalid user token|jwt expired|jwt malformed/i.test(error.message);
}

export function ChatRoomsScreen({ navigation }: Props) {
  const actionButtonRef = useRef<View>(null);
  const chatListRef = useRef<FlatList<ChatRoom>>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeFriends, setActiveFriends] = useState<ChatRoomFriend[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [tableEntryCode, setTableEntryCode] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isCreateRoomDialogVisible, setIsCreateRoomDialogVisible] = useState(false);
  const [isMoreMenuVisible, setIsMoreMenuVisible] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<ActionMenuAnchor | null>(null);
  const [isTableDialogVisible, setIsTableDialogVisible] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isBackToTopVisible, setIsBackToTopVisible] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);

  const loadRooms = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingRooms(true);
    } else {
      setIsLoadingRooms(true);
    }
    try {
      const session = await getAuthSession();
      const token = session?.token ?? null;

      setAuthToken(token);
      setRooms(await fetchChatRooms(token));
      setRoomsError(null);

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
      if (isRefresh) {
        setIsRefreshingRooms(false);
      } else {
        setIsLoadingRooms(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const normalizedRoomSearchQuery = roomSearchQuery.trim().toLowerCase();
  const filteredRooms = useMemo(() => {
    if (!normalizedRoomSearchQuery) {
      return rooms;
    }

    return rooms.filter((room) => room.title.toLowerCase().includes(normalizedRoomSearchQuery));
  }, [normalizedRoomSearchQuery, rooms]);
  const dropdownCardPosition = useMemo(() => {
    if (!moreMenuAnchor) {
      return {
        right: 72,
        top: 20,
        width: ACTION_MENU_WIDTH,
      };
    }

    const availableWidth = moreMenuAnchor.x - ACTION_MENU_GAP - ACTION_MENU_MIN_EDGE;
    const width = Math.min(ACTION_MENU_WIDTH, Math.max(0, availableWidth));

    return {
      left: Math.max(ACTION_MENU_MIN_EDGE, moreMenuAnchor.x - width - ACTION_MENU_GAP),
      top: Math.max(ACTION_MENU_MIN_EDGE, moreMenuAnchor.y),
      width,
    };
  }, [moreMenuAnchor]);
  const shouldShowEmptyRooms = !isLoadingRooms && rooms.length === 0 && !roomsError;
  const shouldShowEmptySearch = !isLoadingRooms && rooms.length > 0 && filteredRooms.length === 0 && !roomsError;

  const handleChatListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIsBackToTopVisible(event.nativeEvent.contentOffset.y > 24);
  }, []);

  const handleBackToTop = useCallback(() => {
    chatListRef.current?.scrollToOffset({ animated: true, offset: 0 });
  }, []);

  const renderChatRoomItem = useCallback(({ item: room }: { item: ChatRoom }) => {
    const inboxRoom = room.lastMessagePreview || room.messages.length > 0
      ? room
      : { ...room, lastMessagePreview: 'No messages yet.' };

    return (
      <ChatInboxListItem
        onEnter={() => navigation.navigate(routes.ChatRoomDetail, { roomId: room.id })}
        room={inboxRoom}
      />
    );
  }, [navigation]);

  function handleToggleFriend(friendId: string) {
    setSelectedFriendIds((currentIds) =>
      currentIds.includes(friendId)
        ? currentIds.filter((currentId) => currentId !== friendId)
        : [...currentIds, friendId],
    );
  }

  function handleOpenCreateRoom() {
    if (!authToken) {
      setIsMoreMenuVisible(false);
      navigation.navigate(routes.Login);
      return;
    }

    setIsMoreMenuVisible(false);
    setIsCreateRoomDialogVisible(true);
  }

  function handleOpenMoreMenu() {
    const actionButton = actionButtonRef.current;

    if (!actionButton) {
      setMoreMenuAnchor(null);
      setIsMoreMenuVisible(true);
      return;
    }

    actionButton.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        setMoreMenuAnchor(null);
      } else {
        setMoreMenuAnchor({ height, width, x, y });
      }

      setIsMoreMenuVisible(true);
    });
  }

  function handleCreateTable() {
    setIsMoreMenuVisible(false);
    navigation.navigate(routes.Home);
  }

  function handleOpenJoinTable() {
    setIsMoreMenuVisible(false);
    setTableEntryCode('');
    setIsTableDialogVisible(true);
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
      setIsCreateRoomDialogVisible(false);
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
      bodyStyle={styles.screenBody}
      compactHeader
      contentStyle={styles.screenContent}
      scrollable={false}
      showPlatformNavigation
      title="Chats"
      topSafeAreaScale={0.2754}
      headerRight={(
        <Pressable
          accessibilityLabel="Open chat room actions"
          accessibilityRole="button"
          onPress={handleOpenMoreMenu}
          ref={actionButtonRef}
          style={({ pressed }) => [styles.moreButton, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.primary} name="dots-vertical" size={24} />
        </Pressable>
      )}
    >
      <View style={styles.searchBox}>
        <MaterialCommunityIcons color={colors.mutedText} name="magnify" size={20} />
        <TextInput
          accessibilityLabel="Search chat rooms"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setRoomSearchQuery}
          placeholder="Search chats"
          placeholderTextColor={colors.mutedText}
          returnKeyType="search"
          style={styles.searchInput}
          value={roomSearchQuery}
        />
        {roomSearchQuery ? (
          <Pressable
            accessibilityLabel="Clear chat search"
            accessibilityRole="button"
            onPress={() => setRoomSearchQuery('')}
            style={({ pressed }) => [styles.clearSearchButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.mutedText} name="close" size={18} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chatListArea}>
        <FlatList
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.chatListContent}
          data={filteredRooms}
          ItemSeparatorComponent={() => <View style={styles.chatSeparator} />}
          keyExtractor={(room) => room.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={roomsError || isLoadingRooms || shouldShowEmptyRooms || shouldShowEmptySearch ? (
            <View style={styles.listHeader}>
              {roomsError ? (
                <View style={styles.statusStack}>
                  <Text style={styles.errorText}>{roomsError}</Text>
                  <ActionButton
                    compact
                    icon="refresh"
                    label={isLoadingRooms ? 'Retrying...' : 'Retry'}
                    loading={isLoadingRooms}
                    onPress={() => { void loadRooms(); }}
                    variant="secondary"
                  />
                </View>
              ) : null}
              {isLoadingRooms ? <Text style={styles.helperText}>Loading live chat rooms...</Text> : null}
              {shouldShowEmptyRooms ? (
                <Text style={styles.helperText}>
                  No rooms are available right now. Create a private room or check back when live rooms open.
                </Text>
              ) : null}
              {shouldShowEmptySearch ? (
                <Text style={styles.helperText}>No chats match "{roomSearchQuery.trim()}".</Text>
              ) : null}
            </View>
          ) : null}
          onScroll={handleChatListScroll}
          ref={chatListRef}
          refreshControl={(
            <RefreshControl
              colors={[colors.primary, colors.secondary]}
              onRefresh={() => { void loadRooms(true); }}
              progressBackgroundColor={colors.surface}
              refreshing={isRefreshingRooms}
              tintColor={colors.primary}
              title="Refreshing..."
              titleColor={colors.mutedText}
            />
          )}
          renderItem={renderChatRoomItem}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.chatList}
        />
        {isBackToTopVisible ? (
          <Pressable
            accessibilityLabel="Back to top"
            accessibilityRole="button"
            onPress={handleBackToTop}
            style={({ pressed }) => [styles.backToTopButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.background} name="arrow-up" size={24} />
          </Pressable>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsMoreMenuVisible(false)}
        transparent
        visible={isMoreMenuVisible}
      >
        <View style={styles.dropdownBackdrop}>
          <Pressable
            accessibilityLabel="Close chat room actions"
            accessibilityRole="button"
            onPress={() => setIsMoreMenuVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.dropdownCard, dropdownCardPosition]}>
            <Pressable accessibilityRole="button" onPress={handleOpenCreateRoom} style={styles.menuRow}>
              <MaterialCommunityIcons color={colors.success} name="plus-circle-outline" size={20} />
              <Text style={styles.menuRowText}>Create room</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleCreateTable} style={styles.menuRow}>
              <MaterialCommunityIcons color={colors.primary} name="cards-playing-outline" size={20} />
              <Text style={styles.menuRowText}>Create a table</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={handleOpenJoinTable} style={styles.menuRow}>
              <MaterialCommunityIcons color={colors.secondary} name="door-open" size={20} />
              <Text style={styles.menuRowText}>Join a table</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsCreateRoomDialogVisible(false)}
        transparent
        visible={isCreateRoomDialogVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Create room</Text>
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
            <View style={styles.dialogActionRow}>
              <ActionButton
                disabled={!newRoomName.trim() || isCreatingRoom}
                icon="plus-circle-outline"
                label={isCreatingRoom ? 'Creating room...' : 'Create'}
                loading={isCreatingRoom}
                onPress={() => { void handleCreateRoom(); }}
                tone="success"
              />
              <ActionButton
                label="Cancel"
                onPress={() => setIsCreateRoomDialogVisible(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsTableDialogVisible(false)}
        transparent
        visible={isTableDialogVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Join a table</Text>
            <Text style={styles.mutedText}>Enter a table code to join an existing table.</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(value) => setTableEntryCode(value.toUpperCase())}
              placeholder="Table code"
              placeholderTextColor={colors.mutedText}
              style={styles.input}
              value={tableEntryCode}
            />
            <View style={styles.dialogActionRow}>
              <ActionButton
                disabled={!tableEntryCode.trim()}
                label="Join"
                onPress={() => {
                  const tableCode = tableEntryCode.trim().toUpperCase();
                  setIsTableDialogVisible(false);
                  navigation.navigate(routes.Game, { tableCode });
                }}
                variant="secondary"
              />
              <ActionButton
                label="Cancel"
                onPress={() => setIsTableDialogVisible(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backToTopButton: {
    alignItems: 'center',
    backgroundColor: colors.success,
    borderColor: colors.background,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 16,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 48,
  },
  chatList: {
    flex: 1,
  },
  chatListArea: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  chatListContent: {
    paddingBottom: 18,
  },
  chatSeparator: {
    height: 12,
  },
  clearSearchButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dialogActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  dialogCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    width: '100%',
  },
  dialogTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
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
  dropdownBackdrop: {
    flex: 1,
  },
  dropdownCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuRowText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.modalBackdrop,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  mutedText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.78,
  },
  screenBody: {
    gap: 10,
  },
  screenContent: {
    paddingTop: 0,
    rowGap: 8,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 48,
    paddingVertical: 10,
  },
  listHeader: {
    gap: 10,
    marginBottom: 12,
  },
  statusStack: {
    gap: 10,
  },
});
