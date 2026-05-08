import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AnimatedChipStackProps = {
  amount: number;
  highlighted?: boolean;
  showZero?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  tone?: 'bet' | 'pot' | 'stack';
};

const SIZE_MAP = {
  lg: { chip: 18, gap: 5, labelSize: 16, minWidth: 74, padX: 12, padY: 9 },
  md: { chip: 14, gap: 4, labelSize: 14, minWidth: 62, padX: 10, padY: 7 },
  sm: { chip: 11, gap: 3, labelSize: 12, minWidth: 54, padX: 9, padY: 6 },
} as const;

const TONE_MAP = {
  bet: {
    chipFill: '#E0583F',
    chipInner: '#FFD7C4',
    glow: 'rgba(255,115,81,0.32)',
    labelFill: 'rgba(48,18,10,0.9)',
    labelText: '#FFF3EF',
  },
  pot: {
    chipFill: '#E0B652',
    chipInner: '#FFF3C8',
    glow: 'rgba(245,201,89,0.34)',
    labelFill: 'rgba(54,39,4,0.94)',
    labelText: '#FFF8D8',
  },
  stack: {
    chipFill: '#2FBF92',
    chipInner: '#D7FFF2',
    glow: 'rgba(72,233,182,0.26)',
    labelFill: 'rgba(8,36,28,0.9)',
    labelText: '#E5FFF6',
  },
} as const;

function formatAmount(amount: number) {
  return amount.toLocaleString('en-US');
}

export const AnimatedChipStack = memo(function AnimatedChipStack({
  amount,
  highlighted = false,
  showZero = false,
  size = 'md',
  style,
  tone = 'stack',
}: AnimatedChipStackProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(highlighted ? 1 : 0.35)).current;
  const previousAmount = useRef(amount);
  const sizeConfig = SIZE_MAP[size];
  const toneConfig = TONE_MAP[tone];

  useEffect(() => {
    if (previousAmount.current === amount) {
      return;
    }

    previousAmount.current = amount;
    Animated.sequence([
      Animated.spring(scale, {
        damping: 10,
        mass: 0.65,
        stiffness: 180,
        toValue: 1.14,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        damping: 12,
        mass: 0.8,
        stiffness: 160,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [amount, scale]);

  useEffect(() => {
    Animated.timing(glow, {
      duration: 220,
      toValue: highlighted ? 1 : 0.35,
      useNativeDriver: true,
    }).start();
  }, [glow, highlighted]);

  if (!showZero && amount <= 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        style,
        {
          transform: [{ scale }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: toneConfig.glow,
            opacity: glow,
          },
        ]}
      />

      <View style={styles.chips}>
        {[0, 1, 2].map((layer) => (
          <View
            key={layer}
            style={[
              styles.chip,
              {
                backgroundColor: toneConfig.chipFill,
                borderColor: toneConfig.chipInner,
                height: sizeConfig.chip,
                left: layer * sizeConfig.gap,
                width: sizeConfig.chip,
              },
            ]}
          >
            <View
              style={[
                styles.chipInner,
                {
                  borderColor: toneConfig.chipInner,
                  height: sizeConfig.chip * 0.42,
                  width: sizeConfig.chip * 0.42,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View
        style={[
          styles.label,
          {
            backgroundColor: toneConfig.labelFill,
            minWidth: sizeConfig.minWidth,
            paddingHorizontal: sizeConfig.padX,
            paddingVertical: sizeConfig.padY,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.labelText,
            {
              color: toneConfig.labelText,
              fontSize: sizeConfig.labelSize,
            },
          ]}
        >
          {formatAmount(amount)}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    top: 0,
  },
  chipInner: {
    borderRadius: 999,
    borderWidth: 2,
  },
  chips: {
    height: 18,
    marginRight: 10,
    position: 'relative',
    width: 28,
  },
  glow: {
    borderRadius: 999,
    bottom: -4,
    left: -6,
    position: 'absolute',
    right: -6,
    top: -4,
  },
  label: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  labelText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  wrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'relative',
  },
});
