import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type {
  ChatRoomInviteState,
  ChatRoomMessage,
  ChatRoomPlayer,
  ChatRoomTableConfig,
} from '../../types/chatRooms';

import { colors } from '../../theme/colors';
type SocialChatMessageListProps = {
  messages: ChatRoomMessage[];
};

type SocialChatPlayerStripProps = {
  players: ChatRoomPlayer[];
};

type SocialChatTableSetupCardProps = {
  config: ChatRoomTableConfig;
  onOpenTable: () => void;
};

type SocialChatInvitePanelProps = {
  inviteState: ChatRoomInviteState;
};

type SocialChatComposerProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
};

function formatMessageTime(isoDate: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

function getStatusColor(status: ChatRoomPlayer['status']) {
  switch (status) {
    case 'available':
      return colors.success;
    case 'inTable':
      return colors.secondary;
    case 'away':
    default:
      return colors.gold;
  }
}

function getStatusLabel(status: ChatRoomPlayer['status']) {
  switch (status) {
    case 'available':
      return 'Available';
    case 'inTable':
      return 'At table';
    case 'away':
    default:
      return 'Away';
  }
}

export function SocialChatMessageList({ messages }: SocialChatMessageListProps) {
  return (
    <View style={styles.messageStack}>
      {messages.map((message) => {
        const isSystem = message.tone === 'system';

        return (
          <View
            key={message.id}
            style={[styles.messageBubble, isSystem ? styles.systemMessageBubble : null]}
          >
            <View style={styles.messageHeader}>
              <Text style={[styles.messageAuthor, isSystem ? styles.systemText : null]}>
                {message.authorName}
              </Text>
              <Text style={styles.messageTime}>{formatMessageTime(message.createdAt)}</Text>
            </View>
            <Text style={[styles.messageBody, isSystem ? styles.systemText : null]}>{message.body}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SocialChatPlayerStrip({ players }: SocialChatPlayerStripProps) {
  return (
    <View style={styles.playerStack}>
      {players.map((player) => (
        <View key={player.id} style={styles.playerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{player.avatarInitials}</Text>
          </View>
          <View style={styles.playerInfo}>
            <View style={styles.playerNameRow}>
              <Text style={styles.playerName}>{player.displayName}</Text>
              {player.isHost ? <Text style={styles.hostBadge}>Host</Text> : null}
            </View>
            <Text style={styles.playerMeta}>{`${player.handle} • ${player.chipStackLabel}`}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(player.status) }]} />
              <Text style={styles.statusText}>{getStatusLabel(player.status)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function SocialChatTableSetupCard({ config, onOpenTable }: SocialChatTableSetupCardProps) {
  return (
    <View style={styles.tableSetupCard}>
      <View style={styles.tableSetupHeader}>
        <MaterialCommunityIcons color={colors.secondary} name="cards-playing-outline" size={24} />
        <View style={styles.tableSetupTitleGroup}>
          <Text style={styles.tableSetupTitle}>{config.gameLabel}</Text>
          <Text style={styles.tableSetupMeta}>{config.stakesLabel}</Text>
        </View>
      </View>
      <View style={styles.tableStatsGrid}>
        <StatPill label="Seats" value={`${config.maxSeats - config.seatsOpen}/${config.maxSeats}`} />
        <StatPill label="Open" value={`${config.seatsOpen}`} />
        <StatPill label="Code" value={config.tableCode} />
        <StatPill label="Access" value={config.isPrivate ? 'Private' : 'Open'} />
      </View>
      <Pressable onPress={onOpenTable} style={({ pressed }) => [styles.socialButton, pressed ? styles.pressed : null]}>
        <MaterialCommunityIcons color={colors.background} name="door-open" size={18} />
        <Text style={styles.socialButtonText}>Open table from room</Text>
      </Pressable>
    </View>
  );
}

export function SocialChatInvitePanel({ inviteState }: SocialChatInvitePanelProps) {
  return (
    <View style={styles.invitePanel}>
      <Text style={styles.inviteLabel}>Share link</Text>
      <Text style={styles.shareLink}>{inviteState.shareLink}</Text>
      <Text style={styles.inviteLabel}>Pending invites</Text>
      <View style={styles.chipRow}>
        {inviteState.pendingInvites.map((handle) => (
          <Text key={handle} style={styles.inviteChip}>{handle}</Text>
        ))}
      </View>
      <Text style={styles.inviteLabel}>Suggested players</Text>
      <View style={styles.chipRow}>
        {inviteState.suggestedHandles.map((handle) => (
          <Text key={handle} style={styles.suggestedChip}>{handle}</Text>
        ))}
      </View>
    </View>
  );
}

export function SocialChatComposer({ draft, onChangeDraft, onSend }: SocialChatComposerProps) {
  return (
    <View style={styles.composer}>
      <TextInput
        multiline
        onChangeText={onChangeDraft}
        placeholder="Message the room before launching a table..."
        placeholderTextColor={colors.mutedText}
        style={styles.composerInput}
        value={draft}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!draft.trim()}
        onPress={onSend}
        style={({ pressed }) => [
          styles.sendButton,
          !draft.trim() ? styles.sendButtonDisabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <MaterialCommunityIcons color={colors.background} name="send" size={18} />
      </Pressable>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.secondary,
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '900',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  composerInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 108,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  hostBadge: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    color: colors.background,
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inviteChip: {
    backgroundColor: 'rgba(255,201,94,0.16)',
    borderColor: colors.gold,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  invitePanel: {
    gap: 10,
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
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  messageStack: {
    gap: 10,
  },
  messageTime: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  playerCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  playerInfo: {
    flex: 1,
    gap: 5,
  },
  playerMeta: {
    color: colors.mutedText,
    fontSize: 13,
  },
  playerName: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  playerNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  playerStack: {
    gap: 10,
  },
  pressed: {
    opacity: 0.78,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  shareLink: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  socialButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  socialButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: '46%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  statusText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
  suggestedChip: {
    backgroundColor: 'rgba(54,231,255,0.14)',
    borderColor: colors.secondary,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(139,92,255,0.18)',
    borderColor: colors.primary,
  },
  systemText: {
    color: colors.secondary,
  },
  tableSetupCard: {
    gap: 14,
  },
  tableSetupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  tableSetupMeta: {
    color: colors.mutedText,
    fontSize: 13,
  },
  tableSetupTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  tableSetupTitleGroup: {
    flex: 1,
    gap: 3,
  },
  tableStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
