import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type DealerButtonProps = {
  compact?: boolean;
  showPulse?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export const DealerButton = memo(function DealerButton({
  compact = false,
  showPulse = true,
  size: fixedSize,
  style,
}: DealerButtonProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showPulse) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 850,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse, showPulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.18],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.08],
  });
  const size = fixedSize ?? (compact ? 26 : 30);
  const fontSize = fixedSize ? Math.max(8, size * 0.42) : compact ? 11 : 13;

  return (
    <View style={[{ height: size, width: size }, style]}>
      {showPulse ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              height: size + 10,
              opacity: ringOpacity,
              width: size + 10,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      ) : null}
      <View style={[styles.badge, { height: size, width: size }]}>
        <Text style={[styles.label, compact ? styles.labelCompact : null, { fontSize }]}>D</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: '#F0C25D',
    borderColor: '#FFE7AE',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    shadowColor: '#F0C25D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 8,
  },
  label: {
    color: '#3E2E04',
    fontSize: 13,
    fontWeight: '900',
  },
  labelCompact: {
    fontSize: 11,
  },
  ring: {
    backgroundColor: 'rgba(240,194,93,0.28)',
    borderRadius: 999,
    left: -5,
    position: 'absolute',
    top: -5,
  },
});
