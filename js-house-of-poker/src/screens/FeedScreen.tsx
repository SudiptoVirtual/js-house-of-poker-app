import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlayerFeedScreen } from '../components/feed/PlayerFeedScreen';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

export function FeedScreen({ navigation, route }: Props) {
  return <PlayerFeedScreen navigation={navigation} route={route} />;
}
