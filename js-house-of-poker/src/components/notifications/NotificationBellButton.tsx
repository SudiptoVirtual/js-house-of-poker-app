import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotificationCenter } from '../../context/NotificationCenterProvider';
import { colors } from '../../theme/colors';

type NotificationBellButtonProps = {
  onPress: () => void;
};

function formatBadgeCount(count: number) {
  return count > 9 ? '9+' : count.toString();
}

export function NotificationBellButton({ onPress }: NotificationBellButtonProps) {
  const { unreadCount } = useNotificationCenter();

  return (
    <Pressable
      accessibilityLabel="Open notifications"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <MaterialCommunityIcons color={colors.gold} name="bell-outline" size={19} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatBadgeCount(unreadCount)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.white,
    borderRadius: colors.radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
    position: 'absolute',
    right: -7,
    top: -7,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 13,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.glassPanel,
    borderColor: colors.border,
    borderRadius: colors.radii.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
