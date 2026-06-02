import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { routes } from '../../constants/routes';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';

type PlatformRouteName = 'Home' | 'ChatRooms' | 'Feed' | 'Friends' | 'Profile';

type NavigationItem = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  route: PlatformRouteName;
};

const navigationItems: NavigationItem[] = [
  { icon: 'cards-playing-outline', label: 'The Floor', route: routes.Home },
  { icon: 'chat-outline', label: 'Chat Rooms', route: routes.ChatRooms },
  { icon: 'post-outline', label: 'Social Feed', route: routes.Feed },
  { icon: 'account-multiple-outline', label: 'Friends', route: routes.Friends },
  { icon: 'account-circle-outline', label: 'Profile', route: routes.Profile },
];

export function MainPlatformNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {navigationItems.map((item) => {
        const isActive = route.name === item.route;

        return (
          <Pressable
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
            <MaterialCommunityIcons
              color={isActive ? colors.background : colors.secondary}
              name={item.icon}
              size={18}
            />
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  item: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  itemPressed: {
    opacity: 0.78,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  labelActive: {
    color: colors.background,
  },
});
