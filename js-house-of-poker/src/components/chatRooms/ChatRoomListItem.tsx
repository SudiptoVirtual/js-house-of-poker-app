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
  const accessLabel = room.tableConfig.isPrivate ? 'Private club' : 'Public room';

  return (
    <Pressable
      accessibilityLabel={`Enter ${room.title}`}
      accessibilityRole="button"
      onPress={onEnter}
      style={({ pressed }) => [styles.roomCard, pressed ? styles.roomCardPressed : null]}
    >
      <View style={styles.roomHeader}>
        <View style={styles.roomIcon}>
          <MaterialCommunityIcons color={colors.gold} name="cards-club" size={22} />
        </View>
        <View style={styles.roomTitleGroup}>
          <Text style={styles.roomTitle}>{room.title}</Text>
          <View style={styles.topicRow}>
            <Text style={styles.roomTopic}>{room.topic}</Text>
            <View style={[styles.accessPill, room.tableConfig.isPrivate ? styles.privatePill : styles.publicPill]}>
              <MaterialCommunityIcons
                color={room.tableConfig.isPrivate ? colors.gold : colors.secondary}
                name={room.tableConfig.isPrivate ? 'lock-outline' : 'earth'}
                size={11}
              />
              <Text style={[styles.accessText, room.tableConfig.isPrivate ? styles.privateText : styles.publicText]}>
                {accessLabel}
              </Text>
            </View>
          </View>
        </View>
        {room.unreadCount > 0 ? <Text style={styles.unreadBadge}>{room.unreadCount}</Text> : null}
      </View>

      <Text style={styles.roomDescription}>{room.description}</Text>
      <View style={styles.previewPanel}>
        <MaterialCommunityIcons color={colors.secondary} name="message-text-outline" size={15} />
        <Text style={styles.previewText}>{room.lastMessagePreview}</Text>
      </View>

      <View style={styles.roomFooter}>
        <View style={styles.metricGroup}>
          <View style={styles.metricPill}>
            <MaterialCommunityIcons color={colors.success} name="account-group" size={14} />
            <Text style={styles.metricText}>{room.activePlayerCount} active</Text>
          </View>
          <View style={styles.metricPill}>
            <MaterialCommunityIcons color={colors.gold} name="seat" size={14} />
            <Text style={styles.metricText}>{room.tableConfig.seatsOpen} seats open</Text>
          </View>
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
  metricPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metricText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '800',
  },
  previewPanel: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(54,231,255,0.08)',
    borderColor: 'rgba(54,231,255,0.16)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  previewText: {
    color: colors.textSoft,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  roomCard: {
    backgroundColor: '#120D2C',
    borderColor: 'rgba(255,201,94,0.28)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    backgroundColor: 'rgba(255,201,94,0.10)',
    borderColor: 'rgba(255,201,94,0.35)',
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
  accessPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  accessText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  privatePill: { backgroundColor: 'rgba(255,201,94,0.12)' },
  privateText: { color: colors.gold },
  publicPill: { backgroundColor: 'rgba(54,231,255,0.10)' },
  publicText: { color: colors.secondary },
  topicRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
