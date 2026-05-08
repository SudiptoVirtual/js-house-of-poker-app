import Constants from 'expo-constants';
import { Platform } from 'react-native';

type PublicEnvName =
  | 'EXPO_PUBLIC_API_BASE_URL'
  | 'EXPO_PUBLIC_BASE_URL'
  | 'EXPO_PUBLIC_API_TIMEOUT'
  | 'EXPO_PUBLIC_POKER_BACKEND_URL'
  | 'EXPO_PUBLIC_POKER_TRANSPORT'
  | 'EXPO_PUBLIC_POKER_SOCKET_URL'
  | 'EXPO_PUBLIC_POKER_SOCKET_PROTOCOL'
  | 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
  | 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readEmbeddedEnv(name: PublicEnvName) {
  const extraSources = [
    Constants.expoConfig?.extra,
    Constants.manifest2?.extra,
    (Constants as typeof Constants & { manifest?: { extra?: unknown } }).manifest?.extra,
  ];

  for (const source of extraSources) {
    if (!isRecord(source)) {
      continue;
    }

    if (typeof source[name] === 'string') {
      return source[name].trim();
    }

    if (typeof source[name] === 'number') {
      return String(source[name]);
    }

    const publicEnv = source.publicEnv;

    if (!isRecord(publicEnv)) {
      continue;
    }

    if (typeof publicEnv[name] === 'string') {
      return publicEnv[name].trim();
    }

    if (typeof publicEnv[name] === 'number') {
      return String(publicEnv[name]);
    }
  }

  return '';
}

function readPublicEnv(name: string) {
  const processValue = process.env[name]?.trim();

  if (processValue) {
    return processValue;
  }

  return readEmbeddedEnv(name as PublicEnvName);
}

function getExpoDevServerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    '';

  if (!hostUri) {
    return '';
  }

  return hostUri.split(':')[0] ?? '';
}

function resolveApiBaseUrl(rawValue: string) {
  if (!rawValue) {
    return '';
  }

  try {
    const parsedUrl = new URL(rawValue);
    const isLocalhost =
      parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';

    if (!isLocalhost || Platform.OS === 'web') {
      return trimTrailingSlash(parsedUrl.toString());
    }

    const expoHost = getExpoDevServerHost();

    if (expoHost) {
      parsedUrl.hostname = expoHost;
      return trimTrailingSlash(parsedUrl.toString());
    }

    if (Platform.OS === 'android') {
      parsedUrl.hostname = '10.0.2.2';
      return trimTrailingSlash(parsedUrl.toString());
    }

    return trimTrailingSlash(parsedUrl.toString());
  } catch {
    return trimTrailingSlash(rawValue);
  }
}

const apiBaseUrl = resolveApiBaseUrl(
  readPublicEnv('EXPO_PUBLIC_API_BASE_URL') || readPublicEnv('EXPO_PUBLIC_BASE_URL') || '',
);
const pokerTransport = readPublicEnv('EXPO_PUBLIC_POKER_TRANSPORT').toLowerCase();
const pokerSocketUrl = resolveApiBaseUrl(
  readPublicEnv('EXPO_PUBLIC_POKER_SOCKET_URL') ||
    readPublicEnv('EXPO_PUBLIC_POKER_BACKEND_URL'),
);
const pokerSocketProtocol = readPublicEnv('EXPO_PUBLIC_POKER_SOCKET_PROTOCOL').toLowerCase();
const googleAndroidClientId = readPublicEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
const googleIosClientId = readPublicEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
const googleWebClientId = readPublicEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
const firebaseApiKey = readPublicEnv('EXPO_PUBLIC_FIREBASE_API_KEY');
const firebaseAuthDomain = readPublicEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
const firebaseProjectId = readPublicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
const firebaseStorageBucket = readPublicEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
const firebaseMessagingSenderId = readPublicEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
const firebaseAppId = readPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID');
const expoScheme = Constants.expoConfig?.scheme;
const googleRedirectScheme = Array.isArray(expoScheme) ? expoScheme[0] : expoScheme;

export const env = {
  appName: Constants.expoConfig?.name ?? 'House of Poker',
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  apiBaseUrl,
  poker: {
    backendUrl: pokerSocketUrl,
    socketUrl: pokerSocketUrl,
    socketProtocol: pokerSocketProtocol === 'table-v1' ? 'table-v1' : 'legacy',
    transport: pokerTransport === 'socket' ? 'socket' : 'local',
  },
  googleAuth: {
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    webClientId: googleWebClientId,
  },
  firebase: {
    apiKey: firebaseApiKey,
    appId: firebaseAppId,
    authDomain: firebaseAuthDomain,
    messagingSenderId: firebaseMessagingSenderId,
    projectId: firebaseProjectId,
    storageBucket: firebaseStorageBucket,
  },
  googleRedirectPath: 'oauthredirect',
  googleRedirectScheme: googleRedirectScheme ?? 'houseofpoker',
};

export const apiConfig = {
  BASE_URL: env.apiBaseUrl,
  API_TIMEOUT: Number(readPublicEnv('EXPO_PUBLIC_API_TIMEOUT') || 15000),
};

export function requireEnvValue(name: keyof Pick<typeof env, 'apiBaseUrl'>) {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment value: ${name}`);
  }

  return value;
}
