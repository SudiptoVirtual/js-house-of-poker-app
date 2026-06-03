import { Text, View, StyleSheet } from 'react-native';

import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';
import { InvitePlayerSelector } from './InvitePlayerSelector';

type RoomPlayerInviteSelectorProps = {
  invitedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  players: ChatRoomPlayer[];
  selectedPlayerIds: string[];
};

export function RoomPlayerInviteSelector({
  invitedPlayerIds,
  onTogglePlayer,
  players,
  selectedPlayerIds,
}: RoomPlayerInviteSelectorProps) {
  return (
    <View style={styles.container}>
      <InvitePlayerSelector
        invitedPlayerIds={invitedPlayerIds}
        players={players}
        selectedPlayerIds={selectedPlayerIds}
        onTogglePlayer={onTogglePlayer}
      />
      <Text style={styles.helperText}>
        Placeholder invite states appear immediately for selected room players until backend notifications are wired.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
});
