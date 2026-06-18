import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatRoomPlayer } from '../../types/chatRooms';
import { getPlayerStatusLabel } from './chatRoomUtils';

import { colors } from '../../theme/colors';
type InvitePlayerSelectorProps = {
  invitedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  players: ChatRoomPlayer[];
  selectedPlayerIds: string[];
};

function getPlayerInviteState(player: ChatRoomPlayer, selectedPlayerIds: string[], invitedPlayerIds: string[]) {
  const isInvited = invitedPlayerIds.includes(player.id);
  const isSelected = selectedPlayerIds.includes(player.id);
  const isAvailable = player.status === 'available';

  if (isInvited) {
    return {
      disabled: true,
      icon: 'email-check' as const,
      label: 'Invited',
      state: 'invited' as const,
    };
  }

  if (!isAvailable) {
    return {
      disabled: true,
      icon: player.status === 'away' ? ('wifi-off' as const) : ('account-cancel' as const),
      label: player.status === 'away' ? 'Offline' : 'Unavailable',
      state: 'unavailable' as const,
    };
  }

  if (isSelected) {
    return {
      disabled: false,
      icon: 'check-circle' as const,
      label: 'Selected',
      state: 'selected' as const,
    };
  }

  return {
    disabled: false,
    icon: 'account-plus' as const,
    label: 'Selectable',
    state: 'selectable' as const,
  };
}

export function InvitePlayerSelector({
  invitedPlayerIds,
  onTogglePlayer,
  players,
  selectedPlayerIds,
}: InvitePlayerSelectorProps) {
  return (
    <View style={styles.wrap}>
      {players.map((player) => {
        const inviteState = getPlayerInviteState(player, selectedPlayerIds, invitedPlayerIds);

        return (
          <Pressable
            accessibilityLabel={`${inviteState.label} ${player.displayName}`}
            accessibilityRole="button"
            disabled={inviteState.disabled}
            key={player.id}
            onPress={() => onTogglePlayer(player.id)}
            style={({ pressed }) => [
              styles.playerChip,
              inviteState.state === 'selected' ? styles.playerChipSelected : null,
              inviteState.state === 'invited' ? styles.playerChipInvited : null,
              inviteState.state === 'unavailable' ? styles.playerChipUnavailable : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View
              style={[
                styles.avatar,
                inviteState.state === 'selected' ? styles.avatarSelected : null,
                inviteState.state === 'invited' ? styles.avatarInvited : null,
                inviteState.state === 'unavailable' ? styles.avatarUnavailable : null,
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  inviteState.state === 'selected' || inviteState.state === 'invited'
                    ? styles.avatarTextEmphasis
                    : null,
                  inviteState.state === 'unavailable' ? styles.avatarTextUnavailable : null,
                ]}
              >
                {player.avatarInitials}
              </Text>
            </View>
            <View style={styles.playerCopy}>
              <Text style={[styles.playerName, inviteState.state === 'unavailable' ? styles.playerNameMuted : null]}>
                {player.displayName}
              </Text>
              <Text style={styles.playerHandle}>{player.handle} • {getPlayerStatusLabel(player.status)}</Text>
            </View>
            <View style={[styles.statePill, styles[`${inviteState.state}Pill`]]}>
              <MaterialCommunityIcons color={styles[`${inviteState.state}PillText`].color} name={inviteState.icon} size={13} />
              <Text style={[styles.statePillText, styles[`${inviteState.state}PillText`]]}>{inviteState.label}</Text>
            </View>
          </Pressable>
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
    borderRadius: 15,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  avatarInvited: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  avatarSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
  },
  avatarTextEmphasis: {
    color: colors.background,
  },
  avatarTextUnavailable: {
    color: colors.mutedText,
  },
  avatarUnavailable: {
    backgroundColor: 'rgba(149,159,183,0.12)',
    borderColor: colors.border,
  },
  invitedPill: {
    backgroundColor: colors.successTint,
    borderColor: colors.success,
  },
  invitedPillText: {
    color: colors.success,
  },
  playerChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  playerChipInvited: {
    borderColor: colors.success,
  },
  playerChipSelected: {
    borderColor: colors.gold,
  },
  playerChipUnavailable: {
    opacity: 0.68,
  },
  playerCopy: {
    gap: 2,
  },
  playerHandle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  playerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  playerNameMuted: {
    color: colors.mutedText,
  },
  pressed: {
    opacity: 0.78,
  },
  selectablePill: {
    backgroundColor: 'rgba(108,238,255,0.12)',
    borderColor: colors.secondary,
  },
  selectablePillText: {
    color: colors.secondary,
  },
  selectedPill: {
    backgroundColor: 'rgba(255,198,108,0.16)',
    borderColor: colors.gold,
  },
  selectedPillText: {
    color: colors.gold,
  },
  statePill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  unavailablePill: {
    backgroundColor: 'rgba(149,159,183,0.12)',
    borderColor: colors.border,
  },
  unavailablePillText: {
    color: colors.mutedText,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
