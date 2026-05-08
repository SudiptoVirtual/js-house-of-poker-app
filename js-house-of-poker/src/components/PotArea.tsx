import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { AnimatedChipStack } from './AnimatedChipStack';

type PotAreaProps = {
  currentBet: number;
  handNumber: number;
  phaseTitle: string;
  pot: number;
  statusMessage: string;
};

export const PotArea = memo(function PotArea({
  currentBet,
  handNumber,
  phaseTitle,
  pot,
  statusMessage,
}: PotAreaProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(pulse, {
          damping: 11,
          mass: 0.8,
          stiffness: 180,
          toValue: 1.04,
          useNativeDriver: true,
        }),
        Animated.spring(pulse, {
          damping: 13,
          mass: 0.9,
          stiffness: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glow, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          duration: 380,
          toValue: 0.3,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentBet, glow, handNumber, phaseTitle, pot, pulse, statusMessage]);

  return (
    <Animated.View style={[styles.shell, { transform: [{ scale: pulse }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { opacity: glow }]}
      />

      <View style={styles.topRow}>
        <Text style={styles.phaseLabel}>{phaseTitle}</Text>
        <Text style={styles.handLabel}>Hand #{handNumber}</Text>
      </View>

      <Text style={styles.potLabel}>Main Pot</Text>
      <AnimatedChipStack amount={pot} highlighted size="lg" tone="pot" />

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaValue}>{currentBet}</Text>
          <Text style={styles.metaLabel}>Current Bet</Text>
        </View>
      </View>

      <Text numberOfLines={2} style={styles.status}>
        {statusMessage}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(233,188,77,0.12)',
    borderRadius: 999,
  },
  handLabel: {
    color: '#E6F6EC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.72,
  },
  metaLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(8,25,20,0.86)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  metaValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  phaseLabel: {
    color: '#9CE2C9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  potLabel: {
    color: '#FFF1C6',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  shell: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(6,24,18,0.86)',
    borderColor: 'rgba(245,205,99,0.28)',
    borderRadius: 28,
    borderWidth: 1,
    gap: 4,
    minWidth: 220,
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
  status: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    opacity: 0.88,
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    width: '100%',
  },
});
