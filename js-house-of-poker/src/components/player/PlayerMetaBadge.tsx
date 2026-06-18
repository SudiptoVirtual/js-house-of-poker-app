import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { PlayerActivityStatus, RelationshipStatus } from '../../types/friends';

import { colors } from '../../theme/colors';

type BadgeTone = 'danger' | 'gold' | 'muted' | 'primary' | 'success' | 'violet';

type PlayerMetaBadgeProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
  tone?: BadgeTone;
};

const TONE_STYLES: Record<BadgeTone, { backgroundColor: string; borderColor: string; color: string }> = {
  danger: { backgroundColor: 'rgba(255,126,165,0.16)', borderColor: colors.danger, color: '#FFD0E0' },
  gold: { backgroundColor: 'rgba(255,198,108,0.14)', borderColor: colors.gold, color: '#FFE2A6' },
  muted: { backgroundColor: 'rgba(115,122,136,0.16)', borderColor: colors.border, color: colors.mutedText },
  primary: { backgroundColor: 'rgba(94,237,255,0.14)', borderColor: colors.secondary, color: '#C6FAFF' },
  success: { backgroundColor: 'rgba(103,243,187,0.14)', borderColor: colors.success, color: '#C8FFE9' },
  violet: { backgroundColor: 'rgba(159,137,255,0.16)', borderColor: '#9F89FF', color: '#D9D0FF' },
};

const ACTIVITY_BADGES: Record<PlayerActivityStatus, { label: string; tone: BadgeTone }> = {
  at_table: { label: 'At Table', tone: 'gold' },
  in_chat_room: { label: 'In Chat Room', tone: 'violet' },
  in_lobby: { label: 'In Lobby', tone: 'primary' },
  offline: { label: 'Offline', tone: 'muted' },
  online: { label: 'Online', tone: 'success' },
  playing_357: { label: 'Playing 357', tone: 'danger' },
};

const RELATIONSHIP_BADGES: Record<RelationshipStatus, { label: string; tone: BadgeTone }> = {
  friend: { label: 'Friend', tone: 'success' },
  not_friends: { label: 'Not Friends', tone: 'muted' },
  request_received: { label: 'Request Received', tone: 'gold' },
  request_sent: { label: 'Request Sent', tone: 'primary' },
};

export function getActivityBadge(status: PlayerActivityStatus) {
  return ACTIVITY_BADGES[status];
}

export function getRelationshipBadge(status: RelationshipStatus) {
  return RELATIONSHIP_BADGES[status];
}

export function PlayerMetaBadge({ label, style, tone = 'muted' }: PlayerMetaBadgeProps) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <View style={[styles.badge, toneStyle, style]}>
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
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
