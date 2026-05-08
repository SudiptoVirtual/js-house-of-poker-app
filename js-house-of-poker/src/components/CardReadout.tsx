import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedCard, type CardSize } from './AnimatedCard';

type CardReadoutProps = {
  cards: Array<string | undefined>;
  placeholder?: string;
  size?: CardSize;
};

export const CardReadout = memo(function CardReadout({
  cards,
  placeholder = 'Waiting for deal',
  size = 'md',
}: CardReadoutProps) {
  const visibleCards = cards.filter((card): card is string => Boolean(card && card.length >= 2));

  if (visibleCards.length === 0) {
    return (
      <Text style={[styles.placeholder, size === 'sm' ? styles.placeholderSm : null]}>
        {placeholder}
      </Text>
    );
  }

  return (
    <View style={[styles.row, size === 'sm' ? styles.rowSm : null]}>
      {visibleCards.map((card, index) => (
        <AnimatedCard
          key={`${card}-${index}`}
          animateOnMount="none"
          card={card}
          hidden={false}
          size={size}
          style={styles.card}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  placeholder: {
    color: 'rgba(217,237,255,0.82)',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  placeholderSm: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  rowSm: {
    justifyContent: 'flex-start',
  },
});
