import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerPlayerState } from '../types/poker';
import { AnimatedCard } from './AnimatedCard';
import { HandRankDisplay } from './HandRankDisplay';

type ShowdownResultProps = {
  communityCards: string[];
  summary?: string | null;
  winners: PokerPlayerState[];
};

export const ShowdownResult = memo(function ShowdownResult({
  communityCards,
  summary,
  winners,
}: ShowdownResultProps) {
  if (winners.length === 0) {
    return null;
  }

  return (
    <LinearGradient
      colors={['rgba(64,43,18,0.98)', 'rgba(20,14,10,0.98)']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={styles.shell}
    >
      <Text style={styles.kicker}>Showdown result</Text>
      <Text style={styles.title}>{winners.map((player) => player.name).join(', ')} won</Text>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {winners.map((winner) => (
        <View key={`winner-${winner.id}`} style={styles.winnerRow}>
          <View style={styles.winnerCards}>
            {[winner.holeCards[0], winner.holeCards[1]].map((card, index) => (
              <AnimatedCard key={`${winner.id}-card-${index}-${card ?? 'hidden'}`} card={card} hidden={!card} size="md" />
            ))}
          </View>
          <View style={styles.rankWrap}>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <HandRankDisplay description={winner.handDescription} />
          </View>
        </View>
      ))}

      <View style={styles.boardWrap}>
        <Text style={styles.boardLabel}>Board cards in play</Text>
        <View style={styles.boardCards}>
          {Array.from({ length: 5 }).map((_, index) => {
            const card = communityCards[index];
            return <AnimatedCard key={`showdown-board-${index}-${card ?? 'hidden'}`} card={card} hidden={!card} size="sm" />;
          })}
        </View>
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  boardCards: {
    flexDirection: 'row',
    gap: 6,
  },
  boardLabel: {
    color: 'rgba(240,230,203,0.92)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  boardWrap: {
    gap: 8,
    marginTop: 10,
  },
  kicker: {
    color: '#F4D58E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  rankWrap: {
    flex: 1,
    minWidth: 0,
  },
  shell: {
    borderColor: 'rgba(243,206,129,0.38)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summary: {
    color: '#F8F2E5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 4,
  },
  title: {
    color: '#FFF8E8',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  winnerCards: {
    flexDirection: 'row',
    gap: 6,
  },
  winnerName: {
    color: '#FDF9F1',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  winnerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
});
