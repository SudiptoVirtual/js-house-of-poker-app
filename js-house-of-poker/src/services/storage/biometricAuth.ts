import { Platform } from 'react-native';

import { fetchCurrentUser, type AuthResponse, type AuthUser } from '../api/auth';

const biometricSessionKey = 'house-of-poker-biometric-session';
const biometricUserKey = 'house-of-poker-biometric-user';

type LocalAuthenticationModule = {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  authenticateAsync: (options: {
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
    fallbackLabel?: string;
    promptMessage?: string;
  }) => Promise<{ success: boolean; error?: string; warning?: string }>;
};

type SecureStoreModule = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string, options?: { keychainService?: string }) => Promise<void>;
};

type BiometricAvailability = {
  available: boolean;
  message?: string;
};

type StoredBiometricUser = Pick<AuthUser, 'email' | 'id' | 'name'>;

declare const require: (moduleName: string) => unknown;

function getLocalAuthentication(): LocalAuthenticationModule | null {
  try {
    return require('expo-local-authentication') as LocalAuthenticationModule;
  } catch {
    return null;
  }
}

function getSecureStore(): SecureStoreModule | null {
  try {
    return require('expo-secure-store') as SecureStoreModule;
  } catch {
    return null;
  }
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (Platform.OS === 'web') {
    return {
      available: false,
      message: 'Biometric login is available only in the iOS and Android apps. Use email and password on web.',
    };
  }

  const localAuthentication = getLocalAuthentication();
  const secureStore = getSecureStore();

  if (!localAuthentication || !secureStore) {
    return {
      available: false,
      message: 'Biometric login is not installed in this build. Use email and password instead.',
    };
  }

  if (!(await localAuthentication.hasHardwareAsync())) {
    return { available: false, message: 'This device does not support biometric login.' };
  }

  if (!(await localAuthentication.isEnrolledAsync())) {
    return { available: false, message: 'No fingerprint or face unlock is enrolled on this device.' };
  }

  return { available: true };
}

export async function hasBiometricSession() {
  const secureStore = getSecureStore();

  if (!secureStore) {
    return false;
  }

  return Boolean(await secureStore.getItemAsync(biometricSessionKey));
}

export async function enableBiometricLogin(session: { token: string; user: AuthUser }) {
  const availability = await getBiometricAvailability();

  if (!availability.available) {
    throw new Error(availability.message ?? 'Biometric login is not available on this device.');
  }

  const secureStore = getSecureStore();

  if (!secureStore) {
    throw new Error('Secure storage is not available in this build.');
  }

  await secureStore.setItemAsync(biometricSessionKey, session.token, { keychainService: biometricSessionKey });
  await secureStore.setItemAsync(
    biometricUserKey,
    JSON.stringify({ email: session.user.email, id: session.user.id, name: session.user.name } satisfies StoredBiometricUser),
    { keychainService: biometricUserKey },
  );
}

export async function disableBiometricLogin() {
  const secureStore = getSecureStore();

  if (!secureStore) {
    return;
  }

  await Promise.all([
    secureStore.deleteItemAsync(biometricSessionKey),
    secureStore.deleteItemAsync(biometricUserKey),
  ]);
}

export async function getBiometricUserLabel() {
  const secureStore = getSecureStore();

  if (!secureStore) {
    return null;
  }

  const storedUser = await secureStore.getItemAsync(biometricUserKey);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as StoredBiometricUser;
    return user.email || user.name || null;
  } catch {
    return null;
  }
}

export async function loginWithBiometrics(): Promise<AuthResponse> {
  const availability = await getBiometricAvailability();

  if (!availability.available) {
    throw new Error(availability.message ?? 'Biometric login is not available on this device.');
  }

  const localAuthentication = getLocalAuthentication();
  const secureStore = getSecureStore();

  if (!localAuthentication || !secureStore) {
    throw new Error('Biometric login is not available in this build.');
  }

  const token = await secureStore.getItemAsync(biometricSessionKey);

  if (!token) {
    throw new Error('Biometric login is not enabled yet. Sign in with email and password first.');
  }

  const result = await localAuthentication.authenticateAsync({
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
    fallbackLabel: 'Use device passcode',
    promptMessage: 'Sign in to J\'s House of Poker',
  });

  if (!result.success) {
    throw new Error('Biometric sign in was cancelled or did not match. Use email and password to continue.');
  }

  const user = await fetchCurrentUser(token);

  return { message: 'Authenticated with biometrics.', token, user };
}
