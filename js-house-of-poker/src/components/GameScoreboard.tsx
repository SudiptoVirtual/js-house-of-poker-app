import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type GameScoreboardProps = {
  activePlayers: number;
  bigBlind: number;
  currentSpeaker?: string | null;
  handNumber: number;
  onLeave: () => void;
  phaseTitle: string;
  playersLabel: string;
  pot: number;
  roomId: string;
  smallBlind: number;
  statItems?: StatCardProps[];
  statusText: string;
  totalPlayers: number;
  variant?: 'embedded' | 'standalone';
};

type StatCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <MaterialCommunityIcons color="#A6F4D6" name={icon} size={16} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

export const GameScoreboard = memo(function GameScoreboard({
  activePlayers,
  bigBlind,
  currentSpeaker,
  handNumber,
  onLeave,
  phaseTitle,
  playersLabel,
  pot,
  roomId,
  smallBlind,
  statusText,
  totalPlayers,
  variant = 'standalone',
  statItems,
}: GameScoreboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const resolvedStatItems =
    statItems ??
    [
      {
        icon: 'cash-multiple',
        label: 'Pot',
        value: pot.toLocaleString('en-US'),
      },
      {
        icon: 'cards-playing-outline',
        label: 'Blinds',
        value: `${smallBlind} / ${bigBlind}`,
      },
      {
        icon: 'account-group-outline',
        label: 'Live Seats',
        value: `${activePlayers} in / ${totalPlayers}`,
      },
      {
        icon: 'account-voice',
        label: 'Turn',
        value: currentSpeaker ?? playersLabel,
      },
    ];
  const contentNode = (
    <>
      <View style={styles.topRow}>
        <Pressable onPress={onLeave} style={styles.leaveButton}>
          <MaterialCommunityIcons color="#F8E1C0" name="door-open" size={12} />
          <Text style={styles.leaveLabel}>Leave</Text>
        </Pressable>

        <View style={styles.identityBlock}>
          <View style={styles.roomPill}>
            <Text style={styles.roomLabel}>Room: {roomId}</Text>
          </View>
          <Text style={styles.phaseTitle}>{phaseTitle}</Text>
          <Text numberOfLines={2} style={styles.statusText}>
            {statusText}
          </Text>
        </View>
      </View>

      {isExpanded ? (
        <>
          <View style={styles.statsGrid}>
            {resolvedStatItems.map((item) => (
              <StatCard key={`${item.label}-${item.value}`} {...item} />
            ))}
          </View>

          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            intensity={18}
            tint="dark"
            style={styles.footerStrip}
          >
            <View style={styles.footerMeta}>
              <Text style={styles.footerKicker}>Hand #{handNumber}</Text>
              <Text style={styles.footerDivider}>|</Text>
              <Text style={styles.footerValue}>{playersLabel}</Text>
            </View>
          </BlurView>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsExpanded((previous) => !previous)}
        style={styles.collapseToggle}
      >
        <Text style={styles.collapseToggleText}>
          {isExpanded ? 'Hide table details' : 'Show table details'}
        </Text>
        <MaterialCommunityIcons
          color="rgba(227,244,238,0.72)"
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
        />
      </Pressable>
    </>
  );

  if (variant === 'embedded') {
    return <View style={[styles.wrapper, styles.wrapperEmbedded]}>{contentNode}</View>;
  }

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(15,28,32,0.94)', 'rgba(7,14,17,0.96)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.shell}
      >
        {contentNode}
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  collapseToggle: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  collapseToggleText: {
    color: 'rgba(227,244,238,0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  footerDivider: {
    color: 'rgba(238,248,244,0.38)',
    fontSize: 12,
    fontWeight: '900',
  },
  footerKicker: {
    color: '#F7E7B9',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  footerMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerStrip: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerValue: {
    color: '#E8F8F1',
    fontSize: 11,
    fontWeight: '700',
  },
  identityBlock: {
    flex: 1,
    minWidth: 85,
  },
  leaveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,188,128,0.12)',
    borderColor: 'rgba(245,188,128,0.24)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leaveLabel: {
    color: '#FDE5C7',
    fontSize: 12,
    fontWeight: '800',
  },
  phaseTitle: {
    color: '#F5FBF7',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  roomLabel: {
    color: '#9BEED0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  roomPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(76,228,174,0.12)',
    borderColor: 'rgba(76,228,174,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shell: {
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(71,206,164,0.12)',
    borderRadius: 999,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  statLabel: {
    color: 'rgba(227,244,238,0.58)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#F5FBF8',
    fontSize: 15,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusText: {
    color: 'rgba(227,244,238,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 12,
    justifyContent: 'space-between',
  },
  wrapper: {
    width: '100%',
  },
  wrapperEmbedded: {
    gap: 14,
  },
});
