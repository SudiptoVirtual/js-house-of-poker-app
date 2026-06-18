import { StyleSheet, Text, View } from 'react-native';

import type { RelationshipStatus } from '../../types/friends';

import { colors } from '../../theme/colors';
type RelationshipStatusBadgeProps = {
  status: RelationshipStatus;
};

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  friend: 'Friend',
  not_friends: 'Not Friends',
  request_received: 'Request Received',
  request_sent: 'Request Sent',
};

const RELATIONSHIP_COLORS: Record<RelationshipStatus, { backgroundColor: string; borderColor: string; color: string }> = {
  friend: { backgroundColor: 'rgba(103,243,187,0.12)', borderColor: colors.success, color: '#C8FFE9' },
  not_friends: { backgroundColor: 'rgba(115,122,136,0.14)', borderColor: colors.border, color: colors.mutedText },
  request_received: { backgroundColor: 'rgba(255,198,108,0.14)', borderColor: colors.gold, color: '#FFE2A6' },
  request_sent: { backgroundColor: 'rgba(94,237,255,0.12)', borderColor: colors.secondary, color: '#C6FAFF' },
};

export function RelationshipStatusBadge({ status }: RelationshipStatusBadgeProps) {
  const statusColors = RELATIONSHIP_COLORS[status];

  return (
    <View style={[styles.badge, statusColors]}>
      <Text style={[styles.label, { color: statusColors.color }]}>{RELATIONSHIP_LABELS[status]}</Text>
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
