import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import type { FeedPlayerStatus } from './types';

type PlayerStatusBadgeProps = {
  status: FeedPlayerStatus;
};

const statusColors: Record<FeedPlayerStatus, string> = {
  Away: colors.mutedText,
  'At Table': colors.gold,
  'In Chat Room': colors.accent,
  'In Lobby': colors.primary,
  Online: colors.success,
  'Playing 357': colors.secondary,
};

export function PlayerStatusBadge({ status }: PlayerStatusBadgeProps) {
  const accentColor = statusColors[status];

  return (
    <View style={[styles.badge, { borderColor: accentColor }]}>
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <Text numberOfLines={1} style={styles.label}>
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    maxWidth: 128,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  label: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
});
