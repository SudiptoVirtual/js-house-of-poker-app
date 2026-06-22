import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlayerFeedScreen } from '../components/feed/PlayerFeedScreen';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyFeed'>;

export function MyFeedScreen({ navigation, route }: Props) {
  return (
    <View style={styles.root}>
      <PlayerFeedScreen mode="profile-history" navigation={navigation} route={route} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
