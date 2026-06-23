import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../constants/routes';
import { useChatNotifications } from '../../context/ChatNotificationProvider';
import { useFeedNotifications } from '../../context/FeedNotificationProvider';
import { useFriendNotifications } from '../../context/FriendNotificationProvider';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';
import { isPlatformRouteActive, type PlatformRouteName } from './platformNavigation';

type NavigationItem = {
  activeIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  route: PlatformRouteName;
};

const navigationItems: NavigationItem[] = [
  {
    activeIcon: 'home-variant',
    icon: 'home-variant-outline',
    label: 'Lobby',
    route: routes.Home,
  },
  {
    activeIcon: 'newspaper-variant',
    icon: 'newspaper-variant-outline',
    label: 'Feed',
    route: routes.Feed,
  },
  {
    activeIcon: 'account-group',
    icon: 'account-group-outline',
    label: 'Friends',
    route: routes.Friends,
  },
  {
    activeIcon: 'chat-processing',
    icon: 'chat-processing-outline',
    label: 'Chat',
    route: routes.ChatRooms,
  },
  {
    activeIcon: 'account-circle',
    icon: 'account-circle-outline',
    label: 'Profile',
    route: routes.Profile,
  },
];

function formatBadgeCount(count: number) {
  return count > 9 ? '9+' : count.toString();
}

export function MainPlatformNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { totalUnreadMessageCount } = useChatNotifications();
  const { unreadCount } = useFeedNotifications();
  const { pendingRequestCount } = useFriendNotifications();

  return (
    <View style={styles.outerShell}>
      <View accessibilityRole="tablist" style={styles.container}>
        {navigationItems.map((item) => {
          const isActive = isPlatformRouteActive(route.name, item.route);
          const badgeCount =
            item.route === routes.Feed
              ? unreadCount
              : item.route === routes.ChatRooms
                ? totalUnreadMessageCount
                : item.route === routes.Friends
                  ? pendingRequestCount
                  : 0;

          return (
            <Pressable
              accessibilityLabel={`${item.label} tab`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={item.route}
              onPress={() => {
                if (!isActive) {
                  navigation.navigate(item.route);
                }
              }}
              style={({ pressed }) => [
                styles.item,
                isActive ? styles.itemActive : null,
                pressed ? styles.itemPressed : null,
              ]}
            >
              {isActive ? <View style={styles.activeGlow} /> : null}
              <View style={[styles.iconShell, isActive ? styles.iconShellActive : null]}>
                <MaterialCommunityIcons
                  color={isActive ? colors.gold : colors.mutedText}
                  name={isActive ? item.activeIcon : item.icon}
                  size={isActive ? 25 : 23}
                  style={isActive ? styles.activeIcon : null}
                />
                {badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{formatBadgeCount(badgeCount)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, isActive ? styles.labelActive : null]}>{item.label}</Text>
              {isActive ? <View style={styles.activeIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeGlow: {
    borderRadius: colors.radii.pill,
    bottom: 5,
    left: 3,
    position: 'absolute',
    right: 3,
    top: 5,
  },
  activeIcon: {
    transform: [{ scale: 1.06 }],
  },
  activeIndicator: {
    backgroundColor: colors.gold,
    borderRadius: colors.radii.pill,
    bottom: 5,
    height: 3,
    left: 18,
    position: 'absolute',
    right: 18,
    shadowColor: colors.gold,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.gold,
    borderRadius: colors.radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -11,
    shadowColor: colors.accent,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    top: -8,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
  },
  container: {
    alignItems: 'stretch',
    backgroundColor: colors.roles.navigationBar,
    borderColor: colors.border,
    borderRadius: colors.radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    paddingBottom: 5,
    paddingHorizontal: 5,
    paddingTop: 5,
    ...colors.shadows.md,
  },
  iconShell: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: colors.radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 35,
  },
  iconShellActive: {
    backgroundColor: colors.goldTint,
    borderColor: colors.gold,
  },
  item: {
    alignItems: 'center',
    borderRadius: colors.radii.lg,
    flex: 1,
    gap: 2,
    minHeight: 62,
    overflow: 'hidden',
    paddingBottom: 5,
    paddingHorizontal: 0,
    paddingTop: 3,
  },
  itemActive: {
    backgroundColor: colors.surfaces.glassPanel,
  },
  itemPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  labelActive: {
    color: colors.text,
  },
  outerShell: {
    backgroundColor: colors.background,
    paddingBottom: 0,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
});
