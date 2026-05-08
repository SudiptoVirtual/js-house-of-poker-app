import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  latencyLabel: string;
  serverTimeLabel: string;
  transportStatus: 'connected' | 'connecting' | 'disconnected' | 'error' | 'idle' | 'reconnecting';
};

function getConnectionColor(status: Props['transportStatus']) {
  switch (status) {
    case 'connected':
      return '#67F3BB';
    case 'connecting':
    case 'reconnecting':
      return '#FFCB6B';
    case 'error':
    case 'disconnected':
      return '#FF5E73';
    case 'idle':
    default:
      return '#A6A2C2';
  }
}

export function GameplayFooter({
  latencyLabel,
  serverTimeLabel,
  transportStatus,
}: Props) {
  const { height, width } = useWindowDimensions();
  const color = getConnectionColor(transportStatus);
  const isCompact = width < 620 && height > width;

  return (
    <View style={[styles.shell, isCompact ? styles.shellCompact : null]}>
      <View style={styles.leftRail}>
        <MaterialCommunityIcons color="#8B5CFF" name="cards-spade" size={16} />
        <Text style={styles.brandText}>JSHOUSEOFPOKER.COM</Text>
      </View>

      <Text style={[styles.centerText, isCompact ? styles.centerTextCompact : null]}>
        GOOD LUCK, PLAY SMART, HAVE FUN!
      </Text>

      <View style={[styles.rightRail, isCompact ? styles.rightRailCompact : null]}>
        <Text style={styles.metaText}>SERVER TIME: {serverTimeLabel}</Text>
        <View style={styles.connectionWrap}>
          <MaterialCommunityIcons color={color} name="wifi" size={18} />
          <Text style={[styles.connectionText, { color }]}>{latencyLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandText: {
    color: '#8B5CFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  centerText: {
    color: '#B35CFF',
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerTextCompact: {
    flex: 0,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '900',
  },
  connectionWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  leftRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  metaText: {
    color: 'rgba(239, 235, 255, 0.72)',
    fontSize: 11,
    fontWeight: '700',
  },
  rightRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  rightRailCompact: {
    gap: 10,
  },
  shell: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: '100%',
  },
  shellCompact: {
    flexDirection: 'column',
    gap: 8,
  },
});
