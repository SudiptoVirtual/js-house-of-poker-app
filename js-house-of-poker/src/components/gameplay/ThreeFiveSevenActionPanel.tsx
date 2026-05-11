import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GameControls } from './GameControls';
import type { PokerAction, PokerControls, PokerPlayerState } from '../../types/poker';

type Props = {
  controls: PokerControls;
  onAction: (action: PokerAction) => void;
  onRebuy: () => void;
  onStartHand: () => void;
  pendingAction?: string | null;
  player: PokerPlayerState | null;
  safeAreaBottom?: number;
  safeAreaHorizontal?: number;
  showDecisionPrompt: boolean;
  statusMessage: string;
};

export function ThreeFiveSevenActionPanel({
  controls,
  onAction,
  onRebuy,
  onStartHand,
  pendingAction = null,
  player,
  safeAreaBottom = 0,
  safeAreaHorizontal = 0,
  showDecisionPrompt,
  statusMessage,
}: Props) {
  const visibleCardCount = Math.max(player?.cardCount ?? player?.cards.length ?? 0, 3);
  const panelStatus = showDecisionPrompt && controls.canAct
    ? 'Choose whether to enter this round.'
    : statusMessage;

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: safeAreaBottom > 0 ? safeAreaBottom + 6 : 4,
          paddingHorizontal: Math.max(8, safeAreaHorizontal + 6),
          paddingTop: 4,
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(31, 8, 49, 0.96)', 'rgba(15, 5, 27, 0.98)', 'rgba(7, 3, 14, 0.96)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.panelShell}
      >
        <View style={styles.profilePill}>
          <Text numberOfLines={1} style={styles.profileEyebrow}>
            YOUR MOVE
          </Text>
          <Text numberOfLines={1} style={styles.profileName}>
            {player?.name ?? 'Player'}
          </Text>
        </View>

        <View style={styles.cardTray}>
          <Text style={styles.cardTrayLabel}>HAND</Text>
          <View style={styles.cardFan} pointerEvents="none">
            {Array.from({ length: Math.min(visibleCardCount, 7) }).map((_, index) => (
              <View
                key={`panel-card-${index}`}
                style={[
                  styles.miniCard,
                  {
                    marginLeft: index === 0 ? 0 : -10,
                    transform: [{ rotate: `${(index - 1) * 4}deg` }],
                  },
                ]}
              >
                <View style={styles.miniCardLine} />
                <View style={[styles.miniCardLine, styles.miniCardLineShort]} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.controlsSlot}>
          <GameControls
            controls={controls}
            layout="leftPanel"
            mode="357"
            onAction={onAction}
            onRebuy={onRebuy}
            onStartHand={onStartHand}
            pendingAction={pendingAction}
            player={player}
            statusMessage={panelStatus}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardFan: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 54,
  },
  cardTray: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(4, 2, 10, 0.5)',
    borderColor: 'rgba(255, 54, 167, 0.28)',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardTrayLabel: {
    color: '#B98AFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  controlsSlot: {
    alignSelf: 'stretch',
    width: '100%',
  },
  miniCard: {
    backgroundColor: '#172944',
    borderColor: 'rgba(107, 221, 255, 0.44)',
    borderRadius: 7,
    borderWidth: 1,
    height: 48,
    justifyContent: 'flex-start',
    paddingHorizontal: 7,
    paddingTop: 9,
    shadowColor: '#45D6FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    width: 36,
  },
  miniCardLine: {
    backgroundColor: 'rgba(205, 239, 255, 0.38)',
    borderRadius: 999,
    height: 3,
    marginBottom: 5,
    width: '100%',
  },
  miniCardLineShort: {
    width: '68%',
  },
  panelShell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(255, 45, 58, 0.78)',
    borderRadius: 2,
    borderWidth: 2,
    gap: 14,
    justifyContent: 'center',
    minHeight: 300,
    paddingHorizontal: 14,
    paddingVertical: 16,
    shadowColor: '#FF2D3A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '100%',
  },
  profileEyebrow: {
    color: '#FF6671',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1,
    maxWidth: '100%',
  },
  profilePill: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(255, 45, 58, 0.9)',
    borderRadius: 999,
    borderWidth: 2,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wrapper: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    minWidth: 240,
    width: '100%',
  },
});
