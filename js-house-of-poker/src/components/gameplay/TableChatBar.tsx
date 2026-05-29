import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import {
  getGameplayTopBarHeight,
  landscapeFixedRailSizing,
} from './GameplayLayout';
import { gameplayLayoutConfig } from './layoutConfig';
import type { PokerTableChatMessage } from '../../types/poker';
import {
  getVisibleTableChatMessages,
  normalizeTableChatText,
  TABLE_CHAT_EMOJI_OPTIONS,
  TABLE_CHAT_MESSAGE_CHAR_LIMIT,
} from '../../utils/tableChat';

const gamePlayIcon = require('../../../assets/icon.png');

const INCOMING_CHAT_TOAST_TIMEOUT_MS = 4000;

type Props = {
  chatNotificationCount?: number;
  connectedCount: number;
  inviteNotificationCount?: number;
  isTopBarExpanded?: boolean;
  messages: PokerTableChatMessage[];
  onExitTrainingPress?: () => void;
  onInvitePress?: () => void;
  onSendMessage: (message: string) => void;
  onToggleTopBar?: () => void;
  selfId: string | null;
  showExitTrainingButton?: boolean;
  showInviteButtons?: boolean;
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
  onPress,
}: {
  badgeCount?: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.utilityIcon}>
      <MaterialCommunityIcons color="#F7F4FF" name={icon} size={18} />
      {badgeCount > 0 ? (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{Math.min(badgeCount, 9)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function TableChatBar({
  chatNotificationCount = 0,
  connectedCount,
  inviteNotificationCount = 0,
  isTopBarExpanded = true,
  messages,
  onExitTrainingPress,
  onInvitePress,
  onSendMessage,
  onToggleTopBar,
  selfId,
  showExitTrainingButton = false,
  showInviteButtons = true,
  roomId,
  tableName,
  transportLabel = 'Realtime',
  transportStatus = 'idle',
}: Props) {
  const { height, width } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const [isComposeFocused, setIsComposeFocused] = useState(false);
  const [openPanel, setOpenPanel] = useState<'messages' | 'notifications' | null>(null);
  const pendingSentRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef(new Set(messages.map((message) => message.id)));
  const incomingChatToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [incomingChatMessage, setIncomingChatMessage] = useState<PokerTableChatMessage | null>(null);
  const isCompact = width < 620 && height > width;
  const isLandscapeRail = width > height;
  const topRailHeight = getGameplayTopBarHeight({ height, isLandscape: isLandscapeRail });
  const railBoundedShellStyle = isLandscapeRail
    ? { maxHeight: topRailHeight, minHeight: topRailHeight }
    : null;
  const normalizedDraft = normalizeTableChatText(draft);
  const canSend = normalizedDraft.length > 0;
  const shouldPrioritizeCompose = isCompact && isComposeFocused;
  const tickerMessages = useMemo(() => getVisibleTableChatMessages(messages), [messages]);
  const notificationHeadlines = useMemo(() => {
    const pendingInvites = inviteNotificationCount > 0
      ? [`${inviteNotificationCount} pending table invite${inviteNotificationCount === 1 ? '' : 's'}.`]
      : [];

    return [
      ...pendingInvites,
      transportStatus === 'connected'
        ? `${connectedCount} player${connectedCount === 1 ? '' : 's'} connected to ${tableName}.`
        : `${transportLabel} is ${transportStatus}.`,
      `Room ${roomId} is active.`,
    ];
  }, [connectedCount, inviteNotificationCount, roomId, tableName, transportLabel, transportStatus]);

  useEffect(() => {
    const pendingText = pendingSentRef.current;
    if (!pendingText) {
      return;
    }

    const delivered = messages.some((message) => message.text === pendingText);
    if (delivered) {
      pendingSentRef.current = null;
      setDraft((current) => (normalizeTableChatText(current) === pendingText ? '' : current));
    }
  }, [messages]);

  useEffect(() => {
    const seenMessageIds = seenMessageIdsRef.current;
    const newMessages = messages.filter((message) => !seenMessageIds.has(message.id));
    const latestIncomingMessage = newMessages
      .filter((message) => message.playerId !== null && message.playerId !== selfId)
      .at(-1);

    messages.forEach((message) => {
      seenMessageIds.add(message.id);
    });

    if (latestIncomingMessage) {
      setIncomingChatMessage(latestIncomingMessage);
    }
  }, [messages, selfId]);

  useEffect(() => {
    if (!incomingChatMessage) {
      return undefined;
    }

    if (incomingChatToastTimerRef.current) {
      clearTimeout(incomingChatToastTimerRef.current);
    }

    incomingChatToastTimerRef.current = setTimeout(() => {
      setIncomingChatMessage(null);
      incomingChatToastTimerRef.current = null;
    }, INCOMING_CHAT_TOAST_TIMEOUT_MS);

    return () => {
      if (incomingChatToastTimerRef.current) {
        clearTimeout(incomingChatToastTimerRef.current);
        incomingChatToastTimerRef.current = null;
      }
    };
  }, [incomingChatMessage]);

  useEffect(() => {
    if (!isTopBarExpanded) {
      setOpenPanel(null);
    }
  }, [isTopBarExpanded]);

  function handleSend() {
    if (!normalizedDraft) {
      return;
    }

    pendingSentRef.current = normalizedDraft;
    onSendMessage(normalizedDraft);
  }

  function handleAddEmoji(emoji: string) {
    setDraft((current) =>
      `${current}${current.length > 0 ? ' ' : ''}${emoji}`.slice(
        0,
        TABLE_CHAT_MESSAGE_CHAR_LIMIT,
      ),
    );
  }

  function renderTopBarToggle() {
    return (
      <Pressable
        accessibilityLabel={isTopBarExpanded ? 'Collapse top bar' : 'Expand top bar'}
        accessibilityRole="button"
        disabled={!onToggleTopBar}
        onPress={onToggleTopBar}
        style={styles.touchTarget}
      >
        <MaterialCommunityIcons
          color="#FFFFFF"
          name="menu"
          size={gameplayLayoutConfig.topBar.menuIconSize}
        />
      </Pressable>
    );
  }

  function renderIncomingChatToast() {
    if (!incomingChatMessage) {
      return null;
    }

    const constrainedText = normalizeTableChatText(incomingChatMessage.text);

    return (
      <View
        pointerEvents="none"
        style={[
          styles.incomingChatToast,
          isLandscapeRail ? styles.incomingChatToastLandscape : null,
        ]}
      >
        <View style={styles.incomingChatToastIcon}>
          <MaterialCommunityIcons color="#F7F4FF" name="message-text" size={16} />
        </View>
        <View style={styles.incomingChatToastCopy}>
          <Text numberOfLines={1} style={styles.incomingChatToastTitle}>
            {incomingChatMessage.playerName}
          </Text>
          <Text numberOfLines={2} style={styles.incomingChatToastText}>
            {constrainedText}
          </Text>
        </View>
      </View>
    );
  }

  function renderComposeRail() {
    return (
      <View style={styles.composeRail}>
        <MaterialCommunityIcons color="#B35CFF" name="message-processing-outline" size={18} />

        <TextInput
          maxLength={TABLE_CHAT_MESSAGE_CHAR_LIMIT}
          onBlur={() => setIsComposeFocused(false)}
          onChangeText={setDraft}
          onFocus={() => setIsComposeFocused(true)}
          placeholder="Type your message..."
          placeholderTextColor="rgba(235, 231, 255, 0.4)"
          returnKeyType="done"
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
    );
  }

  function renderTickerControl() {
    const latestMessage = tickerMessages.at(-1);

    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpenPanel((current) => (current === 'messages' ? null : 'messages'))}
        style={styles.chatTickerControl}
      >
        <MaterialCommunityIcons color="#D780FF" name="chat-outline" size={17} />
        {latestMessage ? (
          <Text numberOfLines={1} style={styles.chatTickerText}>
            <Text style={styles.tickerName}>{latestMessage.playerName}:</Text> {latestMessage.text}
          </Text>
        ) : (
          <Text numberOfLines={1} style={styles.chatTickerTextMuted}>
            Room {roomId} chat
          </Text>
        )}
      </Pressable>
    );
  }

  function renderScrollableControls() {
    return (
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.controlsScroll}
        contentContainerStyle={styles.controlsScrollContent}
      >
        <View style={styles.composeControl}>{renderComposeRail()}</View>
        {renderTickerControl()}

        {showExitTrainingButton && onExitTrainingPress ? (
          <Pressable
            accessibilityLabel="Exit bot training table"
            accessibilityRole="button"
            onPress={onExitTrainingPress}
            style={styles.exitTrainingButton}
          >
            <MaterialCommunityIcons color="#FFD4C7" name="door-open" size={18} />
            <Text numberOfLines={1} style={styles.exitTrainingButtonText}>
              EXIT TRAINING
            </Text>
          </Pressable>
        ) : null}

        {showInviteButtons ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={onInvitePress}
              style={styles.inviteButton}
            >
              <MaterialCommunityIcons color="#67F3BB" name="account-plus-outline" size={18} />
              <Text style={styles.inviteButtonText}>INVITE</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Invite friends"
              accessibilityRole="button"
              onPress={onInvitePress}
              style={styles.friendInviteButton}
            >
              <MaterialCommunityIcons color="#F2C9FF" name="account-multiple-plus-outline" size={18} />
              <Text style={styles.friendInviteButtonText}>FRIENDS</Text>
            </Pressable>
          </>
        ) : null}

        <NotificationIcon
          badgeCount={inviteNotificationCount}
          icon="bell-outline"
          onPress={() => setOpenPanel((current) => (current === 'notifications' ? null : 'notifications'))}
        />
        <NotificationIcon
          badgeCount={chatNotificationCount}
          icon="message-text-outline"
          onPress={() => setOpenPanel((current) => (current === 'messages' ? null : 'messages'))}
        />
      </ScrollView>
    );
  }

  if (!isTopBarExpanded) {
    return (
      <LinearGradient
        colors={['rgba(9, 6, 18, 0.98)', 'rgba(5, 4, 13, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.shell, styles.shellCollapsed, railBoundedShellStyle]}
      >
        {renderTopBarToggle()}
        {renderIncomingChatToast()}
      </LinearGradient>
    );
  }

  if (shouldPrioritizeCompose) {
    return (
      <LinearGradient
        colors={['rgba(9, 6, 18, 0.98)', 'rgba(5, 4, 13, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.shell, styles.shellComposePriority, railBoundedShellStyle]}
      >
        <View style={styles.composePriorityRow}>
          {renderTopBarToggle()}
          <View style={styles.composePriorityShell}>{renderComposeRail()}</View>
        </View>
        {renderIncomingChatToast()}
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['rgba(9, 6, 18, 0.98)', 'rgba(5, 4, 13, 0.99)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[
        styles.shell,
        isCompact ? styles.shellCompact : null,
        railBoundedShellStyle,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.brandRail}>
          {renderTopBarToggle()}

          <View style={styles.signalWrap}>
            <MaterialCommunityIcons
              color={getSignalColor(transportStatus)}
              name="signal-cellular-3"
              size={20}
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

        {renderScrollableControls()}
      </View>

      {renderIncomingChatToast()}

      {openPanel ? (
        <View style={[styles.popover, isLandscapeRail ? styles.popoverLandscape : null]}>
          <View style={styles.popoverHeader}>
            <Text style={styles.popoverTitle}>
              {openPanel === 'messages' ? 'Table messages' : 'Notifications'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setOpenPanel(null)}>
              <MaterialCommunityIcons color="rgba(247,244,255,0.76)" name="close" size={16} />
            </Pressable>
          </View>

          {openPanel === 'messages' ? (
            tickerMessages.length > 0 ? (
              tickerMessages.map((message) => (
                <View key={message.id} style={styles.popoverItem}>
                  <Text numberOfLines={1} style={styles.popoverItemTitle}>{message.playerName}</Text>
                  <Text numberOfLines={2} style={styles.popoverItemText}>{message.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.popoverEmpty}>No chat messages yet.</Text>
            )
          ) : (
            notificationHeadlines.map((headline) => (
              <View key={headline} style={styles.popoverItem}>
                <Text numberOfLines={2} style={styles.popoverItemText}>{headline}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  brandRail: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  chatTickerControl: {
    alignItems: 'center',
    borderColor: 'rgba(180, 84, 255, 0.26)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 10,
    width: 180,
  },
  chatTickerText: {
    color: '#F7F4FF',
    flex: 1,
    fontSize: 12,
    minWidth: 0,
  },
  chatTickerTextMuted: {
    color: 'rgba(235, 231, 255, 0.56)',
    flex: 1,
    fontSize: 12,
    minWidth: 0,
  },
  composeInput: {
    color: '#F7F4FF',
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  composeControl: {
    flexShrink: 0,
    width: 280,
  },
  composeRail: {
    alignItems: 'center',
    borderColor: 'rgba(180, 84, 255, 0.38)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  composePriorityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  composePriorityShell: {
    flex: 1,
    minWidth: 0,
  },
  controlsScroll: {
    flex: 1,
    minWidth: 0,
  },
  controlsScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 6,
    paddingRight: 6,
  },
  emojiButton: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  emojiRail: {
    flexDirection: 'row',
    gap: 2,
  },
  emojiText: {
    fontSize: 18,
  },
  exitTrainingButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(70, 18, 22, 0.96)',
    borderColor: 'rgba(255, 115, 98, 0.38)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  exitTrainingButtonText: {
    color: '#FFD4C7',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 29, 14, 0.98)',
    borderColor: 'rgba(103, 243, 187, 0.38)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  inviteButtonText: {
    color: '#67F3BB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  friendInviteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(35, 14, 50, 0.98)',
    borderColor: 'rgba(242, 201, 255, 0.3)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  friendInviteButtonText: {
    color: '#F2C9FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  incomingChatToast: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(38, 15, 72, 0.98)',
    borderColor: 'rgba(215, 128, 255, 0.54)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 360,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    shadowColor: '#B35CFF',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    top: 54,
    width: '70%',
    zIndex: 120,
  },
  incomingChatToastLandscape: {
    maxHeight: landscapeFixedRailSizing.topBarMaxHeight - 8,
    minHeight: landscapeFixedRailSizing.topBarMinHeight - 8,
    paddingVertical: 5,
    top: 4,
    width: 340,
  },
  incomingChatToastCopy: {
    flex: 1,
    minWidth: 0,
  },
  incomingChatToastIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(179, 92, 255, 0.48)',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  incomingChatToastText: {
    color: '#F7F4FF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  incomingChatToastTitle: {
    color: '#F2C9FF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  logoFrame: {
    height: 38,
    overflow: 'hidden',
    position: 'relative',
    width: 38,
  },
  logoImage: {
    height: 35,
    width: 35,
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
    gap: 8,
    maxHeight: gameplayLayoutConfig.topBar.portraitMaxHeight - 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(67, 34, 118, 0.92)',
    borderColor: 'rgba(180, 84, 255, 0.48)',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 65,
    paddingHorizontal: 12,
  },
  sendButtonEnabled: {
    backgroundColor: 'rgba(84, 28, 154, 0.98)',
  },
  sendButtonText: {
    color: 'rgba(235, 231, 255, 0.56)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  sendButtonTextEnabled: {
    color: '#F7F4FF',
  },
  shell: {
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 0,
    maxHeight: gameplayLayoutConfig.topBar.portraitMaxHeight,
    paddingHorizontal: gameplayLayoutConfig.topBar.shellPaddingHorizontal,
    paddingVertical: 5,
  },
  shellCompact: {
    maxHeight: gameplayLayoutConfig.topBar.portraitMaxHeight,
  },
  shellComposePriority: {
    borderRadius: 14,
    maxHeight: gameplayLayoutConfig.topBar.portraitMaxHeight,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  shellCollapsed: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    gap: 0,
    paddingHorizontal: 3,
    paddingVertical: 3,
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
  popover: {
    backgroundColor: 'rgba(9, 6, 18, 0.98)',
    borderColor: 'rgba(180, 84, 255, 0.38)',
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 330,
    padding: 10,
    position: 'absolute',
    right: 10,
    top: 46,
    width: '34%',
    zIndex: 90,
  },
  popoverLandscape: {
    maxHeight: landscapeFixedRailSizing.topBarMaxHeight - 8,
    overflow: 'hidden',
    padding: 6,
    top: 4,
    width: 320,
  },
  popoverEmpty: {
    color: 'rgba(235, 231, 255, 0.64)',
    fontSize: 12,
    fontWeight: '700',
  },
  popoverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  popoverItem: {
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    paddingVertical: 6,
  },
  popoverItemText: {
    color: '#F7F4FF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  popoverItemTitle: {
    color: '#D780FF',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 2,
  },
  popoverTitle: {
    color: '#F7F4FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  touchTarget: {
    alignItems: 'center',
    height: gameplayLayoutConfig.topBar.touchTargetSize,
    justifyContent: 'center',
    width: gameplayLayoutConfig.topBar.touchTargetSize,
  },
  utilityIcon: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    position: 'relative',
    width: 38,
  },
});
