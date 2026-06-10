import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routes } from '../../constants/routes';
import { useFriendNotifications } from '../../context/FriendNotificationProvider';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';

export function FriendRequestBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { banner, clearBanner } = useFriendNotifications();

  if (!banner) return null;

  function openFriends() {
    clearBanner();
    navigation.navigate(routes.Friends);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.safeArea}>
      <View accessibilityLabel={`Friend request from ${banner.senderName}`} style={styles.banner}>
        <MaterialCommunityIcons color={colors.background} name="account-plus" size={20} />
        <View style={styles.copy}>
          <Text style={styles.title}>New friend request</Text>
          <Text numberOfLines={2} style={styles.body}>{banner.senderName} sent you a friend request.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={openFriends} style={styles.action}>
          <Text style={styles.actionText}>View</Text>
        </Pressable>
        <Pressable accessibilityLabel="Dismiss friend request" accessibilityRole="button" hitSlop={10} onPress={clearBanner}>
          <MaterialCommunityIcons color={colors.mutedText} name="close" size={18} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: { borderColor: colors.secondary, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  banner: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.secondary, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, margin: 12, padding: 14 },
  body: { color: colors.mutedText, fontSize: 13 },
  copy: { flex: 1, gap: 2 },
  safeArea: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 30 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
