import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatRoom } from '../../types/chatRooms';

import { colors } from '../../theme/colors';
type ChatInboxRoom = Pick<
  ChatRoom,
  'activePlayerCount' | 'lastMessagePreview' | 'messages' | 'players' | 'tableConfig' | 'title' | 'topic' | 'unreadCount'
> & {
  avatarUrl?: string | null;
  imageUrl?: string | null;
};

type ChatInboxListItemProps = {
  onEnter: () => void;
  room: ChatInboxRoom;
};

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('') || 'HP';
}

function formatLastMessageTime(room: ChatInboxRoom) {
  const lastMessage = room.messages.at(-1);

  if (!lastMessage?.createdAt) {
    return room.tableConfig.isPrivate ? 'Private' : 'Live';
  }

  const createdAt = new Date(lastMessage.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return 'Now';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(createdAt);
}

export function ChatInboxListItem({ onEnter, room }: ChatInboxListItemProps) {
  const avatarSource = room.avatarUrl ?? room.imageUrl;
  const isGroupChat = room.players.length > 2 || !room.tableConfig.isPrivate;
  const unreadCount = Math.min(room.unreadCount, 99);
  const messagePreview = room.lastMessagePreview;

  return (
    <Pressable
      accessibilityLabel={`Open ${room.title}`}
      accessibilityRole="button"
      onPress={onEnter}
      style={({ pressed }) => [styles.row, unreadCount > 0 ? styles.unreadRow : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.avatarRing, isGroupChat ? styles.groupAvatarRing : styles.directAvatarRing]}>
        {avatarSource ? (
          <Image accessibilityIgnoresInvertColors source={{ uri: avatarSource }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{getInitials(room.title)}</Text>
        )}
        <View style={[styles.chatTypeDot, isGroupChat ? styles.groupDot : styles.directDot]}>
          <MaterialCommunityIcons
            color={colors.background}
            name={isGroupChat ? 'account-group' : 'account'}
            size={11}
          />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={[styles.title, unreadCount > 0 ? styles.unreadTitle : null]}>
            {room.title}
          </Text>
          <Text style={[styles.timeText, unreadCount > 0 ? styles.unreadTimeText : null]}>
            {formatLastMessageTime(room)}
          </Text>
        </View>

        <View style={styles.previewLine}>
          <Text numberOfLines={1} style={[styles.preview, unreadCount > 0 ? styles.unreadPreview : null]}>
            {messagePreview}
          </Text>
          {unreadCount > 0 ? (
            <Text accessibilityLabel={`${unreadCount} unread messages`} style={styles.unreadBadge}>
              {unreadCount}
            </Text>
          ) : (
            <View accessibilityLabel="Read" style={styles.readIndicator}>
              <MaterialCommunityIcons color={colors.success} name="check-all" size={16} />
            </View>
          )}
        </View>

        <View style={styles.metaLine}>
          <View style={[styles.chatTypePill, isGroupChat ? styles.groupPill : styles.directPill]}>
            <MaterialCommunityIcons
              color={isGroupChat ? colors.secondary : colors.gold}
              name={isGroupChat ? 'cards-playing-outline' : 'poker-chip'}
              size={12}
            />
            <Text style={[styles.chatTypeText, isGroupChat ? styles.groupText : styles.directText]}>
              {isGroupChat ? `${room.activePlayerCount} players at table` : 'Heads-up chat'}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.topicText}>{room.topic}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  chatTypeDot: {
    alignItems: 'center',
    borderColor: colors.background,
    borderRadius: 10,
    borderWidth: 2,
    bottom: -1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 20,
  },
  chatTypePill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chatTypeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  directAvatarRing: {
    backgroundColor: 'rgba(255,201,94,0.12)',
    borderColor: colors.gold,
  },
  directDot: {
    backgroundColor: colors.gold,
  },
  directPill: {
    backgroundColor: 'rgba(255,201,94,0.12)',
  },
  directText: {
    color: colors.gold,
  },
  groupAvatarRing: {
    backgroundColor: 'rgba(54,231,255,0.12)',
    borderColor: colors.secondary,
  },
  groupDot: {
    backgroundColor: colors.secondary,
  },
  groupPill: {
    backgroundColor: 'rgba(54,231,255,0.11)',
  },
  groupText: {
    color: colors.secondary,
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  preview: {
    color: colors.mutedText,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  previewLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  readIndicator: {
    alignItems: 'center',
    minWidth: 24,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#100B27',
    borderColor: 'rgba(64,48,112,0.75)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  timeText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  topicText: {
    color: colors.mutedText,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 24,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
    textAlign: 'center',
  },
  unreadPreview: {
    color: colors.text,
    fontWeight: '800',
  },
  unreadRow: {
    backgroundColor: '#171037',
    borderColor: colors.primary,
  },
  unreadTimeText: {
    color: colors.success,
  },
  unreadTitle: {
    color: colors.white,
    fontWeight: '900',
  },
});
