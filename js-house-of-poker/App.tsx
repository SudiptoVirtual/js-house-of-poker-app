import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthProvider';
import { ChatNotificationProvider } from './src/context/ChatNotificationProvider';
import { FeedNotificationProvider } from './src/context/FeedNotificationProvider';
import { FriendNotificationProvider } from './src/context/FriendNotificationProvider';
import { NotificationCenterProvider } from './src/context/NotificationCenterProvider';
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
                <NotificationCenterProvider>
                  <RootNavigator />
                </NotificationCenterProvider>
              </ChatNotificationProvider>
            </FriendNotificationProvider>
          </FeedNotificationProvider>
        </PokerProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
