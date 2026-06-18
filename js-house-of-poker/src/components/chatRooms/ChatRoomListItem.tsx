import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatRoom } from '../../types/chatRooms';

import { colors } from '../../theme/colors';
type ChatRoomListItemProps = {
  enterLabel?: string;
  onEnter: () => void;
  room: Pick<
    ChatRoom,
    'activePlayerCount' | 'description' | 'lastMessagePreview' | 'tableConfig' | 'title' | 'topic' | 'unreadCount'
  >;
};

export function ChatRoomListItem({ enterLabel = 'Enter', onEnter, room }: ChatRoomListItemProps) {
  return (
    <Pressable
      accessibilityLabel={`Enter ${room.title}`}
      accessibilityRole="button"
      onPress={onEnter}
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
        <View style={styles.metricGroup}>
          <Text style={styles.metricText}>{room.activePlayerCount} active</Text>
          <Text style={styles.metricText}>{room.tableConfig.seatsOpen} seats open</Text>
        </View>
        <View style={styles.enterAction}>
          <Text style={styles.enterText}>{enterLabel}</Text>
          <MaterialCommunityIcons color={colors.secondary} name="chevron-right" size={20} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  enterAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  enterText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
