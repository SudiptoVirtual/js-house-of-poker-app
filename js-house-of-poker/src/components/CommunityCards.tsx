import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PokerPhase } from '../types/poker';
import { AnimatedCard } from './AnimatedCard';

type CommunityCardsProps = {
  cards: string[];
  phase: PokerPhase;
  visibleCount: number;
};

function isStreetActive(phase: PokerPhase, street: 'flop' | 'river' | 'turn') {
  if (street === 'flop') {
    return phase === 'flop' || phase === 'turn' || phase === 'river' || phase === 'showdown' || phase === 'completed';
  }

  if (street === 'turn') {
    return phase === 'turn' || phase === 'river' || phase === 'showdown' || phase === 'completed';
  }

  return phase === 'river' || phase === 'showdown' || phase === 'completed';
}

export const CommunityCards = memo(function CommunityCards({
  cards,
  phase,
  visibleCount,
}: CommunityCardsProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.streetRow}>
        {(['flop', 'turn', 'river'] as const).map((street) => (
          <View
            key={street}
            style={[
              styles.streetPill,
              isStreetActive(phase, street) ? styles.streetPillActive : null,
            ]}
          >
            <Text
              style={[
                styles.streetText,
                isStreetActive(phase, street) ? styles.streetTextActive : null,
              ]}
            >
              {street}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.cardsRow}>
        {Array.from({ length: 5 }).map((_, index) => {
          const card = cards[index];
          const showCard = Boolean(card) && index < visibleCount;

          return (
            <View key={`community-slot-${index}`} style={styles.slot}>
              {showCard ? (
                <AnimatedCard
                  animateOnMount="flip"
                  card={card}
                  large
                />
              ) : (
                <View style={styles.placeholder} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  placeholder: {
    backgroundColor: 'rgba(8,29,23,0.64)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    height: 88,
    width: 64,
  },
  shell: {
    alignItems: 'center',
    gap: 10,
  },
  slot: {
    alignItems: 'center',
    height: 88,
    justifyContent: 'center',
    width: 64,
  },
  streetPill: {
    backgroundColor: 'rgba(8,22,20,0.76)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streetPillActive: {
    backgroundColor: 'rgba(68,191,150,0.2)',
    borderColor: 'rgba(89,244,185,0.32)',
  },
  streetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  streetText: {
    color: 'rgba(232,250,244,0.54)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  streetTextActive: {
    color: '#D8FFF1',
  },
});
