import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GameControls } from './GameControls';
import type { PokerAction, PokerControls, PokerPlayerState } from '../../types/poker';

const PANEL_SHELL_MIN_HEIGHT = 224;
const FIT_CONTENT_PANEL_HEIGHT_RATIO = 0.85;
const INFO_ONLY_PANEL_MAX_WIDTH = 182;

type ThreeFiveSevenActionPanelLayout = 'leftPanel' | 'rightPanel';

type Props = {
  controls: PokerControls;
  fitContent?: boolean;
  layout?: ThreeFiveSevenActionPanelLayout;
  onAction: (action: PokerAction) => void;
  onRebuy: () => void;
  onStartHand: () => void;
  pendingAction?: string | null;
  player: PokerPlayerState | null;
  safeAreaBottom?: number;
  safeAreaHorizontal?: number;
  showActionButtons?: boolean;
  showDecisionPrompt: boolean;
  statusMessage: string;
};

export function ThreeFiveSevenActionPanel({
  controls,
  fitContent = false,
  layout = 'leftPanel',
  onAction,
  onRebuy,
  onStartHand,
  pendingAction = null,
  player,
  safeAreaBottom = 0,
  safeAreaHorizontal = 0,
  showActionButtons = true,
  showDecisionPrompt,
  statusMessage,
}: Props) {
  const isRightPanel = layout === 'rightPanel';
  const isInfoOnly = !showActionButtons;
  const panelStatus = showDecisionPrompt && controls.canAct
    ? 'Choose whether to enter this round.'
    : statusMessage;

  return (
    <View
      style={[
        styles.wrapper,
        isRightPanel ? styles.wrapperRightPanel : null,
        isInfoOnly ? styles.wrapperInfoOnly : null,
        fitContent ? null : styles.wrapperFill,
        {
          paddingBottom: safeAreaBottom > 0 ? safeAreaBottom + 6 : 4,
          paddingHorizontal: Math.max(8, safeAreaHorizontal + 6),
          paddingTop: 4,
        },
      ]}
    >
      <LinearGradient
        colors={
          isRightPanel
            ? ['transparent', 'transparent']
            : ['rgba(31, 8, 49, 0.96)', 'rgba(15, 5, 27, 0.98)', 'rgba(7, 3, 14, 0.96)']
        }
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.panelShell,
          isRightPanel ? styles.panelShellRightPanel : null,
          isInfoOnly ? styles.panelShellInfoOnly : null,
          fitContent && !isInfoOnly ? styles.panelShellFitContent : null,
        ]}
      >
        <View style={styles.controlsSlot}>
          <GameControls
            controls={controls}
            layout={layout}
            mode="357"
            onAction={onAction}
            onRebuy={onRebuy}
            onStartHand={onStartHand}
            pendingAction={pendingAction}
            player={player}
            statusMessage={panelStatus}
            showActionButtons={showActionButtons}
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
    minHeight: PANEL_SHELL_MIN_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 14,
    shadowColor: '#B934FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    width: '100%',
  },
  panelShellFitContent: {
    minHeight: PANEL_SHELL_MIN_HEIGHT * FIT_CONTENT_PANEL_HEIGHT_RATIO,
  },
  panelShellRightPanel: {
    borderWidth: 0,
    borderRadius: 18,
    minHeight: 136,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowOpacity: 0,
  },
  panelShellInfoOnly: {
    minHeight: 96,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  wrapper: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    justifyContent: 'center',
    maxWidth: 260,
    minWidth: 190,
    width: '100%',
  },
  wrapperFill: {
    flex: 1,
  },
  wrapperInfoOnly: {
    maxWidth: INFO_ONLY_PANEL_MAX_WIDTH,
    minWidth: 0,
  },
  wrapperRightPanel: {
    maxWidth: 96,
    minWidth: 78,
  },
});
