import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { PlayerActivityStatus } from '../../types/friends';

type PlayerStatusBadgeProps = {
  status: PlayerActivityStatus;
};

const STATUS_LABELS: Record<PlayerActivityStatus, string> = {
  at_table: 'At Table',
  in_chat_room: 'In Chat Room',
  in_lobby: 'In Lobby',
  offline: 'Offline',
  online: 'Online',
  playing_357: 'Playing 357',
};

const STATUS_COLORS: Record<PlayerActivityStatus, { backgroundColor: string; borderColor: string; color: string }> = {
  at_table: { backgroundColor: 'rgba(255,198,108,0.14)', borderColor: '#FFC66C', color: '#FFE2A6' },
  in_chat_room: { backgroundColor: 'rgba(159,137,255,0.16)', borderColor: '#9F89FF', color: '#D9D0FF' },
  in_lobby: { backgroundColor: 'rgba(94,237,255,0.14)', borderColor: '#5EEDFF', color: '#C6FAFF' },
  offline: { backgroundColor: 'rgba(115,122,136,0.16)', borderColor: '#737A88', color: colors.mutedText },
  online: { backgroundColor: 'rgba(103,243,187,0.14)', borderColor: '#67F3BB', color: '#C8FFE9' },
  playing_357: { backgroundColor: 'rgba(255,126,165,0.16)', borderColor: '#FF7EA5', color: '#FFD0E0' },
};

export function PlayerStatusBadge({ status }: PlayerStatusBadgeProps) {
  const statusColors = STATUS_COLORS[status];

  return (
    <View style={[styles.badge, statusColors]}>
      <Text style={[styles.label, { color: statusColors.color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
