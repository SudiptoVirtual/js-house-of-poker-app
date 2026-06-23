import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MainPlatformNavigation } from '../navigation/MainPlatformNavigation';
import { useNotificationCenter } from '../../context/NotificationCenterProvider';
import { getNotificationNavigationTarget, getNotificationPresentation, type NotificationRecord } from '../../services/notifications/notificationCenterService';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../types/navigation';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function NotificationItem({ notification, onPress }: { notification: NotificationRecord; onPress: () => void }) {
  const presentation = getNotificationPresentation(notification.type);
  const unread = !notification.readAt;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, unread ? styles.unreadItem : null, pressed ? styles.pressed : null]}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons color={colors.gold} name={presentation.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemHeader}>
          <Text style={styles.label}>{presentation.label}</Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.title}>{notification.title || presentation.label}</Text>
        <Text numberOfLines={2} style={styles.body}>{notification.body}</Text>
      </View>
    </Pressable>
  );
}

export function NotificationCenterScreen() {
  const navigation = useNavigation<Navigation>();
  const { isLoading, markAllAsRead, notifications, refreshNotifications, unreadCount } = useNotificationCenter();

  function openNotification(notification: NotificationRecord) {
    const target = getNotificationNavigationTarget(notification);
    switch (target.route) {
      case 'Feed':
        navigation.navigate(target.route, target.params);
        break;
      case 'ChatRoomDetail':
        navigation.navigate(target.route, target.params);
        break;
      case 'Game':
        navigation.navigate(target.route, target.params);
        break;
      case 'UserProfile':
        navigation.navigate(target.route, target.params);
        break;
      case 'Friends':
      case 'Home':
        navigation.navigate(target.route);
        break;
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Notification Center</Text>
          <Text style={styles.heading}>Recent activity</Text>
        </View>
        <Pressable accessibilityLabel="Mark all notifications as read" disabled={unreadCount === 0} onPress={markAllAsRead} style={[styles.markReadButton, unreadCount === 0 ? styles.disabledButton : null]}>
          <Text style={styles.markReadText}>Mark all as read</Text>
        </Pressable>
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refreshNotifications} tintColor={colors.gold} />}
        renderItem={({ item }) => <NotificationItem notification={item} onPress={() => openNotification(item)} />}
      />
      <MainPlatformNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  disabledButton: { opacity: 0.45 },
  emptyText: { color: colors.mutedText, fontSize: 15, padding: 24, textAlign: 'center' },
  eyebrow: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  heading: { color: colors.text, fontSize: 28, fontWeight: '900' },
  iconCircle: { alignItems: 'center', backgroundColor: colors.goldTint, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  item: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, marginBottom: 12, padding: 14 },
  itemBody: { flex: 1, gap: 4 },
  itemHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  listContent: { padding: 18, paddingTop: 0 },
  markReadButton: { backgroundColor: colors.goldTint, borderColor: colors.gold, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  markReadText: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  screen: { backgroundColor: colors.background, flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  unreadDot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  unreadItem: { borderColor: colors.gold },
});
