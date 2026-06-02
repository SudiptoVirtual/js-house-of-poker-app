import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';
import { getPlayerStatusColor, getPlayerStatusLabel } from './chatRoomUtils';

type RoomPlayerListProps = {
  invitedPlayerIds?: string[];
  onTogglePlayer?: (playerId: string) => void;
  players: ChatRoomPlayer[];
  selectedPlayerIds?: string[];
};

function getInviteToggleState(player: ChatRoomPlayer, selectedPlayerIds: string[], invitedPlayerIds: string[]) {
  const isInvited = invitedPlayerIds.includes(player.id);
  const isSelected = selectedPlayerIds.includes(player.id);
  const isAvailable = player.status === 'available';

  if (isInvited) {
    return { disabled: true, icon: 'email-check' as const, label: 'Invited', state: 'invited' as const };
  }

  if (!isAvailable) {
    return { disabled: true, icon: 'account-cancel' as const, label: 'Unavailable', state: 'unavailable' as const };
  }

  if (isSelected) {
    return { disabled: false, icon: 'check-circle' as const, label: 'Selected', state: 'selected' as const };
  }

  return { disabled: false, icon: 'account-plus' as const, label: 'Select', state: 'selectable' as const };
}

export function RoomPlayerList({
  invitedPlayerIds = [],
  onTogglePlayer,
  players,
  selectedPlayerIds = [],
}: RoomPlayerListProps) {
  return (
    <View style={styles.playerStack}>
      {players.map((player) => {
        const inviteState = getInviteToggleState(player, selectedPlayerIds, invitedPlayerIds);

        return (
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
                <View style={[styles.statusDot, { backgroundColor: getPlayerStatusColor(player.status) }]} />
                <Text style={styles.statusText}>{getPlayerStatusLabel(player.status)}</Text>
              </View>
            </View>
            {onTogglePlayer ? (
              <Pressable
                accessibilityLabel={`${inviteState.label} ${player.displayName}`}
                accessibilityRole="button"
                disabled={inviteState.disabled}
                onPress={() => onTogglePlayer(player.id)}
                style={({ pressed }) => [
                  styles.inviteButton,
                  inviteState.state === 'selected' ? styles.selectedButton : null,
                  inviteState.state === 'invited' ? styles.invitedButton : null,
                  inviteState.state === 'unavailable' ? styles.unavailableButton : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={inviteState.state === 'selectable' ? colors.background : colors.text}
                  name={inviteState.icon}
                  size={17}
                />
                <Text
                  style={[
                    styles.inviteButtonLabel,
                    inviteState.state === 'selectable' ? styles.inviteButtonLabelDark : null,
                  ]}
                >
                  {inviteState.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
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
  inviteButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 38,
    paddingHorizontal: 10,
  },
  inviteButtonLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  inviteButtonLabelDark: {
    color: colors.background,
  },
  invitedButton: {
    backgroundColor: 'rgba(77,243,199,0.14)',
    borderColor: colors.success,
    borderWidth: 1,
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
  selectedButton: {
    backgroundColor: 'rgba(255,198,108,0.18)',
    borderColor: colors.gold,
    borderWidth: 1,
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
  unavailableButton: {
    backgroundColor: 'rgba(149,159,183,0.12)',
    borderColor: colors.border,
    borderWidth: 1,
    opacity: 0.72,
  },
  statusText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
  },
});
