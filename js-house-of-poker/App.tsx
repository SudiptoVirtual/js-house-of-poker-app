import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthProvider';
import { ChatNotificationProvider } from './src/context/ChatNotificationProvider';
import { FeedNotificationProvider } from './src/context/FeedNotificationProvider';
import { FriendNotificationProvider } from './src/context/FriendNotificationProvider';
import { PokerProvider } from './src/context/PokerProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PokerProvider>
          <FeedNotificationProvider>
            <FriendNotificationProvider>
              <ChatNotificationProvider>
                <RootNavigator />
              </ChatNotificationProvider>
            </FriendNotificationProvider>
          </FeedNotificationProvider>
        </PokerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
