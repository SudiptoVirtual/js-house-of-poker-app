import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import type { ChatRoom, ChatRoomMessage, ChatRoomPlayer } from '../../types/chatRooms';
import { formatChatTimestamp } from './chatRoomUtils';

const directLocalBubbleColor = '#087260';

type ChatMessageItemProps = {
  chatType?: ChatRoom['chatType'];
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

export function ChatMessageItem({ chatType = 'group', currentUserId = 'local-player', message, players = [] }: ChatMessageItemProps) {
  const isDirectChat = chatType === 'direct';
  const isSystem = message.tone === 'system' || message.kind === 'system' || message.messageType === 'system';
  const isCurrentUser = message.authorId === currentUserId;
  const isGiftClip = isGiftClipMessage(message);
  const giftClipNote = message.giftClip?.message || message.body;
  const timestamp = formatChatTimestamp(message.createdAt);
  const showRoomAvatar = !isDirectChat && !isCurrentUser;
  const showRoomHeader = !isDirectChat;
  const showDirectFooter = isDirectChat && !isSystem;

  if (isSystem) {
    return (
      <View style={[styles.systemRow, isDirectChat ? styles.directSystemRow : null]}>
        <View style={[styles.systemPill, isDirectChat ? styles.directSystemPill : null]}>
          <Text style={styles.systemPillText}>{message.body}</Text>
          <Text style={styles.systemPillTime}>{timestamp}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        isDirectChat ? styles.directRow : null,
        isDirectChat && isCurrentUser ? styles.directLocalRow : null,
        !isDirectChat && isCurrentUser ? styles.localRow : null,
      ]}
    >
      {showRoomAvatar ? (
        <View style={[styles.avatar, isGiftClip ? styles.giftAvatar : null]}>
          {isGiftClip ? (
            <MaterialCommunityIcons color={colors.background} name="gift-outline" size={18} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(message.authorName)}</Text>
          )}
        </View>
      ) : null}
      <View
        style={[
          styles.messageBubble,
          isDirectChat ? styles.directMessageBubble : null,
          isGiftClip ? styles.giftClipBubble : null,
          isCurrentUser ? styles.localMessageBubble : null,
          isDirectChat && isCurrentUser ? styles.directLocalMessageBubble : null,
          isDirectChat && !isCurrentUser ? styles.directRecipientMessageBubble : null,
        ]}
      >
        {showRoomHeader ? (
          <View style={styles.messageHeader}>
            <Text style={styles.messageAuthor}>{message.authorName}</Text>
            <Text style={[styles.messageTime, isCurrentUser ? styles.localMessageTime : null]}>{timestamp}</Text>
          </View>
        ) : null}
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
          <Text style={[styles.messageBody, isDirectChat ? styles.directMessageBody : null]}>{message.body}</Text>
        )}
        {message.attachments?.length ? (
          <View style={styles.mediaStack}>
            {message.attachments.map((attachment, index) => attachment.type === 'image' ? (
              <Image key={`${attachment.url}-${index}`} source={{ uri: attachment.url }} style={styles.mediaImage} />
            ) : (
              <View key={`${attachment.url}-${index}`} style={styles.videoCard}>
                <MaterialCommunityIcons color={colors.gold} name="play-circle-outline" size={28} />
                <Text style={styles.videoText}>Video attachment</Text>
              </View>
            ))}
          </View>
        ) : null}
        {showDirectFooter ? (
          <View style={[styles.directMessageFooter, isCurrentUser ? styles.directLocalMessageFooter : null]}>
            <Text style={[styles.messageTime, isCurrentUser ? styles.directLocalMessageTime : null]}>
              {timestamp}{isCurrentUser ? ' • Sent' : ''}
            </Text>
          </View>
        ) : null}
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
  directLocalMessageBubble: {
    backgroundColor: directLocalBubbleColor,
    borderColor: directLocalBubbleColor,
    borderBottomRightRadius: 6,
  },
  directLocalMessageFooter: {
    justifyContent: 'flex-end',
  },
  directLocalMessageTime: {
    color: colors.text,
  },
  directLocalRow: {
    justifyContent: 'flex-end',
  },
  directMessageBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  directMessageBubble: {
    borderRadius: 20,
    flex: 0,
    maxWidth: '78%',
    minWidth: 72,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  directMessageFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 2,
  },
  directRecipientMessageBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderColor: colors.border,
  },
  directRow: {
    gap: 0,
    justifyContent: 'flex-start',
  },
  directSystemPill: {
    maxWidth: '82%',
    paddingVertical: 8,
  },
  directSystemRow: {
    marginVertical: 2,
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
  mediaImage: { borderRadius: 12, height: 180, width: '100%' },
  mediaStack: { gap: 8 },
  videoCard: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 6, justifyContent: 'center', minHeight: 140 },
  videoText: { color: colors.text, fontWeight: '800' },
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
  systemPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,255,0.18)',
    borderColor: colors.primary,
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  systemPillText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  systemPillTime: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  systemRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
