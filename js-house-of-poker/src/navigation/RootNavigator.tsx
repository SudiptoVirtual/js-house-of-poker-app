import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { routes } from '../constants/routes';
import { FeedScreen } from '../screens/FeedScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { GameScreen } from '../screens/GameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlayerDirectoryScreen } from '../screens/PlayerDirectoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegistrationScreen } from '../screens/RegistrationScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { getAuthSession } from '../services/storage/sessionStorage';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  const [hasBootstrappedSession, setHasBootstrappedSession] = useState(false);
  const [initialRouteName, setInitialRouteName] =
    useState<keyof RootStackParamList>(routes.Login);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const session = await getAuthSession();

        if (isMounted) {
          setInitialRouteName(session?.token ? routes.Home : routes.Login);
        }
      } finally {
        if (isMounted) {
          setHasBootstrappedSession(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!hasBootstrappedSession) {
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
          options={{ title: 'Lobby' }}
        />
        <Stack.Screen
          name={routes.Profile}
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name={routes.Friends}
          component={FriendsScreen}
          options={{ title: 'Friends' }}
        />
        <Stack.Screen
          name={routes.Feed}
          component={FeedScreen}
          options={{ title: 'Feed' }}
        />
        <Stack.Screen
          name={routes.PlayerDirectory}
          component={PlayerDirectoryScreen}
          options={{ title: 'Player Directory' }}
        />
        <Stack.Screen
          name={routes.Game}
          component={GameScreen}
          options={{ headerShown: false, orientation: 'landscape' }}
        />
      </Stack.Navigator>
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
});
