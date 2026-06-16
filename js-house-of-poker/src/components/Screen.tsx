import { useMemo, type PropsWithChildren } from 'react';
import {
  Platform,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardSafeView } from './KeyboardSafeView';
import { useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { MainPlatformNavigation } from './navigation/MainPlatformNavigation';
import { colors } from '../theme/colors';
import { getAdjacentPlatformRoute } from './navigation/platformNavigation';
import type { RootStackParamList } from '../types/navigation';

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  subtitle?: string;
  showPlatformNavigation?: boolean;
  title: string;
}>;

export function Screen({
  eyebrow,
  onRefresh,
  refreshing = false,
  showPlatformNavigation = false,
  subtitle,
  title,
  children,
}: ScreenProps) {
  const isKeyboardVisible = useKeyboardVisible();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
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

  return (
    <View style={styles.root}>
      <KeyboardSafeView>
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={styles.safeArea}
          {...(showPlatformNavigation ? panResponder.panHandlers : {})}
        >
          <StatusBar style="light" />
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[
              styles.content,
              showPlatformNavigation ? styles.contentWithBottomNavigation : null,
            ]}
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
            <View style={styles.header}>
              {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View style={styles.body}>{children}</View>
          </ScrollView>
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
  contentWithBottomNavigation: {
    paddingBottom: 112,
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
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
});
