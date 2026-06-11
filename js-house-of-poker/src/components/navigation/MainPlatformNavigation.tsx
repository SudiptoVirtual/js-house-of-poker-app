import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../constants/routes';
import { useChatNotifications } from '../../context/ChatNotificationProvider';
import { useFeedNotifications } from '../../context/FeedNotificationProvider';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';

type PlatformRouteName = 'Home' | 'ChatRooms' | 'Feed' | 'Friends' | 'Profile';

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
    activeIcon: 'forum',
    icon: 'forum-outline',
    label: 'Chats',
    route: routes.ChatRooms,
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
    activeIcon: 'account-circle',
    icon: 'account-circle-outline',
    label: 'Profile',
    route: routes.Profile,
  },
];

export function MainPlatformNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { totalUnreadMessageCount } = useChatNotifications();
  const { unreadCount } = useFeedNotifications();

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {navigationItems.map((item) => {
        const isActive =
          route.name === item.route ||
          (route.name === routes.ChatRoomDetail && item.route === routes.ChatRooms);

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
            <View>
              <MaterialCommunityIcons
                color={isActive ? colors.secondary : colors.mutedText}
                name={isActive ? item.activeIcon : item.icon}
                size={24}
              />
              {item.route === routes.Feed && unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
              {item.route === routes.ChatRooms && totalUnreadMessageCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalUnreadMessageCount > 9 ? '9+' : totalUnreadMessageCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 17,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -10,
    top: -7,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  container: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  item: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    gap: 4,
    minHeight: 58,
    paddingHorizontal: 4,
    paddingTop: 7,
  },
  itemActive: {
    backgroundColor: colors.surfaceMuted,
  },
  itemPressed: {
    opacity: 0.78,
  },
  label: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.text,
  },
});
