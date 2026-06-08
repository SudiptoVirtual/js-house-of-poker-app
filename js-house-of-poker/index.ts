import { registerRootComponent } from 'expo';

import App from './App';
import { env } from './src/config/env';

if (env.appEnvironment !== 'production') {
  console.info(
    [
      '[Backend diagnostic]',
      `APP_ENV: ${env.appEnvironment}`,
      `App version: ${env.appVersion}`,
      `API base URL: ${env.apiBaseUrl || '(not configured)'}`,
      `Poker backend/socket URL: ${env.poker.backendUrl || '(not configured)'}`,
    ].join('\n'),
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
