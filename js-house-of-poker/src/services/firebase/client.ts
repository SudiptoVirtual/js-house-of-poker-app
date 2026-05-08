import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';

import { env } from '../../config/env';

type FirebaseAuthModule = typeof FirebaseAuth & {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
};

type FirebaseClientEnvName =
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID';

const firebaseAuthModule = FirebaseAuth as FirebaseAuthModule;

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  appId: env.firebase.appId,
  authDomain: env.firebase.authDomain,
  messagingSenderId: env.firebase.messagingSenderId,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
};

const firebaseConfigEntries: Array<{ envName: FirebaseClientEnvName; value: string }> = [
  { envName: 'EXPO_PUBLIC_FIREBASE_API_KEY', value: firebaseConfig.apiKey },
  { envName: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', value: firebaseConfig.authDomain },
  { envName: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', value: firebaseConfig.projectId },
  { envName: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', value: firebaseConfig.storageBucket },
  { envName: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: firebaseConfig.messagingSenderId },
  { envName: 'EXPO_PUBLIC_FIREBASE_APP_ID', value: firebaseConfig.appId },
];

let firebaseAuth: FirebaseAuth.Auth | null = null;

function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

function getFirebaseAuthInstance() {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();
  const persistence = firebaseAuthModule.getReactNativePersistence?.(AsyncStorage);

  try {
    firebaseAuth = FirebaseAuth.initializeAuth(
      app,
      persistence
        ? ({
            persistence,
          } as Parameters<typeof FirebaseAuth.initializeAuth>[1])
        : undefined,
    );
  } catch {
    firebaseAuth = FirebaseAuth.getAuth(app);
  }

  return firebaseAuth;
}

export function getMissingFirebaseClientConfig() {
  return firebaseConfigEntries
    .filter((entry) => !entry.value)
    .map((entry) => entry.envName);
}

export function getFirebaseAuthErrorMessage(
  error: unknown,
  fallbackMessage = 'Unable to continue with Google right now.',
) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/user-token-expired':
        return 'Google sign-in could not be verified. Please try again.';
      case 'auth/invalid-api-key':
      case 'auth/app-not-authorized':
        return 'Firebase auth is not configured correctly for this app yet.';
      case 'auth/network-request-failed':
        return 'A network error occurred while contacting Firebase.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled in Firebase Authentication yet.';
      default:
        break;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export async function exchangeGoogleIdTokenForFirebaseToken(googleIdToken: string) {
  const missingConfig = getMissingFirebaseClientConfig();

  if (missingConfig.length > 0) {
    throw new Error(`Missing Firebase app config: ${missingConfig.join(', ')}`);
  }

  const credential = FirebaseAuth.GoogleAuthProvider.credential(googleIdToken);
  const userCredential = await FirebaseAuth.signInWithCredential(
    getFirebaseAuthInstance(),
    credential,
  );

  return userCredential.user.getIdToken();
}
