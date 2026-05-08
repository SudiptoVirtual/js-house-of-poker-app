import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { currentPlayerProfile } from '../constants/social';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  return (
    <Screen
      eyebrow="Player profile"
      title={currentPlayerProfile.name}
      subtitle={`${currentPlayerProfile.handle} | ${currentPlayerProfile.socialLine}`}
    >
      <SectionCard title="Player card">
        <Text style={styles.metaLine}>Favorite game: {currentPlayerProfile.favoriteGame}</Text>
        <View style={styles.statRow}>
          {currentPlayerProfile.stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Shared invite flow">
        <Text style={styles.bodyText}>
          {activeTableCode
            ? `Your active table is ${activeTableCode}. Friend, feed, and username invites route back through the same in-table invite rail.`
            : 'Create or join a table first, then send invites from friends, posts, or the player directory through the shared table invite flow.'}
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? 'Open active table' : 'Open lobby'}
          onPress={() =>
            navigation.navigate(activeTableCode ? routes.Game : routes.Home)
          }
          tone="primary"
        />
      </SectionCard>

      <SectionCard title="Social routes">
        <View style={styles.actionStack}>
          <ActionButton
            fullWidth
            icon="account-multiple-outline"
            label="Friends"
            onPress={() => navigation.navigate(routes.Friends)}
            variant="secondary"
          />
          <ActionButton
            fullWidth
            icon="post-outline"
            label="Feed"
            onPress={() => navigation.navigate(routes.Feed)}
            variant="secondary"
          />
          <ActionButton
            fullWidth
            icon="account-search-outline"
            label="Player directory"
            onPress={() => navigation.navigate(routes.PlayerDirectory)}
            variant="secondary"
          />
        </View>
      </SectionCard>

      <ComplianceNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionStack: {
    gap: 10,
  },
  bodyText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  metaLine: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  statCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 90,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
