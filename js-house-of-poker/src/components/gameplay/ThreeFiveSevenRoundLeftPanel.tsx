import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PokerRoomState } from '../../types/poker';
import { PanelShell } from './PanelShell';

type Props = {
  onQuickEmote?: (message: string) => void;
  roomState: PokerRoomState;
};

const QUICK_EMOTES = ['😀', '😎', '💯', '🔥', '☘️'];

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function LegsDots({ count }: { count: number }) {
  return (
    <View style={styles.legsRow}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={`tracker-leg-${index}`} style={[styles.legDot, index < count ? styles.legDotFilled : null]} />
      ))}
    </View>
  );
}

export function ThreeFiveSevenRoundLeftPanel({ onQuickEmote, roomState }: Props) {
  const variantState = roomState.threeFiveSeven;
  const wildsLabel =
    variantState?.activeWildDefinition.wildRanks.length
      ? variantState.activeWildDefinition.wildRanks.join(', ')
      : variantState?.activeWildDefinition.label ?? 'None';
  const penaltyPot = variantState?.lastResolution?.potPenaltyTotal ?? 0;
  const antePot = Math.max(0, roomState.pot - penaltyPot);

  return (
    <View style={styles.stack}>
      <PanelShell eyebrow="Left Rail" title="Game Info">
        <View style={styles.card}>
          <DetailRow label="Game" value="357" />
          <DetailRow label="Mode" value={variantState?.mode === 'BEST_FIVE' ? 'Best Five' : 'Hostest with the Mostest'} />
          <DetailRow label="Wilds (This Round)" value={wildsLabel} />
          <DetailRow label="Board" value="No Board" />
          <DetailRow label="Format" value="GO / STAY Only" />
        </View>
      </PanelShell>

      <PanelShell eyebrow="Pot" title="Pot Info">
        <View style={styles.card}>
          <DetailRow label="Pot" value={`$${roomState.pot.toLocaleString('en-US')}`} />
          <DetailRow label="From Antes" value={`$${antePot.toLocaleString('en-US')}`} />
          <DetailRow label="From Penalties" value={`$${penaltyPot.toLocaleString('en-US')}`} />
        </View>
      </PanelShell>

      <PanelShell eyebrow="Tracker" title="Leg Tracker">
        <View style={styles.legTrackerList}>
          {roomState.players.map((player) => (
            <View key={player.id} style={styles.trackerRow}>
              <Text style={styles.trackerName}>{player.name}</Text>
              <LegsDots count={player.legs} />
            </View>
          ))}
        </View>
        <Text style={styles.footerText}>4 legs to win</Text>
      </PanelShell>

      <PanelShell title="Quick Emotes">
        <View style={styles.emoteRail}>
          {QUICK_EMOTES.map((emote) => (
            <Pressable
              key={emote}
              accessibilityRole="button"
              onPress={() => onQuickEmote?.(emote)}
              style={styles.emoteButton}
            >
              <Text style={styles.emoteText}>{emote}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => onQuickEmote?.('Nice hand.')}
            style={styles.moreButton}
          >
            <Text style={styles.moreButtonText}>...</Text>
          </Pressable>
        </View>
      </PanelShell>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailLabel: {
    color: 'rgba(239, 235, 255, 0.58)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailValue: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  footerText: {
    color: '#FF5ABF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  emoteButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emoteRail: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emoteText: {
    fontSize: 22,
  },
  legDot: {
    backgroundColor: 'rgba(255, 90, 191, 0.14)',
    borderColor: 'rgba(255, 90, 191, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 14,
    width: 14,
  },
  legDotFilled: {
    backgroundColor: '#FF5ABF',
    borderColor: '#FFC7E5',
  },
  legTrackerList: {
    gap: 7,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stack: {
    gap: 10,
  },
  moreButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  moreButtonText: {
    color: '#EEE8FF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: -8,
  },
  trackerName: {
    color: '#EEE8FF',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  trackerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
