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
        Selected room players are handed to AI Prime and backend invite notifications when the table launches.
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
