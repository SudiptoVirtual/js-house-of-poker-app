import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routes } from '../../constants/routes';
import { useChatNotifications } from '../../context/ChatNotificationProvider';
import type { RootStackParamList } from '../../types/navigation';

import { borders, colors, componentSpacing, radii, spacing } from '../../theme';
export function ChatNotificationBanner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { banner, clearBanner, queueLength } = useChatNotifications();

  if (!banner) return null;

  const isInvite = banner.type === 'chat_room_invite';
  const title = isInvite ? 'Chat room invitation' : `New message from ${banner.senderName}`;
  const body = isInvite
    ? `${banner.senderName} invited you to ${banner.roomName}.`
    : banner.body;

  function openRoom() {
    if (!banner) return;
    const roomId = banner.roomId;
    clearBanner();
    navigation.navigate(routes.ChatRoomDetail, { roomId });
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} pointerEvents="box-none" style={styles.safeArea}>
      <View accessibilityLabel={`${title}: ${body}`} style={styles.banner}>
        <MaterialCommunityIcons color={colors.background} name={isInvite ? 'account-multiple-plus' : 'message-text'} size={20} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text numberOfLines={2} style={styles.body}>{body}</Text>
          {queueLength > 1 ? <Text style={styles.queued}>{queueLength - 1} more waiting</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={openRoom} style={styles.action}>
          <Text style={styles.actionText}>Open</Text>
        </Pressable>
        <Pressable accessibilityLabel="Dismiss chat notification" accessibilityRole="button" hitSlop={10} onPress={clearBanner}>
          <MaterialCommunityIcons color={colors.mutedText} name="close" size={18} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: { ...borders.cyan, borderRadius: radii.pill, paddingHorizontal: spacing[12], paddingVertical: 7 },
  actionText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  banner: { ...borders.cyan, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, flexDirection: 'row', gap: componentSpacing.banner.gap, margin: componentSpacing.banner.margin, padding: componentSpacing.banner.padding },
  body: { color: colors.mutedText, fontSize: 13 },
  copy: { flex: 1, gap: spacing[2] },
  queued: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  safeArea: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 40 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
