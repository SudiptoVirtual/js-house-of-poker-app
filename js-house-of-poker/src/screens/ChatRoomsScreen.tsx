import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { chatRooms } from '../constants/chatRooms';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { ChatRoom } from '../types/chatRooms';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

export function ChatRoomsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Chat rooms"
      title="Platform chat rooms"
      subtitle="Find social rooms for table coordination while gameplay chat remains isolated in the live table experience."
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
        <View style={styles.roomStack}>
          {chatRooms.map((room) => (
            <ChatRoomListItem
              key={room.id}
              onPress={() => navigation.navigate(routes.ChatRoomDetail, { roomId: room.id })}
              room={room}
            />
          ))}
        </View>
      </SectionCard>

      <ComplianceNotice />
    </Screen>
  );
}

function ChatRoomListItem({ onPress, room }: { onPress: () => void; room: ChatRoom }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roomCard, pressed ? styles.roomCardPressed : null]}
    >
      <View style={styles.roomHeader}>
        <View style={styles.roomIcon}>
          <MaterialCommunityIcons color={colors.secondary} name="chat-outline" size={22} />
        </View>
        <View style={styles.roomTitleGroup}>
          <Text style={styles.roomTitle}>{room.title}</Text>
          <Text style={styles.roomTopic}>{room.topic}</Text>
        </View>
        {room.unreadCount > 0 ? <Text style={styles.unreadBadge}>{room.unreadCount}</Text> : null}
      </View>
      <Text style={styles.roomDescription}>{room.description}</Text>
      <Text style={styles.previewText}>{room.lastMessagePreview}</Text>
      <View style={styles.roomFooter}>
        <Text style={styles.metricText}>{room.activePlayerCount} active</Text>
        <Text style={styles.metricText}>{room.tableConfig.seatsOpen} seats open</Text>
        <MaterialCommunityIcons color={colors.mutedText} name="chevron-right" size={20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  metricText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  previewText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  roomCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  roomCardPressed: {
    opacity: 0.76,
  },
  roomDescription: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  roomFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  roomHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  roomIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  roomStack: {
    gap: 12,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  roomTitleGroup: {
    flex: 1,
    gap: 3,
  },
  roomTopic: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 26,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textAlign: 'center',
  },
});
