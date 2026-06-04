const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');

const baseConfig = require('./app.json').expo as {
  extra?: Record<string, unknown>;
  [key: string]: unknown;
};

type AppEnvironment = 'development' | 'preview' | 'production';

const DEFAULT_API_TIMEOUT = '15000';
const DEFAULT_POKER_SOCKET_PROTOCOL = 'table-v1';

const defaultPublicEnv = {
  EXPO_PUBLIC_BASE_URL: '',
  EXPO_PUBLIC_API_TIMEOUT: DEFAULT_API_TIMEOUT,
  EXPO_PUBLIC_POKER_TRANSPORT: 'local',
  EXPO_PUBLIC_POKER_SOCKET_URL: '',
  EXPO_PUBLIC_POKER_BACKEND_URL: '',
  EXPO_PUBLIC_POKER_SOCKET_PROTOCOL: DEFAULT_POKER_SOCKET_PROTOCOL,
  EXPO_PUBLIC_FEED_PROMOTION_PAYMENT_PROVIDER: '',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'AIzaSyBQjIklN4IJAQCh-U8NxHmxQnl2KyCcazA',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'j-s-house-of-poker-2f734.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'j-s-house-of-poker-2f734',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'j-s-house-of-poker-2f734.firebasestorage.app',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '321986327701',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:321986327701:web:555e8f66c3b9bf6e83d79c',
  EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-VZPJEME7J0',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '',
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: '',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '',
};

type EnvFileValues = Record<string, string>;

const baseEnvValues: EnvFileValues = {};
const resolvedEnvFileValues: EnvFileValues = {};

function isPlaceholderEnvValue(value: string) {
  return /^@[A-Za-z0-9_-]+$/.test(value);
}

function normalizeEnvValue(value: string) {
  const trimmedValue = value.trim();

  return isPlaceholderEnvValue(trimmedValue) ? '' : trimmedValue;
}

function parseDotenvValue(rawValue: string) {
  let value = rawValue.trim();

  if (!value) {
    return '';
  }

  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  const commentMatch = /\s+#/.exec(value);

  if (commentMatch?.index !== undefined) {
    value = value.slice(0, commentMatch.index).trim();
  }

  return value;
}

function loadEnvFile(
  fileName: string,
  target: EnvFileValues,
  overrideLoadedValues = false,
) {
  const filePath = path.join(__dirname, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = trimmedLine.slice(0, separatorIndex).trim();

    if (!name) {
      continue;
    }

    if (!overrideLoadedValues && target[name] !== undefined) {
      continue;
    }

    target[name] = parseDotenvValue(trimmedLine.slice(separatorIndex + 1));
  }
}

function mergeEnvValues(values: EnvFileValues) {
  for (const [name, value] of Object.entries(values)) {
    resolvedEnvFileValues[name] = value;
  }
}

function readEnv(name: string) {
  const processValue = normalizeEnvValue(process.env[name] ?? '');
  const baseEnvValue = normalizeEnvValue(baseEnvValues[name] ?? '');
  const hasFileEnvValue = Object.prototype.hasOwnProperty.call(resolvedEnvFileValues, name);
  const fileEnvValue = normalizeEnvValue(resolvedEnvFileValues[name] ?? '');

  if (processValue && processValue !== baseEnvValue) {
    return processValue;
  }

  if (hasFileEnvValue) {
    return fileEnvValue;
  }

  return processValue;
}

loadEnvFile('.env', baseEnvValues);
loadEnvFile('.env.local', baseEnvValues, true);
mergeEnvValues(baseEnvValues);

function resolveAppEnvironment(): AppEnvironment {
  const rawValue = (readEnv('APP_ENV') || readEnv('EAS_BUILD_PROFILE') || 'development').toLowerCase();

  if (rawValue === 'preview' || rawValue === 'production') {
    return rawValue;
  }

  return 'development';
}

const appEnvironment = resolveAppEnvironment();
const profileEnvValues: EnvFileValues = {};
loadEnvFile(`.env.${appEnvironment}`, profileEnvValues);
loadEnvFile(`.env.${appEnvironment}.local`, profileEnvValues, true);
mergeEnvValues(profileEnvValues);

const apiBaseUrl =
  readEnv('EXPO_PUBLIC_BASE_URL') ||
  defaultPublicEnv.EXPO_PUBLIC_BASE_URL;
const configuredPokerBackendUrl =
  readEnv('EXPO_PUBLIC_POKER_BACKEND_URL') ||
  readEnv('EXPO_PUBLIC_POKER_SOCKET_URL') ||
  apiBaseUrl ||
  defaultPublicEnv.EXPO_PUBLIC_POKER_BACKEND_URL;
const pokerTransport =
  readEnv('EXPO_PUBLIC_POKER_TRANSPORT') ||
  (appEnvironment === 'production' ? 'socket' : defaultPublicEnv.EXPO_PUBLIC_POKER_TRANSPORT);
const pokerSocketUrl = configuredPokerBackendUrl;
const pokerSocketProtocol =
  readEnv('EXPO_PUBLIC_POKER_SOCKET_PROTOCOL') ||
  defaultPublicEnv.EXPO_PUBLIC_POKER_SOCKET_PROTOCOL;

if ((appEnvironment === 'preview' || appEnvironment === 'production') && !apiBaseUrl) {
  throw new Error(
    `APP_ENV=${appEnvironment} requires EXPO_PUBLIC_BASE_URL to point at poker-backend.`,
  );
}

if (
  (appEnvironment === 'preview' || appEnvironment === 'production') &&
  pokerTransport === 'socket' &&
  !pokerSocketUrl
) {
  throw new Error(
    `APP_ENV=${appEnvironment} requires EXPO_PUBLIC_POKER_SOCKET_URL or EXPO_PUBLIC_POKER_BACKEND_URL when EXPO_PUBLIC_POKER_TRANSPORT=socket.`,
  );
}

const publicEnv = {
  ...defaultPublicEnv,
  EXPO_PUBLIC_BASE_URL: apiBaseUrl,
  EXPO_PUBLIC_API_TIMEOUT: readEnv('EXPO_PUBLIC_API_TIMEOUT') || DEFAULT_API_TIMEOUT,
  EXPO_PUBLIC_POKER_TRANSPORT: pokerTransport,
  EXPO_PUBLIC_POKER_SOCKET_URL: pokerSocketUrl,
  EXPO_PUBLIC_POKER_BACKEND_URL: pokerSocketUrl,
  EXPO_PUBLIC_POKER_SOCKET_PROTOCOL: pokerSocketProtocol,
  EXPO_PUBLIC_FEED_PROMOTION_PAYMENT_PROVIDER:
    readEnv('EXPO_PUBLIC_FEED_PROMOTION_PAYMENT_PROVIDER') ||
    defaultPublicEnv.EXPO_PUBLIC_FEED_PROMOTION_PAYMENT_PROVIDER,
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
