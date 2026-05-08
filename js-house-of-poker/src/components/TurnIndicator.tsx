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

type TurnIndicatorProps = {
  active: boolean;
  style?: StyleProp<ViewStyle>;
};

export const TurnIndicator = memo(function TurnIndicator({
  active,
  style,
}: TurnIndicatorProps) {
  const pulse = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(pulse, {
        duration: 180,
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.out(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.25,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active) {
    return null;
  }

  return (
    <View style={style}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbit,
          {
            opacity: pulse,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0.25, 1],
                  outputRange: [0.96, 1.06],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.label}>ACTING</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  dot: {
    backgroundColor: '#3BF5D0',
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  label: {
    color: '#E9FFFB',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  orbit: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,245,208,0.12)',
    borderColor: 'rgba(59,245,208,0.34)',
    borderRadius: 999,
    borderWidth: 1,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8,32,32,0.9)',
    borderColor: 'rgba(59,245,208,0.4)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
