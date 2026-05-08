import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
} from 'react-native';

type PlayerActionBurstProps = {
  label: string;
  tone?: 'accent' | 'danger' | 'neutral' | 'primary';
};

function getToneStyles(tone: NonNullable<PlayerActionBurstProps['tone']>) {
  switch (tone) {
    case 'danger':
      return {
        backgroundColor: 'rgba(128,33,57,0.92)',
        borderColor: 'rgba(244,130,159,0.32)',
        color: '#FFE8EF',
      };
    case 'accent':
      return {
        backgroundColor: 'rgba(98,70,24,0.94)',
        borderColor: 'rgba(244,211,132,0.32)',
        color: '#FFF5D8',
      };
    case 'neutral':
      return {
        backgroundColor: 'rgba(20,29,36,0.92)',
        borderColor: 'rgba(255,255,255,0.12)',
        color: '#EEF8F5',
      };
    case 'primary':
    default:
      return {
        backgroundColor: 'rgba(13,74,67,0.94)',
        borderColor: 'rgba(83,234,201,0.3)',
        color: '#E8FFF9',
      };
  }
}

export const PlayerActionBurst = memo(function PlayerActionBurst({
  label,
  tone = 'primary',
}: PlayerActionBurstProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const colors = getToneStyles(tone);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 170,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        damping: 12,
        mass: 0.8,
        stiffness: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pill,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.label, { color: colors.color }]}>
        {label}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 116,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
