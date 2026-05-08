import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerPhase } from '../types/poker';
import { AnimatedCard, type CardSize } from './AnimatedCard';

type TableCenterBoardProps = {
  cardSize?: CardSize;
  cards: string[];
  currentBet: number;
  handNumber: number;
  phase: PokerPhase;
  phaseTitle: string;
  pot: number;
  statusMessage: string;
  visibleCount: number;
  winnerSummary?: string | null;
};

function formatChipAmount(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }

  return value.toLocaleString('en-US');
}

function getBoardSummary(phase: PokerPhase, cards: string[], visibleCount: number) {
  if (phase === 'waiting') {
    return 'Waiting for the next hand.';
  }

  if (visibleCount === 0 || cards.length === 0) {
    return 'No board dealt yet.';
  }

  return `${visibleCount} of 5 board cards visible.`;
}

export const TableCenterBoard = memo(function TableCenterBoard({
  cardSize = 'md',
  cards,
  currentBet,
  handNumber,
  phase,
  phaseTitle,
  pot,
  statusMessage,
  visibleCount,
  winnerSummary,
}: TableCenterBoardProps) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(14, 10, 28, 0.98)', 'rgba(7, 6, 16, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.potShell}
      >
        <Text style={styles.potLabel}>POT</Text>
        <Text style={styles.potAmount}>{formatChipAmount(pot)}</Text>
      </LinearGradient>

      <View style={styles.boardRail}>
        {Array.from({ length: 5 }).map((_, index) => {
          const card = cards[index];
          const showCard = Boolean(card) && index < visibleCount;

          return (
            <AnimatedCard
              key={`holdem-board-${index}`}
              animateOnMount="none"
              card={card}
              hidden={!showCard}
              size={cardSize}
              variant="board"
            />
          );
        })}
      </View>

      <LinearGradient
        colors={['rgba(17, 11, 32, 0.96)', 'rgba(8, 7, 18, 0.99)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.infoShell}
      >
        <Text style={styles.title}>TABLE PLAY</Text>
        <Text style={styles.subtitle}>
          {phaseTitle} | Hand {handNumber}
        </Text>
        <Text style={styles.copy}>
          {winnerSummary ?? statusMessage}
        </Text>
        <Text style={styles.meta}>
          Current bet: {formatChipAmount(currentBet)} | {getBoardSummary(phase, cards, visibleCount)}
        </Text>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  boardRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  copy: {
    color: '#F7F4FF',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  infoShell: {
    borderColor: 'rgba(191, 86, 255, 0.2)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  meta: {
    color: 'rgba(206, 194, 246, 0.76)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  potAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  potLabel: {
    color: '#B35CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  potShell: {
    alignItems: 'center',
    borderColor: 'rgba(191, 86, 255, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 3,
    minWidth: 160,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  subtitle: {
    color: '#FFCB6B',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  title: {
    color: '#B35CFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  wrapper: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
});
