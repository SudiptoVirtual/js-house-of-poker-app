import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerPhase, PokerPlayerState } from '../types/poker';
import { AnimatedCard, type CardSize } from './AnimatedCard';
import { CardReadout } from './CardReadout';
import { HandRankDisplay } from './HandRankDisplay';

type PlayerHandProps = {
  barMode?: boolean;
  cardSize?: CardSize;
  compact?: boolean;
  phase: PokerPhase;
  player: PokerPlayerState | null;
};

export const PlayerHand = memo(function PlayerHand({
  barMode = false,
  cardSize = 'lg',
  compact = false,
  phase,
  player,
}: PlayerHandProps) {
  if (!player) {
    return null;
  }

  const isHandActive = phase !== 'waiting';
  const cards = [player.holeCards[0], player.holeCards[1]];
  const canReveal = isHandActive && cards.some(Boolean);

  return (
    <LinearGradient
      colors={compact ? ['rgba(16,24,38,0.98)', 'rgba(8,14,24,0.99)'] : ['rgba(14,26,46,0.97)', 'rgba(8,14,28,0.99)']}
      style={[
        styles.container,
        compact ? styles.containerCompact : null,
        barMode ? styles.containerBar : null,
      ]}
    >
      <View
        style={[
          styles.headerRow,
          compact ? styles.headerRowCompact : null,
          barMode ? styles.headerRowBar : null,
        ]}
      >
        <Text
          style={[
            styles.kicker,
            compact ? styles.kickerCompact : null,
            barMode ? styles.kickerBar : null,
          ]}
        >
          Your Hand
        </Text>
        <Text
          style={[
            styles.stack,
            compact ? styles.stackCompact : null,
            barMode ? styles.stackBar : null,
          ]}
        >
          {player.chips.toLocaleString('en-US')} chips
        </Text>
      </View>

      <View
        style={[
          styles.contentRow,
          compact ? styles.contentRowCompact : null,
          barMode ? styles.contentRowBar : null,
        ]}
      >
        <View
          style={[
            styles.cardsFan,
            compact ? styles.cardsFanCompact : null,
            barMode ? styles.cardsFanBar : null,
          ]}
        >
          {cards.map((card, index) => (
            <View
              key={`self-hand-${index}-${card ?? 'hidden'}`}
              style={[
                styles.cardFanSlot,
                compact
                  ? index === 0
                    ? styles.cardFanCompactLead
                    : styles.cardFanCompactTrail
                  : index === 0
                    ? styles.cardFanLead
                    : styles.cardFanTrail,
              ]}
            >
              <AnimatedCard
                animateOnMount={canReveal ? 'flip' : 'pop'}
                card={card}
                hidden={!canReveal || !card}
                size={cardSize}
                variant="board"
              />
            </View>
          ))}
        </View>

        <View
          style={[
            styles.infoColumn,
            compact ? styles.infoColumnCompact : null,
            barMode ? styles.infoColumnBar : null,
          ]}
        >
          {compact ? null : (
            <View style={styles.readoutBlock}>
              <Text style={styles.readoutLabel}>Pocket cards</Text>
              <CardReadout cards={canReveal ? cards : []} />
            </View>
          )}
          <HandRankDisplay description={player.handDescription} large={!compact} />
          {barMode ? null : (
            <Text
              numberOfLines={compact ? 2 : 3}
              style={[styles.helpText, compact ? styles.helpTextCompact : null]}
            >
              {canReveal
                ? 'Your hole cards stay visible while actions sit in the bottom bar.'
                : 'Your hole cards will appear when the dealer starts the hand.'}
            </Text>
          )}
        </View>
      </View>
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  cardFanCompactLead: { zIndex: 2 },
  cardFanCompactTrail: { marginLeft: 6, zIndex: 1 },
  cardFanLead: { transform: [{ rotate: '-10deg' }], zIndex: 2 },
  cardFanSlot: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 12 },
  cardFanTrail: { marginLeft: -18, transform: [{ rotate: '10deg' }], zIndex: 1 },
  cardsFan: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', minHeight: 96 },
  cardsFanBar: { flexShrink: 0, minHeight: 0 },
  cardsFanCompact: { minHeight: 72 },
  container: { borderColor: 'rgba(109,219,255,0.42)', borderRadius: 20, borderWidth: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  containerBar: { gap: 6, minHeight: 0, paddingHorizontal: 10, paddingVertical: 8 },
  containerCompact: { gap: 8, minHeight: 148, paddingHorizontal: 12, paddingVertical: 10 },
  contentRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  contentRowBar: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  contentRowCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 10 },
  headerRowCompact: { minHeight: 0 },
  headerRowBar: { alignItems: 'center' },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  helpText: { color: 'rgba(217,237,255,0.82)', fontSize: 11, fontWeight: '600', lineHeight: 16 },
  helpTextCompact: { fontSize: 10, lineHeight: 14 },
  infoColumn: { flex: 1, gap: 8, minWidth: 0 },
  infoColumnBar: { gap: 4, justifyContent: 'center' },
  infoColumnCompact: { justifyContent: 'space-between' },
  kicker: { color: '#D7F6FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  kickerBar: { fontSize: 10, letterSpacing: 1 },
  kickerCompact: { fontSize: 10, letterSpacing: 0.8 },
  readoutBlock: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(120,223,255,0.18)', borderRadius: 14, borderWidth: 1, gap: 4, paddingHorizontal: 10, paddingVertical: 8, width: '100%' },
  readoutLabel: { color: 'rgba(191,230,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  stack: { color: '#8CF0CE', fontSize: 12, fontWeight: '800' },
  stackBar: { fontSize: 11 },
  stackCompact: { fontSize: 11 },
});
