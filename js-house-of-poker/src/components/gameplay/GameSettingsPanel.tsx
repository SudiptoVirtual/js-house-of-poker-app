import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PokerGameSettingsUpdate, PokerRoomState } from '../../types/poker';
import { PanelShell } from './PanelShell';

type Props = {
  onLeave: () => void;
  onUpdateGameSettings: (update: PokerGameSettingsUpdate) => void;
  phaseTitle: string;
  playersLabel: string;
  roomState: PokerRoomState;
  statusText: string;
};

function formatGameLabel(value: PokerRoomState['gameSettings']['game']) {
  switch (value) {
    case '357':
      return '357';
    case 'holdem':
      return "Hold'em";
    case 'shanghai':
      return 'Shanghai';
    case 'in-between-the-sheets':
      return 'In-Between the Sheets';
    case '7-27':
      return '7/27';
    default:
      return value;
  }
}

function formatModeLabel(value: PokerRoomState['gameSettings']['mode']) {
  switch (value) {
    case 'high-only':
      return 'High Only';
    case 'high-low':
      return 'High / Low';
    case 'low-only':
      return 'Low Only';
    case 'BEST_FIVE':
      return 'Best Five';
    case 'HOSTEST':
      return 'Hostest';
    default:
      return value;
  }
}

function formatLowRule(value: PokerRoomState['gameSettings']['lowRule']) {
  switch (value) {
    case '8-or-better':
      return '8 or Less';
    case 'wheel':
      return 'Wheel';
    case 'any-low':
      return 'Any Low';
    default:
      return value;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function InfoCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

export function GameSettingsPanel({
  onLeave,
  roomState,
  phaseTitle,
  playersLabel,
  statusText,
}: Props) {
  const is357 = roomState.gameSettings.game === '357' && Boolean(roomState.threeFiveSeven);
  const wildsLabel = is357
    ? roomState.threeFiveSeven?.activeWildDefinition.wildRanks.length
      ? roomState.threeFiveSeven.activeWildDefinition.wildRanks.join(', ')
      : roomState.threeFiveSeven?.activeWildDefinition.label ?? 'None'
    : roomState.gameSettings.wildCards.length > 0
      ? roomState.gameSettings.wildCards.join(', ')
      : 'None';

  if (is357) {
    return (
      <View style={styles.stack}>
        <PanelShell eyebrow="Right Rail" title="How It Works">
          <View style={styles.copyStack}>
            <Text style={styles.copyTitle}>GO</Text>
            <Text style={styles.copyBody}>Enter the round and risk it all.</Text>

            <Text style={styles.copyTitle}>STAY</Text>
            <Text style={styles.copyBody}>Sit this round out and keep your chips.</Text>

            <Text style={styles.copyTitle}>MULTIPLE PLAYERS GO</Text>
            <Text style={styles.copyBody}>
              Best hand wins. Losing GO players feed the winner side and the pot.
            </Text>

            <Text style={styles.copyTitle}>SOLO GO</Text>
            <Text style={styles.copyBody}>Win the pot and earn one leg.</Text>

            <Text style={styles.copyTitle}>FIRST TO 4 LEGS</Text>
            <Text style={styles.copyBody}>Wins the pot.</Text>
          </View>
        </PanelShell>

        <InfoCard title="Current Ante">
          <Text style={styles.featureValue}>${roomState.threeFiveSeven?.anteAmount ?? 0}</Text>
          <Text style={styles.featureCopy}>Charged each time the deck is shuffled.</Text>
        </InfoCard>

        <InfoCard title="Round Wilds">
          <Text style={styles.featureValueAccent}>
            {wildsLabel.toUpperCase()}
          </Text>
          <Text style={styles.featureCopy}>{phaseTitle}</Text>
        </InfoCard>
      </View>
    );
  }

  return (
    <PanelShell eyebrow="Right Rail" title="Table Info">
      <View style={styles.infoCard}>
        <View style={styles.cardContent}>
          <DetailRow label="Game" value={formatGameLabel(roomState.gameSettings.game)} />
          <DetailRow label="Mode" value={formatModeLabel(roomState.gameSettings.mode)} />
          <DetailRow label="Low Qualifier" value={formatLowRule(roomState.gameSettings.lowRule)} />
          <DetailRow label="Wild Cards" value={wildsLabel} />
          <DetailRow
            label="Max Bet"
            value={
              roomState.controls.maxRaiseTo > 0
                ? `${roomState.controls.maxRaiseTo.toLocaleString('en-US')}`
                : 'Table pending'
            }
          />
        </View>
      </View>

      <InfoCard title="Game Info">
        <DetailRow label="Phase" value={phaseTitle} />
        <DetailRow label="Players" value={playersLabel} />
        <DetailRow label="Pot" value={roomState.pot.toLocaleString('en-US')} />
        <Text style={styles.featureCopy}>{statusText}</Text>
      </InfoCard>

      <Pressable accessibilityRole="button" onPress={onLeave} style={styles.leaveButton}>
        <Text style={styles.leaveButtonText}>LEAVE TABLE</Text>
      </Pressable>
    </PanelShell>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    gap: 8,
  },
  cardTitle: {
    color: '#B35CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  copyBody: {
    color: '#EEE8FF',
    fontSize: 12,
    lineHeight: 17,
  },
  copyStack: {
    gap: 8,
  },
  copyTitle: {
    color: '#67F3BB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  featureCopy: {
    color: 'rgba(239, 235, 255, 0.62)',
    fontSize: 12,
    lineHeight: 18,
  },
  featureValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  featureValueAccent: {
    color: '#FF5ABF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  leaveButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(63, 8, 16, 0.98)',
    borderColor: 'rgba(255, 73, 93, 0.36)',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 58,
  },
  leaveButtonText: {
    color: '#FF5E73',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  stack: {
    gap: 10,
  },
});
