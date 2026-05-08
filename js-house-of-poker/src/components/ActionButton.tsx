import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../theme/colors';

type ActionButtonProps = {
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'accent' | 'danger' | 'neutral' | 'primary' | 'success';
  variant?: 'primary' | 'secondary';
};

function getVisuals(
  variant: 'primary' | 'secondary',
  tone: NonNullable<ActionButtonProps['tone']>,
) {
  if (variant === 'secondary' && tone === 'neutral') {
    return {
      borderColor: 'rgba(138,113,255,0.42)',
      glow: 'rgba(108,238,255,0.16)',
      gradient: ['rgba(35,25,70,0.94)', 'rgba(20,15,46,0.98)'] as const,
      textColor: colors.text,
    };
  }

  switch (tone) {
    case 'danger':
      return {
        borderColor: '#FF7EA5',
        glow: 'rgba(255,126,165,0.28)',
        gradient: ['#A83367', '#6B234A'] as const,
        textColor: '#FFF3F8',
      };
    case 'success':
      return {
        borderColor: '#63FFCF',
        glow: 'rgba(99,255,207,0.26)',
        gradient: ['#168A6B', '#0C5948'] as const,
        textColor: '#E8FFF7',
      };
    case 'accent':
      return {
        borderColor: '#FFC66C',
        glow: 'rgba(255,198,108,0.28)',
        gradient: ['#9A5C12', '#61370A'] as const,
        textColor: '#FFF7E6',
      };
    case 'neutral':
      return {
        borderColor: variant === 'primary' ? '#9F89FF' : colors.border,
        glow: 'rgba(140,112,255,0.24)',
        gradient:
          variant === 'primary'
            ? (['#613FC9', '#422A90'] as const)
            : (['#2A225B', '#1E1841'] as const),
        textColor: colors.text,
      };
    case 'primary':
    default:
      return {
        borderColor: '#5EEDFF',
        glow: 'rgba(94,237,255,0.28)',
        gradient: ['#178CA2', '#0E5A80'] as const,
        textColor: '#ECFFFF',
      };
  }
}

export function ActionButton({
  compact = false,
  containerStyle,
  disabled = false,
  fullWidth = false,
  icon,
  label,
  loading = false,
  onPress,
  style,
  tone,
  variant = 'primary',
}: ActionButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0.14)).current;
  const resolvedTone = tone ?? (variant === 'secondary' ? 'neutral' : 'primary');
  const visuals = useMemo(() => getVisuals(variant, resolvedTone), [resolvedTone, variant]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, {
          duration: 1400,
          toValue: 0.34,
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          duration: 1400,
          toValue: 0.14,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [shine]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            damping: 12,
            mass: 0.8,
            stiffness: 260,
            toValue: 0.965,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            damping: 12,
            mass: 0.9,
            stiffness: 220,
            toValue: 1,
            useNativeDriver: true,
          }).start()
        }
        style={({ pressed }) => [
          styles.button,
          compact ? styles.compactButton : null,
          fullWidth ? styles.fullWidth : null,
          style,
          {
            borderColor: visuals.borderColor,
            opacity: disabled ? 0.5 : pressed ? 0.93 : 1,
          },
        ]}
      >
        <LinearGradient colors={visuals.gradient} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { backgroundColor: visuals.glow, opacity: shine }]}
        />

        <View style={styles.content}>
          {icon ? (
            <MaterialCommunityIcons color={visuals.textColor} name={icon} size={compact ? 16 : 18} />
          ) : null}
          <Text style={[styles.label, compact ? styles.labelCompact : null, { color: visuals.textColor }]}>
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 148,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'relative',
  },
  compactButton: {
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  fullWidth: {
    minWidth: 0,
    width: '100%',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  label: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 13,
  },
});
