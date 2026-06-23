import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatNotificationBanner } from '../components/notifications/ChatNotificationBanner';
import { FeedNotificationBanner } from '../components/notifications/FeedNotificationBanner';
import { FriendRequestBanner } from '../components/notifications/FriendRequestBanner';
import { NotificationBellButton } from '../components/notifications/NotificationBellButton';
import { routes } from '../constants/routes';
import { ChatRoomDetailScreen } from '../screens/ChatRoomDetailScreen';
import { ChatRoomsScreen } from '../screens/ChatRoomsScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { GameScreen } from '../screens/GameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NotificationCenterScreen } from '../components/notifications/NotificationCenterScreen';
import { MyFeedScreen } from '../screens/MyFeedScreen';
import { PlayerDirectoryScreen } from '../screens/PlayerDirectoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useAuth } from '../context/AuthProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

type NotificationNavigation = {
  navigate: (routeName: typeof routes.Notifications) => void;
};

function buildNotificationHeaderOptions(title: string) {
  return ({ navigation }: { navigation: NotificationNavigation }) => ({
    headerRight: () => (
      <View style={styles.notificationHeaderAction}>
        <NotificationBellButton onPress={() => navigation.navigate(routes.Notifications)} />
      </View>
    ),
    title,
  });
}

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
  },
};

export function RootNavigator() {
  const { isRestoringSession, token } = useAuth();
  const initialRouteName = useMemo<keyof RootStackParamList>(
    () => (token ? routes.Home : routes.Login),
    [token],
  );

  if (isRestoringSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.secondary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          orientation: 'portrait',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerBackVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name={routes.Welcome}
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={routes.Login}
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={routes.Registration}
          component={RegistrationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name={routes.Home}
          component={HomeScreen}
          options={buildNotificationHeaderOptions('Lobby')}
        />
        <Stack.Screen
          name={routes.ChatRooms}
          component={ChatRoomsScreen}
          options={buildNotificationHeaderOptions('Chat Rooms')}
        />
        <Stack.Screen
          name={routes.ChatRoomDetail}
          component={ChatRoomDetailScreen}
          options={buildNotificationHeaderOptions('Chat Room')}
        />
        <Stack.Screen
          name={routes.Profile}
          component={ProfileScreen}
          options={buildNotificationHeaderOptions('Profile')}
        />
        <Stack.Screen
          name={routes.UserProfile}
          component={UserProfileScreen}
          options={buildNotificationHeaderOptions('Player Profile')}
        />
        <Stack.Screen
          name={routes.Friends}
          component={FriendsScreen}
          options={buildNotificationHeaderOptions('Friends')}
        />
        <Stack.Screen
          name={routes.Feed}
          component={FeedScreen}
          options={buildNotificationHeaderOptions('Feed')}
        />
        <Stack.Screen
          name={routes.MyFeed}
          component={MyFeedScreen}
          options={buildNotificationHeaderOptions('My Feed')}
        />
        <Stack.Screen
          name={routes.PlayerDirectory}
          component={PlayerDirectoryScreen}
          options={buildNotificationHeaderOptions('Player Directory')}
        />
        <Stack.Screen
          name={routes.Notifications}
          component={NotificationCenterScreen}
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name={routes.Game}
          component={GameScreen}
          options={{ headerShown: false, orientation: 'landscape' }}
        />
      </Stack.Navigator>
      <FeedNotificationBanner />
      <FriendRequestBanner />
      <ChatNotificationBanner />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  notificationHeaderAction: {
    marginRight: 4,
  },
});
