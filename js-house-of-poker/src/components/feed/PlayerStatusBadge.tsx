import { StyleSheet, Text, View } from 'react-native';

import { PlayerStatusBadge as TierStatusBadge } from '../player/PlayerStatusBadge';
import type { FeedPlayerStatus } from './types';
import type { PlayerStatusTier } from '../../constants/playerStatus';

import { colors } from '../../theme/colors';
type PlayerStatusBadgeProps = {
  status: FeedPlayerStatus;
  statusTier?: PlayerStatusTier;
};

const statusColors: Record<FeedPlayerStatus, string> = {
  Away: colors.mutedText,
  'At Table': colors.gold,
  'In Chat Room': colors.accent,
  'In Lobby': colors.primary,
  Online: colors.success,
  'Playing 357': colors.secondary,
};

export function PlayerStatusBadge({ status, statusTier }: PlayerStatusBadgeProps) {
  const accentColor = statusColors[status];

  return (
    <View style={styles.container}>
      <View style={[styles.presenceBadge, { borderColor: accentColor }]}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <Text numberOfLines={1} style={styles.presenceLabel}>
          {status}
        </Text>
      </View>
      {statusTier ? <TierStatusBadge compact statusTier={statusTier} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dot: {
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  presenceBadge: {
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
  presenceLabel: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
});
