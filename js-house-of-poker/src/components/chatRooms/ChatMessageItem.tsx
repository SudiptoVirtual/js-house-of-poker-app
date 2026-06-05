import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import type { ChatRoomMessage, ChatRoomPlayer } from '../../types/chatRooms';
import { formatChatTimestamp } from './chatRoomUtils';

type ChatMessageItemProps = {
  currentUserId?: string;
  message: ChatRoomMessage;
  players?: ChatRoomPlayer[];
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isGiftClipMessage(message: ChatRoomMessage) {
  return Boolean(message.giftClip) || message.kind === 'gift_clip' || message.messageType === 'gift_clip';
}

function getRecipientName(message: ChatRoomMessage, players: ChatRoomPlayer[]) {
  const recipientUserId = message.giftClip?.recipientUserId;

  if (!recipientUserId) {
    return 'room player';
  }

  const recipient = players.find((player) => player.userId === recipientUserId || player.id === recipientUserId);

  return recipient?.displayName ?? 'room player';
}

export function ChatMessageItem({ currentUserId = 'local-player', message, players = [] }: ChatMessageItemProps) {
  const isSystem = message.tone === 'system';
  const isCurrentUser = message.authorId === currentUserId;
  const isGiftClip = isGiftClipMessage(message);
  const giftClipNote = message.giftClip?.message || message.body;

  return (
    <View style={[styles.row, isCurrentUser ? styles.localRow : null]}>
      <View
        style={[
          styles.avatar,
          isGiftClip ? styles.giftAvatar : null,
          isSystem ? styles.systemAvatar : null,
          isCurrentUser ? styles.localAvatar : null,
        ]}
      >
        {isGiftClip ? (
          <MaterialCommunityIcons color={colors.background} name="gift-outline" size={18} />
        ) : (
          <Text style={[styles.avatarText, isCurrentUser ? styles.localAvatarText : null]}>
            {isSystem ? 'HB' : getInitials(message.authorName)}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.messageBubble,
          isGiftClip ? styles.giftClipBubble : null,
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
        {isGiftClip ? (
          <View style={styles.giftClipCard}>
            <View style={styles.giftClipTitleRow}>
              <MaterialCommunityIcons color={colors.gold} name="gift-outline" size={18} />
              <Text style={styles.giftClipTitle}>Gift Clips sent</Text>
            </View>
            <Text style={styles.giftClipAmount}>{(message.giftClip?.amount ?? 0).toLocaleString()} Clips</Text>
            <Text style={styles.giftClipRoute}>
              {message.authorName} → {getRecipientName(message, players)}
            </Text>
            {giftClipNote ? <Text style={styles.giftClipNote}>“{giftClipNote}”</Text> : null}
          </View>
        ) : (
          <Text style={[styles.messageBody, isSystem ? styles.systemText : null]}>{message.body}</Text>
        )}
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
  giftAvatar: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  giftClipAmount: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '900',
  },
  giftClipBubble: {
    backgroundColor: 'rgba(255,201,94,0.12)',
    borderColor: colors.gold,
  },
  giftClipCard: {
    gap: 6,
  },
  giftClipNote: {
    color: colors.text,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '700',
    lineHeight: 20,
  },
  giftClipRoute: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '800',
  },
  giftClipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  giftClipTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
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
