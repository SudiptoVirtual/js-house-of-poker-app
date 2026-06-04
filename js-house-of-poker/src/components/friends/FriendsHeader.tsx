import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type FriendsHeaderProps = {
  activeTableCode: string | null;
  feedbackMessage?: string | null;
  isSearchActive: boolean;
  onlineFriendCount: number;
};

export function FriendsHeader({
  activeTableCode,
  feedbackMessage,
  isSearchActive,
  onlineFriendCount,
}: FriendsHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{onlineFriendCount}</Text>
          <Text style={styles.statLabel}>Online friends</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeTableCode ?? '—'}</Text>
          <Text style={styles.statLabel}>Active table</Text>
        </View>
      </View>
      <Text style={styles.helperText}>
        {isSearchActive
          ? 'Search results include friends, offline friends, pending requests, and new players.'
          : 'Only online friends are shown until you search by player name or username.'}
      </Text>
      {feedbackMessage ? <Text style={styles.feedbackText}>{feedbackMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  feedbackText: {
    backgroundColor: 'rgba(94,237,255,0.11)',
    borderColor: 'rgba(94,237,255,0.28)',
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    padding: 12,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  statCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    padding: 12,
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
