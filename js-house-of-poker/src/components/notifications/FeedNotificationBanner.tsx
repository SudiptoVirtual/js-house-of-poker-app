import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routes } from '../../constants/routes';
import { useFeedNotifications } from '../../context/FeedNotificationProvider';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';

export function FeedNotificationBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { bannerNotification, clearBannerNotification } = useFeedNotifications();

  if (!bannerNotification) {
    return null;
  }

  function handleOpenNotification() {
    if (!bannerNotification) {
      return;
    }

    const target = bannerNotification.navigationTarget;
    clearBannerNotification();

    if (target.route === routes.Game) {
      navigation.navigate(routes.Game, target.params);
      return;
    }

    navigation.navigate(routes.Feed, target.params);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.safeArea}>
      <Pressable
        accessibilityLabel={`${bannerNotification.label}: ${bannerNotification.body}`}
        accessibilityRole="button"
        onPress={handleOpenNotification}
        style={({ pressed }) => [styles.banner, pressed ? styles.bannerPressed : null]}
      >
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons color={colors.background} name="bell-ring" size={18} />
        </View>
        <View style={styles.copy}>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.label}>{bannerNotification.label}</Text>
            <Text numberOfLines={1} style={styles.cta}>{bannerNotification.ctaLabel}</Text>
          </View>
          <Text numberOfLines={1} style={styles.title}>{bannerNotification.title}</Text>
          <Text numberOfLines={2} style={styles.body}>{bannerNotification.body}</Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss feed notification"
          accessibilityRole="button"
          hitSlop={10}
          onPress={clearBannerNotification}
          style={styles.dismissButton}
        >
          <MaterialCommunityIcons color={colors.mutedText} name="close" size={18} />
        </Pressable>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.secondary,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 14,
    marginTop: 8,
    padding: 12,
    shadowColor: colors.secondary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  bannerPressed: {
    opacity: 0.86,
  },
  body: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  cta: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dismissButton: {
    alignSelf: 'flex-start',
    padding: 2,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  label: {
    color: colors.gold,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  safeArea: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
