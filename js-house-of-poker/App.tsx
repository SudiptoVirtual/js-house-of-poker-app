import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthProvider';
import { PokerProvider } from './src/context/PokerProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PokerProvider>
          <RootNavigator />
        </PokerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
