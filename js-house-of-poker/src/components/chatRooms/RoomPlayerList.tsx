import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';
import { getPlayerStatusColor, getPlayerStatusLabel } from './chatRoomUtils';

type RoomPlayerListProps = {
  invitedPlayerIds?: string[];
  onInvitePlayer?: (playerId: string) => void;
  players: ChatRoomPlayer[];
};

export function RoomPlayerList({ invitedPlayerIds = [], onInvitePlayer, players }: RoomPlayerListProps) {
  return (
    <View style={styles.playerStack}>
      {players.map((player) => {
        const isInvited = invitedPlayerIds.includes(player.id);

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
            {onInvitePlayer ? (
              <Pressable
                accessibilityLabel={`${isInvited ? 'Invited' : 'Invite'} ${player.displayName}`}
                accessibilityRole="button"
                disabled={isInvited}
                onPress={() => onInvitePlayer(player.id)}
                style={({ pressed }) => [
                  styles.inviteButton,
                  isInvited ? styles.invitedButton : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={isInvited ? colors.success : colors.background}
                  name={isInvited ? 'check' : 'account-plus'}
                  size={17}
                />
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
    height: 38,
    justifyContent: 'center',
    width: 38,
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
});
