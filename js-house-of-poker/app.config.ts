const baseConfig = require('./app.json').expo as {
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

type AppEnvironment = 'development' | 'preview' | 'production';

const DEFAULT_API_TIMEOUT = '15000';
const PRODUCTION_API_BASE_URL = 'https://www.jshouseofpoker.com';

const defaultApiBaseUrls: Record<AppEnvironment, string> = {
  development: 'http://localhost:5000',
  preview: PRODUCTION_API_BASE_URL,
  production: PRODUCTION_API_BASE_URL,
};

const defaultPublicEnv = {
  EXPO_PUBLIC_API_TIMEOUT: DEFAULT_API_TIMEOUT,
  EXPO_PUBLIC_POKER_TRANSPORT: 'local',
  EXPO_PUBLIC_POKER_SOCKET_URL: '',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'AIzaSyBQjIklN4IJAQCh-U8NxHmxQnl2KyCcazA',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'j-s-house-of-poker-2f734.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'j-s-house-of-poker-2f734',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'j-s-house-of-poker-2f734.firebasestorage.app',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '321986327701',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:321986327701:web:555e8f66c3b9bf6e83d79c',
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-VZPJEME7J0',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
    '780261289763-653ni2spsqe7m934p6jq0phuebr19mfa.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
    '780261289763-653ni2spsqe7m934p6jq0phuebr19mfa.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
    '780261289763-653ni2spsqe7m934p6jq0phuebr19mfa.apps.googleusercontent.com',
};

function readEnv(name: string) {
  const value = process.env[name];

  return typeof value === 'string' ? value.trim() : '';
}

function resolveAppEnvironment(): AppEnvironment {
  const rawValue = (readEnv('APP_ENV') || readEnv('EAS_BUILD_PROFILE') || 'development').toLowerCase();

  if (rawValue === 'preview' || rawValue === 'production') {
    return rawValue;
  }

  return 'development';
}

const appEnvironment = resolveAppEnvironment();
const apiBaseUrl =
  readEnv('EXPO_PUBLIC_API_BASE_URL') ||
  readEnv('EXPO_PUBLIC_BASE_URL') ||
  defaultApiBaseUrls[appEnvironment];

const publicEnv = {
  ...defaultPublicEnv,
  EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  EXPO_PUBLIC_BASE_URL: apiBaseUrl,
  EXPO_PUBLIC_API_TIMEOUT: readEnv('EXPO_PUBLIC_API_TIMEOUT') || DEFAULT_API_TIMEOUT,
  EXPO_PUBLIC_POKER_TRANSPORT:
    readEnv('EXPO_PUBLIC_POKER_TRANSPORT') || defaultPublicEnv.EXPO_PUBLIC_POKER_TRANSPORT,
  EXPO_PUBLIC_POKER_SOCKET_URL:
    readEnv('EXPO_PUBLIC_POKER_SOCKET_URL') || defaultPublicEnv.EXPO_PUBLIC_POKER_SOCKET_URL,
  EXPO_PUBLIC_FIREBASE_API_KEY:
    readEnv('EXPO_PUBLIC_FIREBASE_API_KEY') || defaultPublicEnv.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:
    readEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN') ||
    defaultPublicEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID:
    readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || defaultPublicEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:
    readEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET') ||
    defaultPublicEnv.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    readEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID') ||
    defaultPublicEnv.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID:
    readEnv('EXPO_PUBLIC_FIREBASE_APP_ID') || defaultPublicEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID:
    readEnv('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID') ||
    defaultPublicEnv.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:
    readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID') ||
    defaultPublicEnv.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:
    readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || defaultPublicEnv.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
    readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID') || defaultPublicEnv.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export default {
  ...baseConfig,
  extra: {
    ...(baseConfig.extra ?? {}),
    appEnvironment,
    publicEnv,
  },
};
