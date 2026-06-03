import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { FeedAvatar } from './FeedAvatar';
import { PlayerStatusBadge } from './PlayerStatusBadge';
import type { FeedPlayer } from './types';

type FeedPlayerHeaderProps = {
  isPromoted?: boolean;
  onOpenProfile: (player: FeedPlayer) => void;
  player: FeedPlayer;
  timestampLabel: string;
};

export function FeedPlayerHeader({ isPromoted = false, onOpenProfile, player, timestampLabel }: FeedPlayerHeaderProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={`Open ${player.name} profile`}
        accessibilityRole="button"
        onPress={() => onOpenProfile(player)}
      >
        <FeedAvatar initials={player.avatarInitials} uri={player.avatarUri} />
      </Pressable>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Pressable
            accessibilityLabel={`Open ${player.name} profile`}
            accessibilityRole="button"
            onPress={() => onOpenProfile(player)}
            style={styles.nameButton}
          >
            <Text numberOfLines={1} style={styles.name}>
              {player.name}
            </Text>
          </Pressable>
          <Text style={styles.timestamp}>· {timestampLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.handle}>
            {player.handle}
          </Text>
          {isPromoted ? (
            <View style={styles.promotedBadge}>
              <MaterialCommunityIcons color={colors.gold} name="bullhorn-outline" size={12} />
              <Text style={styles.promotedLabel}>Sponsored</Text>
            </View>
          ) : null}
        </View>
        <PlayerStatusBadge status={player.status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 11,
  },
  handle: {
    color: colors.mutedText,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  nameButton: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minWidth: 0,
  },
  promotedBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,201,94,0.12)',
    borderColor: 'rgba(255,201,94,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promotedLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timestamp: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
});
