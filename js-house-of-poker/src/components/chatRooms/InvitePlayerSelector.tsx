import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';

type InvitePlayerSelectorProps = {
  onTogglePlayer: (playerId: string) => void;
  players: ChatRoomPlayer[];
  selectedPlayerIds: string[];
};

export function InvitePlayerSelector({ onTogglePlayer, players, selectedPlayerIds }: InvitePlayerSelectorProps) {
  return (
    <View style={styles.wrap}>
      {players.map((player) => {
        const isSelected = selectedPlayerIds.includes(player.id);

        return (
          <Pressable
            accessibilityRole="button"
            key={player.id}
            onPress={() => onTogglePlayer(player.id)}
            style={({ pressed }) => [
              styles.playerChip,
              isSelected ? styles.playerChipSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={[styles.avatar, isSelected ? styles.avatarSelected : null]}>
              <Text style={[styles.avatarText, isSelected ? styles.avatarTextSelected : null]}>
                {player.avatarInitials}
              </Text>
            </View>
            <View style={styles.playerCopy}>
              <Text style={styles.playerName}>{player.displayName}</Text>
              <Text style={styles.playerHandle}>{isSelected ? 'Invited' : player.handle}</Text>
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
  avatarSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  avatarText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
  },
  avatarTextSelected: {
    color: colors.background,
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
  playerChipSelected: {
    borderColor: colors.success,
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
  pressed: {
    opacity: 0.78,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
