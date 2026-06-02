import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatRoomMessage } from '../../types/chatRooms';
import { formatChatTimestamp } from './chatRoomUtils';

type ChatMessageItemProps = {
  currentUserId?: string;
  message: ChatRoomMessage;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ChatMessageItem({ currentUserId = 'local-player', message }: ChatMessageItemProps) {
  const isSystem = message.tone === 'system';
  const isCurrentUser = message.authorId === currentUserId;

  return (
    <View style={[styles.row, isCurrentUser ? styles.localRow : null]}>
      <View style={[styles.avatar, isSystem ? styles.systemAvatar : null, isCurrentUser ? styles.localAvatar : null]}>
        <Text style={[styles.avatarText, isCurrentUser ? styles.localAvatarText : null]}>
          {isSystem ? 'HB' : getInitials(message.authorName)}
        </Text>
      </View>
      <View
        style={[
          styles.messageBubble,
          isSystem ? styles.systemMessageBubble : null,
          isCurrentUser ? styles.localMessageBubble : null,
        ]}
      >
        <View style={styles.messageHeader}>
          <Text style={[styles.messageAuthor, isSystem ? styles.systemText : null]}>{message.authorName}</Text>
          <Text style={[styles.messageTime, isCurrentUser ? styles.localMessageTime : null]}>
            {formatChatTimestamp(message.createdAt)}
          </Text>
        </View>
        <Text style={[styles.messageBody, isSystem ? styles.systemText : null]}>{message.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.secondary,
    borderRadius: 17,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '900',
  },
  localAvatar: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  localAvatarText: {
    color: colors.background,
  },
  localMessageBubble: {
    backgroundColor: 'rgba(77,243,199,0.16)',
    borderColor: colors.success,
  },
  localMessageTime: {
    color: colors.success,
  },
  localRow: {
    flexDirection: 'row-reverse',
  },
  messageAuthor: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  messageBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  messageBubble: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  messageTime: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  systemAvatar: {
    borderColor: colors.primary,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(139,92,255,0.18)',
    borderColor: colors.primary,
  },
  systemText: {
    color: colors.secondary,
  },
});
