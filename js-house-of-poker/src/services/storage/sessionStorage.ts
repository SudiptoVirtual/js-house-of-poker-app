import AsyncStorage from '@react-native-async-storage/async-storage';

const storageKeys = {
  authToken: '@house-of-poker/auth-token',
  currentGameId: '@house-of-poker/current-game-id',
  showTutorial: '@house-of-poker/show-tutorial',
  user: '@house-of-poker/user',
} as const;

type StoredAuthSession = {
  token: string;
  user: unknown;
};

export async function saveAuthSession(session: StoredAuthSession) {
  await AsyncStorage.multiSet([
    [storageKeys.authToken, session.token],
    [storageKeys.user, JSON.stringify(session.user)],
  ]);
}

export async function getAuthSession(): Promise<StoredAuthSession | null> {
  const [[, token], [, userJson]] = await AsyncStorage.multiGet([
    storageKeys.authToken,
    storageKeys.user,
  ]);

  if (!token || !userJson) {
    return null;
  }

  return {
    token,
    user: JSON.parse(userJson),
  };
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([storageKeys.authToken, storageKeys.user, storageKeys.currentGameId]);
}

export async function setCurrentGameId(gameId: string | null) {
  if (!gameId) {
    await AsyncStorage.removeItem(storageKeys.currentGameId);
    return;
  }

  await AsyncStorage.setItem(storageKeys.currentGameId, gameId);
}

export async function getCurrentGameId() {
  return AsyncStorage.getItem(storageKeys.currentGameId);
}

export async function setShowTutorial(value: boolean) {
  await AsyncStorage.setItem(storageKeys.showTutorial, value ? 'true' : 'false');
}

export async function getShowTutorial(defaultValue = true) {
  const value = await AsyncStorage.getItem(storageKeys.showTutorial);

  if (value === null) {
    return defaultValue;
  }

  return value === 'true';
}
