import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerTableChatMessage } from '../../types/poker';
import {
  normalizeTableChatText,
  TABLE_CHAT_EMOJI_OPTIONS,
  TABLE_CHAT_MESSAGE_CHAR_LIMIT,
} from '../../utils/tableChat';

const gamePlayIcon = require('../../../assets/images/game-play-icon.png');

type Props = {
  chatNotificationCount?: number;
  connectedCount: number;
  inviteNotificationCount?: number;
  messages: PokerTableChatMessage[];
  onInvitePress?: () => void;
  onSendMessage: (message: string) => void;
  roomId: string;
  tableName: string;
  transportLabel?: string;
  transportStatus?: 'connected' | 'connecting' | 'disconnected' | 'error' | 'idle' | 'reconnecting';
};

function getSignalColor(status: Props['transportStatus']) {
  switch (status) {
    case 'connected':
      return '#67F3BB';
    case 'connecting':
    case 'reconnecting':
      return '#FFC66C';
    case 'error':
    case 'disconnected':
      return '#FF6EAA';
    case 'idle':
    default:
      return '#A6A2C2';
  }
}

function NotificationIcon({
  badgeCount = 0,
  icon,
}: {
  badgeCount?: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <View style={styles.utilityIcon}>
      <MaterialCommunityIcons color="#F7F4FF" name={icon} size={20} />
      {badgeCount > 0 ? (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{Math.min(badgeCount, 9)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function TableChatBar({
  chatNotificationCount = 0,
  connectedCount,
  inviteNotificationCount = 0,
  messages,
  onInvitePress,
  onSendMessage,
  roomId,
  tableName,
  transportLabel = 'Realtime',
  transportStatus = 'idle',
}: Props) {
  const { height, width } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const isCompact = width < 620 && height > width;
  const canSend = normalizeTableChatText(draft).length > 0;
  const tickerMessages = useMemo(() => messages.slice(-3), [messages]);

  function handleSend() {
    const normalized = normalizeTableChatText(draft);
    if (!normalized) {
      return;
    }

    onSendMessage(normalized);
    setDraft('');
  }

  function handleAddEmoji(emoji: string) {
    setDraft((current) =>
      `${current}${current.length > 0 ? ' ' : ''}${emoji}`.slice(
        0,
        TABLE_CHAT_MESSAGE_CHAR_LIMIT,
      ),
    );
  }

  return (
    <LinearGradient
      colors={['rgba(9, 6, 18, 0.98)', 'rgba(5, 4, 13, 0.99)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.shell, isCompact ? styles.shellCompact : null]}
    >
      <View style={[styles.row, isCompact ? styles.rowCompact : null]}>
        <View style={styles.brandRail}>
          <View style={styles.touchTarget}>
            <MaterialCommunityIcons color="#FFFFFF" name="menu" size={30} />
          </View>

          <View style={styles.signalWrap}>
            <MaterialCommunityIcons
              color={getSignalColor(transportStatus)}
              name="signal-cellular-3"
              size={22}
            />
            <Text style={styles.signalText}>{connectedCount}</Text>
          </View>

          <View style={styles.logoFrame}>
            <Image
              resizeMode="contain"
              source={gamePlayIcon}
              style={styles.logoImage}
            />
          </View>
        </View>

        <View style={styles.composeShell}>
          <View style={styles.composeRail}>
            <MaterialCommunityIcons color="#B35CFF" name="message-processing-outline" size={20} />

            <TextInput
              maxLength={TABLE_CHAT_MESSAGE_CHAR_LIMIT}
              onChangeText={setDraft}
              onSubmitEditing={handleSend}
              placeholder="Type your message..."
              placeholderTextColor="rgba(235, 231, 255, 0.4)"
              style={styles.composeInput}
              value={draft}
            />

            <View style={styles.emojiRail}>
              {TABLE_CHAT_EMOJI_OPTIONS.slice(0, 1).map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  onPress={() => handleAddEmoji(emoji)}
                  style={styles.emojiButton}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!canSend}
              onPress={handleSend}
              style={[styles.sendButton, canSend ? styles.sendButtonEnabled : null]}
            >
              <Text style={[styles.sendButtonText, canSend ? styles.sendButtonTextEnabled : null]}>
                SEND
              </Text>
            </Pressable>
          </View>

          {isCompact ? (
            <View style={styles.tickerRail}>
              {tickerMessages.length > 0 ? (
                tickerMessages.map((message) => (
                  <Text key={message.id} numberOfLines={1} style={styles.tickerText}>
                    <Text style={styles.tickerName}>{message.playerName}:</Text> {message.text}
                  </Text>
                ))
              ) : (
                <Text numberOfLines={1} style={styles.tickerTextMuted}>
                  Room {roomId} is ready. Send the first message to {tableName}.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRail}>
          <Pressable
            accessibilityRole="button"
            onPress={onInvitePress}
            style={styles.inviteButton}
          >
            <MaterialCommunityIcons color="#67F3BB" name="account-plus-outline" size={20} />
            <Text style={styles.inviteButtonText}>INVITE</Text>
          </Pressable>

          <NotificationIcon badgeCount={inviteNotificationCount} icon="bell-outline" />
          <NotificationIcon badgeCount={chatNotificationCount} icon="message-text-outline" />
        </View>
      </View>

      {isCompact ? (
        <View style={styles.footerMeta}>
          <Text style={styles.footerMetaText}>{tableName}</Text>
          <Text style={styles.footerMetaDivider}>|</Text>
          <Text style={styles.footerMetaText}>{roomId}</Text>
          <Text style={styles.footerMetaDivider}>|</Text>
          <Text style={styles.footerMetaText}>{transportLabel}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  actionsRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  brandRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  composeInput: {
    color: '#F7F4FF',
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  composeRail: {
    alignItems: 'center',
    borderColor: 'rgba(180, 84, 255, 0.38)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  composeShell: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  emojiButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emojiRail: {
    flexDirection: 'row',
    gap: 2,
  },
  emojiText: {
    fontSize: 20,
  },
  footerMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  footerMetaDivider: {
    color: 'rgba(235, 231, 255, 0.36)',
    fontSize: 12,
    fontWeight: '700',
  },
  footerMetaText: {
    color: 'rgba(235, 231, 255, 0.64)',
    fontSize: 11,
    fontWeight: '700',
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 29, 14, 0.98)',
    borderColor: 'rgba(103, 243, 187, 0.38)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  inviteButtonText: {
    color: '#67F3BB',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  logoFrame: {
    height: 48,
    overflow: 'hidden',
    position: 'relative',
    width: 96,
  },
  logoImage: {
    height: 48,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 190,
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#D8192E',
    borderRadius: 999,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    top: -4,
    width: 16,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  rowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(67, 34, 118, 0.92)',
    borderColor: 'rgba(180, 84, 255, 0.48)',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 12,
  },
  sendButtonEnabled: {
    backgroundColor: 'rgba(84, 28, 154, 0.98)',
  },
  sendButtonText: {
    color: 'rgba(235, 231, 255, 0.56)',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sendButtonTextEnabled: {
    color: '#F7F4FF',
  },
  shell: {
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  shellCompact: {
    gap: 12,
  },
  signalText: {
    color: '#F7F4FF',
    fontSize: 11,
    fontWeight: '800',
  },
  signalWrap: {
    alignItems: 'center',
    gap: 1,
    minWidth: 28,
  },
  tickerName: {
    color: '#D780FF',
    fontWeight: '900',
  },
  tickerRail: {
    alignItems: 'center',
    borderColor: 'rgba(180, 84, 255, 0.2)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  tickerText: {
    color: '#F7F4FF',
    flex: 1,
    fontSize: 12,
    minWidth: 0,
  },
  tickerTextMuted: {
    color: 'rgba(235, 231, 255, 0.56)',
    fontSize: 12,
  },
  touchTarget: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  utilityIcon: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
});
