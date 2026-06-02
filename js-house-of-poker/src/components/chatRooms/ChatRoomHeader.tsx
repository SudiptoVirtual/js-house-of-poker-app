import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type ChatRoomHeaderProps = {
  activePlayerCount: number;
  description: string;
  notificationsEnabled: boolean;
  statusLabel?: string;
  title: string;
};

export function ChatRoomHeader({
  activePlayerCount,
  description,
  notificationsEnabled,
  statusLabel = 'Social room open',
  title,
}: ChatRoomHeaderProps) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons color={colors.secondary} name="chat-processing-outline" size={26} />
        </View>
        <View style={styles.titleGroup}>
          <Text style={styles.eyebrow}>{statusLabel}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <MaterialCommunityIcons color={colors.success} name="account-group" size={16} />
          <Text style={styles.metaText}>{activePlayerCount} active</Text>
        </View>
        <View style={styles.metaPill}>
          <MaterialCommunityIcons
            color={notificationsEnabled ? colors.gold : colors.mutedText}
            name={notificationsEnabled ? 'bell-ring-outline' : 'bell-off-outline'}
            size={16}
          />
          <Text style={styles.metaText}>{notificationsEnabled ? 'Notifications on' : 'Muted'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.secondary,
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  metaPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  titleGroup: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
