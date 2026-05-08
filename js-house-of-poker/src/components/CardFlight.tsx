import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  type ViewStyle,
} from 'react-native';

import type { Point } from '../utils/pokerTable';
import { AnimatedCard, type CardSize } from './AnimatedCard';

type CardFlightProps = {
  card?: string;
  delay?: number;
  destination: Point;
  hidden?: boolean;
  large?: boolean;
  origin: Point;
  size?: CardSize;
};

export function CardFlight({
  card,
  delay = 0,
  destination,
  hidden = true,
  large = false,
  origin,
  size,
}: CardFlightProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const resolvedSize = size ?? (large ? 'lg' : 'md');
  const frame =
    resolvedSize === 'lg'
      ? { height: 88, width: 64 }
      : resolvedSize === 'sm'
        ? { height: 58, width: 42 }
        : { height: 72, width: 52 };

  useEffect(() => {
    Animated.timing(progress, {
      delay,
      duration: 340,
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
    inputRange: [0, 0.55, 1],
    outputRange: [0, -24, destination.y - origin.y],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '0deg'],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.88, 1.05, 1],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: [0, 1, 1],
  });
  const style = useMemo<ViewStyle>(
    () => ({
      left: origin.x - frame.width / 2,
      position: 'absolute',
      top: origin.y - frame.height / 2,
      zIndex: 30,
    }),
    [frame.height, frame.width, origin.x, origin.y],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
        },
      ]}
    >
      <AnimatedCard
        animateOnMount="none"
        card={card}
        hidden={hidden}
        size={resolvedSize}
      />
    </Animated.View>
  );
}
