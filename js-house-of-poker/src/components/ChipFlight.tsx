import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  type ViewStyle,
} from 'react-native';

import type { Point } from '../utils/pokerTable';
import { AnimatedChipStack } from './AnimatedChipStack';

type ChipFlightProps = {
  amount: number;
  delay?: number;
  destination: Point;
  origin: Point;
  tone?: 'bet' | 'pot' | 'stack';
};

export function ChipFlight({
  amount,
  delay = 0,
  destination,
  origin,
  tone = 'bet',
}: ChipFlightProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      delay,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, destination.x - origin.x],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, -16, destination.y - origin.y],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.9, 1.08, 1],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 1],
  });
  const style = useMemo<ViewStyle>(
    () => ({
      left: origin.x - 42,
      position: 'absolute',
      top: origin.y - 16,
      zIndex: 24,
    }),
    [origin.x, origin.y],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <AnimatedChipStack amount={amount} highlighted size="sm" tone={tone} />
    </Animated.View>
  );
}
