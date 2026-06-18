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

import { borders, colors, componentSpacing, gradients, radii, spacing } from '../theme';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'compact' | 'full-width';

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
  variant?: ActionButtonVariant;
};

type ButtonVisuals = {
  borderColor: string;
  glow: string;
  gradient: readonly [string, string];
  textColor: string;
};

function getVisuals(
  variant: Exclude<ActionButtonVariant, 'compact' | 'full-width'>,
  tone: NonNullable<ActionButtonProps['tone']>,
): ButtonVisuals {
  if (variant === 'ghost') {
    return {
      borderColor: colors.border,
      glow: 'rgba(138,113,255,0.12)',
      gradient: ['rgba(255,255,255,0.00)', 'rgba(255,255,255,0.04)'],
      textColor: colors.text,
    };
  }

  if (variant === 'gold') {
    return {
      borderColor: colors.gold,
      glow: colors.glowGold,
      gradient: gradients.actionGold,
      textColor: colors.palette.textOnGold,
    };
  }

  if (variant === 'danger') {
    return {
      borderColor: colors.danger,
      glow: colors.glowDanger,
      gradient: gradients.actionDestructive,
      textColor: '#FFF3F8',
    };
  }

  if (variant === 'secondary' && tone === 'neutral') {
    return {
      borderColor: borders.mutedViolet.borderColor,
      glow: 'rgba(108,238,255,0.16)',
      gradient: ['rgba(35,25,70,0.94)', 'rgba(20,15,46,0.98)'],
      textColor: colors.text,
    };
  }

  switch (tone) {
    case 'danger':
      return {
        borderColor: colors.danger,
        glow: 'rgba(255,126,165,0.28)',
        gradient: ['#A83367', '#6B234A'],
        textColor: '#FFF3F8',
      };
    case 'success':
      return {
        borderColor: colors.success,
        glow: 'rgba(99,255,207,0.26)',
        gradient: ['#168A6B', '#0C5948'],
        textColor: '#E8FFF7',
      };
    case 'accent':
      return {
        borderColor: colors.gold,
        glow: colors.glowGold,
        gradient: gradients.actionGold,
        textColor: '#FFF7E6',
      };
    case 'neutral':
      return {
        borderColor: variant === 'primary' ? '#9F89FF' : colors.border,
        glow: 'rgba(140,112,255,0.24)',
        gradient: variant === 'primary' ? ['#613FC9', '#422A90'] : ['#2A225B', '#1E1841'],
        textColor: colors.text,
      };
    case 'primary':
    default:
      return {
        borderColor: colors.secondary,
        glow: colors.glowCyan,
        gradient: gradients.actionPrimary,
        textColor: '#ECFFFF',
      };
  }
}

function resolveVariant(variant: ActionButtonVariant) {
  if (variant === 'compact' || variant === 'full-width') {
    return 'primary' as const;
  }
  return variant;
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
  const visualVariant = resolveVariant(variant);
  const isCompact = compact || variant === 'compact';
  const isFullWidth = fullWidth || variant === 'full-width';
  const resolvedTone = tone ?? (visualVariant === 'secondary' || visualVariant === 'ghost' ? 'neutral' : 'primary');
  const visuals = useMemo(() => getVisuals(visualVariant, resolvedTone), [resolvedTone, visualVariant]);

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
    <Animated.View
      style={[
        isFullWidth ? styles.fullWidthContainer : null,
        { transform: [{ scale }] },
        containerStyle,
      ]}
    >
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
          isCompact ? styles.compactButton : null,
          isFullWidth ? styles.fullWidth : null,
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
          {loading ? (
            <ActivityIndicator color={visuals.textColor} size="small" />
          ) : icon ? (
            <MaterialCommunityIcons color={visuals.textColor} name={icon} size={isCompact ? 16 : 18} />
          ) : null}
          <Text style={[styles.label, isCompact ? styles.labelCompact : null, { color: visuals.textColor }]}>{label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    ...borders.default,
    borderRadius: radii.button,
    minWidth: 148,
    overflow: 'hidden',
    paddingHorizontal: componentSpacing.button.paddingHorizontal,
    paddingVertical: componentSpacing.button.paddingVertical,
    position: 'relative',
  },
  compactButton: {
    minWidth: 0,
    paddingHorizontal: componentSpacing.buttonCompact.paddingHorizontal,
    paddingVertical: componentSpacing.buttonCompact.paddingVertical,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[8],
    justifyContent: 'center',
    minWidth: 0,
  },
  fullWidth: {
    minWidth: 0,
    width: '100%',
  },
  fullWidthContainer: {
    alignSelf: 'stretch',
    minWidth: 0,
    width: '100%',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 13,
  },
});
