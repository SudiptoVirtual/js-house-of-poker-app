import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../ActionButton';
import { PlayerAvatar } from '../PlayerAvatar';
import { PlayerMetaBadge } from './PlayerMetaBadge';
import type { PokerPlayerStatus } from '../../types/poker';

import { colors } from '../../theme/colors';

type PlayerIdentityAction = {
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'neutral' | 'primary' | 'success';
  variant?: 'primary' | 'secondary';
};

type PlayerIdentityBadge = {
  label: string;
  tone?: 'danger' | 'gold' | 'muted' | 'primary' | 'success' | 'violet';
};

type PlayerIdentityStat = {
  label: string;
  value: string;
};

type PlayerIdentityCardProps = {
  actions?: PlayerIdentityAction[];
  avatar?: string;
  badges?: PlayerIdentityBadge[];
  children?: ReactNode;
  chipsLabel?: string;
  connected?: boolean;
  displayName: string;
  meta?: string;
  onPress?: () => void;
  seed: string;
  size?: 'lg' | 'md' | 'sm';
  stats?: PlayerIdentityStat[];
  status?: PokerPlayerStatus;
  style?: StyleProp<ViewStyle>;
  username?: string;
};

export function PlayerIdentityCard({
  actions = [],
  avatar,
  badges = [],
  children,
  chipsLabel,
  connected = false,
  displayName,
  meta,
  onPress,
  seed,
  size = 'md',
  stats = [],
  status,
  style,
  username,
}: PlayerIdentityCardProps) {
  const ContentWrapper = onPress ? Pressable : View;

  return (
    <View style={[styles.card, style]}>
      <ContentWrapper accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.identityRow}>
        <PlayerAvatar avatar={avatar} connected={connected} name={displayName} seed={seed} size={size} status={status} />
        <View style={styles.identityText}>
          <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
          {username ? <Text numberOfLines={1} style={styles.username}>{username.startsWith('@') ? username : `@${username}`}</Text> : null}
          {chipsLabel ? <Text numberOfLines={1} style={styles.metaLine}>{chipsLabel}</Text> : null}
          {meta ? <Text numberOfLines={2} style={styles.metaLine}>{meta}</Text> : null}
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((badge) => <PlayerMetaBadge key={`${badge.label}-${badge.tone}`} label={badge.label} tone={badge.tone} />)}
            </View>
          ) : null}
        </View>
      </ContentWrapper>

      {children}

      {stats.length > 0 ? (
        <View style={styles.statRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {actions.length > 0 ? (
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <ActionButton key={action.label} compact disabled={action.disabled} fullWidth icon={action.icon} label={action.label} loading={action.loading} onPress={action.onPress} tone={action.tone} variant={action.variant} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  card: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 12, padding: 14 },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  identityText: { flex: 1, gap: 5, minWidth: 0 },
  metaLine: { color: colors.mutedText, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  statCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flex: 1, minWidth: 86, padding: 10 },
  statLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 3, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  username: { color: colors.secondary, fontSize: 13, fontWeight: '800' },
});
