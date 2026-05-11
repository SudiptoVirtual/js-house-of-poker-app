import { StyleSheet, View } from 'react-native';

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
      <GameControls
        controls={controls}
        layout="leftPanel"
        mode="357"
        onAction={onAction}
        onRebuy={onRebuy}
        onStartHand={onStartHand}
        pendingAction={pendingAction}
        player={player}
        statusMessage={
          showDecisionPrompt && controls.canAct
            ? 'Choose whether to enter this round.'
            : statusMessage
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    maxWidth: 440,
    minWidth: 300,
    width: '100%',
  },
});
