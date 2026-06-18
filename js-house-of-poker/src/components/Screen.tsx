import { useMemo, type PropsWithChildren, type ReactNode } from 'react';
import {
  Platform,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeView } from './KeyboardSafeView';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { MainPlatformNavigation } from './navigation/MainPlatformNavigation';
import { getAdjacentPlatformRoute } from './navigation/platformNavigation';
import type { RootStackParamList } from '../types/navigation';

import { colors } from '../theme/colors';

const platformNavigationHeight = 96;

type ScreenProps = PropsWithChildren<{
  bodyStyle?: StyleProp<ViewStyle>;
  compactHeader?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  headerHero?: ReactNode;
  headerRight?: ReactNode;
  headerStats?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollable?: boolean;
  subtitle?: string;
  showPlatformNavigation?: boolean;
  title: string;
  topSafeAreaScale?: number;
}>;

export function Screen({
  bodyStyle,
  compactHeader = false,
  contentStyle,
  eyebrow,
  headerHero,
  headerRight,
  headerStats,
  onRefresh,
  refreshing = false,
  scrollable = true,
  showPlatformNavigation = false,
  subtitle,
  title,
  topSafeAreaScale = 1,
  children,
}: ScreenProps) {
  const isKeyboardVisible = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const safeAreaEdges = topSafeAreaScale === 1
    ? (['top', 'left', 'right'] as const)
    : (['left', 'right'] as const);
  const safeAreaStyle = topSafeAreaScale === 1
    ? styles.safeArea
    : [styles.safeArea, { paddingTop: Math.max(insets.top * topSafeAreaScale, 0) }];
  const hasHeaderCopy = Boolean(eyebrow || title || subtitle);
  const hasHeaderSlots = Boolean(headerHero || headerStats);
  const hasHeader = hasHeaderCopy || Boolean(headerRight) || hasHeaderSlots;
  const bottomNavigationPadding = showPlatformNavigation
    ? platformNavigationHeight + insets.bottom + colors.spacing[20]
    : colors.spacing[20];
  const contentStyles = [
    styles.content,
    { paddingBottom: bottomNavigationPadding },
    compactHeader ? styles.compactContent : null,
    !scrollable ? styles.staticContent : null,
    contentStyle,
  ];
  const bodyStyles = [styles.body, !scrollable ? styles.staticBody : null, bodyStyle];
  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!showPlatformNavigation || isKeyboardVisible) {
          return false;
        }

        const horizontalDistance = Math.abs(gestureState.dx);
        const verticalDistance = Math.abs(gestureState.dy);

        return horizontalDistance > 30 && horizontalDistance > verticalDistance * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 70) {
          return;
        }

        const targetRoute = getAdjacentPlatformRoute(
          route.name,
          gestureState.dx < 0 ? 'next' : 'previous',
        );

        if (targetRoute) {
          navigation.navigate(targetRoute);
        }
      },
    }),
    [isKeyboardVisible, navigation, route.name, showPlatformNavigation],
  );
  const header = hasHeader ? (
    <LinearGradient colors={colors.gradients.feltTable} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, compactHeader ? styles.compactHeader : null]}>
      <View style={styles.headerGlow} />
      <View style={[styles.headerTopRow, compactHeader ? styles.compactHeaderTopRow : null]}>
        {hasHeaderCopy ? (
          <View style={[styles.headerCopy, compactHeader ? styles.compactHeaderCopy : null]}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={[styles.title, compactHeader ? styles.compactTitle : null]}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
      {hasHeaderSlots ? (
        <View style={styles.headerSlotStack}>
          {headerHero ? <View style={styles.headerHeroSlot}>{headerHero}</View> : null}
          {headerStats ? <View style={styles.headerStatsSlot}>{headerStats}</View> : null}
        </View>
      ) : null}
    </LinearGradient>
  ) : null;
  const body = <View style={bodyStyles}>{children}</View>;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.palette.casinoMidnight, colors.palette.casinoPurple, colors.palette.feltDeep]} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.backgroundOrb, styles.backgroundOrbGold]} />
      <View style={[styles.backgroundOrb, styles.backgroundOrbFelt]} />
      <KeyboardSafeView>
        <SafeAreaView
          edges={safeAreaEdges}
          style={safeAreaStyle}
          {...(showPlatformNavigation ? panResponder.panHandlers : {})}
        >
          <StatusBar style="light" />
          {scrollable ? (
            <ScrollView
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={contentStyles}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              refreshControl={onRefresh ? (
                <RefreshControl
                  colors={[colors.primary, colors.secondary]}
                  onRefresh={onRefresh}
                  progressBackgroundColor={colors.surface}
                  refreshing={refreshing}
                  tintColor={colors.primary}
                  title="Refreshing..."
                  titleColor={colors.mutedText}
                />
              ) : undefined}
            >
              {header}
              {body}
            </ScrollView>
          ) : (
            <View style={contentStyles}>
              {header}
              {body}
            </View>
          )}
        </SafeAreaView>
      </KeyboardSafeView>
      {showPlatformNavigation && !isKeyboardVisible ? (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomNavigationSafeArea}>
          <MainPlatformNavigation />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundOrb: {
    borderRadius: colors.radii.pill,
    height: 220,
    opacity: 0.28,
    position: 'absolute',
    width: 220,
  },
  backgroundOrbFelt: {
    backgroundColor: colors.felt,
    bottom: 96,
    left: -118,
  },
  backgroundOrbGold: {
    backgroundColor: colors.gold,
    right: -132,
    top: 84,
  },
  body: {
    gap: colors.spacing[16],
  },
  bottomNavigationSafeArea: {
    backgroundColor: colors.roles.navigationBar,
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    ...colors.shadows.lg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: colors.spacing[20],
    paddingTop: colors.spacing[20],
    rowGap: colors.spacing[16] + 2,
  },
  compactContent: {
    paddingTop: colors.spacing[12],
    rowGap: colors.spacing[8] + 2,
  },
  compactHeader: {
    gap: colors.spacing[12],
    padding: colors.spacing[16],
  },
  compactHeaderCopy: {
    gap: colors.spacing[4],
  },
  compactHeaderTopRow: {
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: colors.typography.title.fontSize,
    lineHeight: colors.typography.title.lineHeight,
  },
  eyebrow: {
    ...colors.typography.chipLabel,
    color: colors.gold,
  },
  header: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: colors.radii.xl,
    borderWidth: 1,
    gap: colors.spacing[16],
    overflow: 'hidden',
    padding: colors.spacing[20],
    ...colors.shadows.lg,
  },
  headerCopy: {
    flex: 1,
    gap: colors.spacing[8],
  },
  headerGlow: {
    backgroundColor: colors.gold,
    borderRadius: colors.radii.pill,
    height: 96,
    opacity: 0.12,
    position: 'absolute',
    right: -32,
    top: -40,
    width: 150,
  },
  headerHeroSlot: {
    backgroundColor: colors.surfaces.glassPanel,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    padding: colors.spacing[12],
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  headerSlotStack: {
    gap: colors.spacing[12],
  },
  headerStatsSlot: {
    backgroundColor: colors.surfaces.goldTint,
    borderColor: 'rgba(255,201,94,0.22)',
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    padding: colors.spacing[12],
  },
  headerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: colors.spacing[12],
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  safeArea: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  subtitle: {
    ...colors.typography.body,
    color: colors.mutedText,
  },
  staticBody: {
    flex: 1,
  },
  staticContent: {
    flex: 1,
  },
  title: {
    ...colors.typography.display,
    color: colors.text,
  },
});
