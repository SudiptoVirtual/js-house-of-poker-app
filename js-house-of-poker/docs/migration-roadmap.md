# Migration Roadmap

## Legacy Audit

### Reusable with low risk

- `pokerBuddyApp-master/assets/pocat_splash.png` copied to `assets/images/legacy-pocat-splash.png`
- `pokerBuddyApp-master/components/TipsDatabase.js` moved into `src/constants/tips.ts`
- Endpoint and storage intent from `pokerBuddyApp-master/UtilFunctions.js` can be migrated gradually into typed service modules
- Presentational pieces such as `Button`, `IconButton`, `ListPicker`, `SafeImage`, `PlayerList`, and `ResultList` are good candidates for later conversion once their parent screens are migrated

### Must be rewritten

- `pokerBuddyApp-master/App.js`: uses `react-navigation@1` stack setup and reset helpers
- `pokerBuddyApp-master/package.json`: depends on `react-native-scripts` and CRNA entrypoints
- `pokerBuddyApp-master/app.json`: pinned to Expo SDK 23 config
- `pokerBuddyApp-master/UtilFunctions.js`: uses legacy `expo` namespace APIs, `react-native-dotenv`, and `AsyncStorage` from `react-native`
- `pokerBuddyApp-master/containers/LoginView.js`: uses removed `Expo.Facebook` login flow
- `pokerBuddyApp-master/containers/HomeView.js` and `pokerBuddyApp-master/containers/GameView.js`: depend on old navigation state shape, Pusher wiring, legacy modal patterns, and class-component refs

## Dependency Decisions

| Legacy package | Decision | Modern plan |
| --- | --- | --- |
| `react-native-scripts` | remove | use Expo CLI created app |
| `react-navigation` | replace | `@react-navigation/native` + `@react-navigation/native-stack` |
| `react-native-dotenv` | replace | Expo `.env` with `EXPO_PUBLIC_*` values through `src/config/env.ts` |
| `AsyncStorage` from `react-native` | replace | `@react-native-async-storage/async-storage` |
| `expo` namespace imports like `Constants`, `Permissions`, `Notifications` | replace | split packages such as `expo-constants`; add `expo-notifications` later when push flow is migrated |
| `Expo.Facebook` | replace | modern auth flow later, likely `expo-auth-session` plus backend support |
| `react-native-app-link` | replace | `expo-linking` or React Native `Linking` |
| `pusher-js` | defer | add only when `Game` realtime flow is migrated |
| `react-native-modal` | defer | prefer native `Modal` unless old UX really needs the library |
| `qs` | drop | not used by current source |
| `crypto-js` | defer | add only if backend still requires client-side hashing |

## Safe Migration Order

1. Assets and static data
2. Constants, env wrapper, and storage keys
3. API client and service layer
4. Small presentational components
5. Screens with the least business logic
6. Navigation flow
7. Realtime game flow, push notifications, and deep linking
8. Feature-by-feature verification

## Immediate Next Steps

1. Wire the real API base URL into `.env`
2. Migrate the login and registration service calls into `src/services/api`
3. Rebuild the login flow without `Expo.Facebook`
4. Port `HomeView` as a functional screen on top of the new navigator
5. Add Pusher only when `GameView` is ready to move
