import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type HandRankDisplayProps = {
  description?: string | null;
  large?: boolean;
};

function normalizeRank(description?: string | null) {
  const text = (description ?? '').toLowerCase();

  if (!text) return '--';
  if (text.includes('royal flush')) return 'Royal Flush';
  if (text.includes('straight flush')) return 'Straight Flush';
  if (text.includes('four of a kind')) return 'Four of a Kind';
  if (text.includes('full house')) return 'Full House';
  if (text.includes('flush')) return 'Flush';
  if (text.includes('straight')) return 'Straight';
  if (text.includes('three of a kind')) return 'Three of a Kind';
  if (text.includes('two pair')) return 'Two Pair';
  if (text.includes('pair')) return 'Pair';

  return 'High Card';
}

export const HandRankDisplay = memo(function HandRankDisplay({ description, large = false }: HandRankDisplayProps) {
  const rank = normalizeRank(description);

  return (
    <View style={[styles.wrap, large ? styles.wrapLarge : null]}>
      <Text style={styles.kicker}>Best Hand</Text>
      <Text numberOfLines={1} style={[styles.rank, large ? styles.rankLarge : null]}>{rank}</Text>
      {description ? <Text numberOfLines={2} style={styles.description}>{description}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  description: {
    color: 'rgba(220,236,255,0.82)',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 3,
  },
  kicker: {
    color: '#F4D99E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rank: {
    color: '#F6FAFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  rankLarge: {
    fontSize: 18,
  },
  wrap: {
    backgroundColor: 'rgba(13,19,39,0.74)',
    borderColor: 'rgba(243,208,138,0.32)',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  wrapLarge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
