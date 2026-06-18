import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { borders, colors, componentSpacing, radii, shadows, spacing, typography } from '../theme';

type SectionCardVariant = 'elevated' | 'glass' | 'felt' | 'warning' | 'stat' | 'modal';

type SectionCardProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  headerRight?: ReactNode;
  style?: StyleProp<ViewStyle>;
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  variant?: SectionCardVariant;
}>;

export function SectionCard({
  title,
  headerRight,
  children,
  contentStyle,
  style,
  titleStyle,
  variant = 'elevated',
}: SectionCardProps) {
  return (
    <View style={[styles.card, styles[variant], style]}>
      {headerRight ? (
        <View style={styles.header}>
          <Text style={[styles.title, styles.headerTitle, titleStyle]}>{title}</Text>
          <View style={styles.headerRight}>{headerRight}</View>
        </View>
      ) : title ? (
        <Text style={[styles.title, titleStyle]}>{title}</Text>
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...borders.default,
    borderRadius: radii.card,
    gap: componentSpacing.card.gap,
    padding: componentSpacing.card.padding,
  },
  content: {
    gap: spacing[10],
  },
  elevated: {
    ...shadows.md,
    backgroundColor: colors.surface,
  },
  felt: {
    backgroundColor: colors.surfaces.feltTint,
    borderColor: colors.felt,
  },
  glass: {
    backgroundColor: colors.surfaces.glassPanel,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[12],
    justifyContent: 'space-between',
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  modal: {
    ...shadows.lg,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  stat: {
    backgroundColor: colors.surfaces.actionTint,
    borderColor: colors.secondary,
  },
  title: {
    color: colors.text,
    ...typography.sectionTitle,
  },
  warning: {
    backgroundColor: colors.goldTint,
    borderColor: colors.gold,
  },
});
