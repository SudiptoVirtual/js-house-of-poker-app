import { StyleSheet, View } from 'react-native';
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
  controlsSlot: {
    alignSelf: 'stretch',
    width: '100%',
  },
  panelShell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(186, 53, 255, 0.52)',
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 224,
    paddingHorizontal: 12,
    paddingVertical: 14,
    shadowColor: '#B934FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    width: '100%',
  },
  wrapper: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
    maxWidth: 260,
    minWidth: 190,
    width: '100%',
  },
});
