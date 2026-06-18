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
type ScreenProps = PropsWithChildren<{
  bodyStyle?: StyleProp<ViewStyle>;
  compactHeader?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  eyebrow?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  scrollable?: boolean;
  subtitle?: string;
  showPlatformNavigation?: boolean;
  headerRight?: ReactNode;
  title: string;
  topSafeAreaScale?: number;
}>;

export function Screen({
  bodyStyle,
  compactHeader = false,
  contentStyle,
  eyebrow,
  onRefresh,
  refreshing = false,
  scrollable = true,
  showPlatformNavigation = false,
  headerRight,
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
  const hasHeader = hasHeaderCopy || Boolean(headerRight);
  const contentStyles = [
    styles.content,
    compactHeader ? styles.compactContent : null,
    showPlatformNavigation ? styles.contentWithBottomNavigation : null,
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
    <View style={[styles.header, compactHeader ? styles.compactHeader : null]}>
      <View style={[styles.headerTopRow, compactHeader ? styles.compactHeaderTopRow : null]}>
        {hasHeaderCopy ? (
          <View style={[styles.headerCopy, compactHeader ? styles.compactHeaderCopy : null]}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={[styles.title, compactHeader ? styles.compactTitle : null]}>{title}</Text> : null}
          </View>
        ) : null}
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  ) : null;
  const body = <View style={bodyStyles}>{children}</View>;

  return (
    <View style={styles.root}>
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
  body: {
    gap: 16,
  },
  bottomNavigationSafeArea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    rowGap: 18,
  },
  compactContent: {
    paddingTop: 12,
    rowGap: 10,
  },
  contentWithBottomNavigation: {
    paddingBottom: 112,
  },
  compactHeader: {
    gap: 0,
  },
  compactHeaderCopy: {
    gap: 0,
  },
  compactHeaderTopRow: {
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: 22,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  header: {
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  headerTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 16,
    lineHeight: 23,
  },
  staticBody: {
    flex: 1,
  },
  staticContent: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
});
