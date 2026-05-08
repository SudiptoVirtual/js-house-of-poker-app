import { StyleSheet, Text, View } from 'react-native';

import { GameScoreboard } from '../GameScoreboard';
import { PanelShell } from './PanelShell';

type SettingRow = {
  label: string;
  value: string;
};

type Props = {
  activePlayers: number;
  bigBlind: number;
  currentSpeaker?: string | null;
  gameSettings: SettingRow[];
  handNumber: number;
  onLeave: () => void;
  phaseTitle: string;
  playersLabel: string;
  pot: number;
  roomId: string;
  smallBlind: number;
  statusText: string;
  tableDetails: SettingRow[];
  totalPlayers: number;
};

function DetailRow({ label, value }: SettingRow) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

export function TableInfoPanel({
  activePlayers,
  bigBlind,
  currentSpeaker,
  gameSettings,
  handNumber,
  onLeave,
  phaseTitle,
  playersLabel,
  pot,
  roomId,
  smallBlind,
  statusText,
  tableDetails,
  totalPlayers,
}: Props) {
  return (
    <PanelShell eyebrow="Right Rail" title="Table Info">
      <GameScoreboard
        activePlayers={activePlayers}
        bigBlind={bigBlind}
        currentSpeaker={currentSpeaker}
        handNumber={handNumber}
        onLeave={onLeave}
        phaseTitle={phaseTitle}
        playersLabel={playersLabel}
        pot={pot}
        roomId={roomId}
        smallBlind={smallBlind}
        statusText={statusText}
        totalPlayers={totalPlayers}
        variant="embedded"
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Table Status</Text>
        <View style={styles.detailStack}>
          {tableDetails.map((detail) => (
            <DetailRow key={detail.label} {...detail} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Settings</Text>
        <View style={styles.detailStack}>
          {gameSettings.map((detail) => (
            <DetailRow key={detail.label} {...detail} />
          ))}
        </View>
        <Text style={styles.footnote}>
          Settings are display-only in this shell. Later prompts can replace these placeholders
          with host controls and realtime sync.
        </Text>
      </View>
    </PanelShell>
  );
}

const styles = StyleSheet.create({
  detailLabel: {
    color: 'rgba(231,245,240,0.58)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  detailStack: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailValue: {
    color: '#F4FBF7',
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  footnote: {
    color: 'rgba(231,245,240,0.66)',
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#8BD7B7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
