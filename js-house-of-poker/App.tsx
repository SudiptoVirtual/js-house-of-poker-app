import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PokerProvider } from './src/context/PokerProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <PokerProvider>
        <RootNavigator />
      </PokerProvider>
    </SafeAreaProvider>
  );
}
