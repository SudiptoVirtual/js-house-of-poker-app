import { StyleSheet, View } from 'react-native';

import { GameControls } from './GameControls';
import type { PokerAction, PokerControls, PokerPhase, PokerPlayerState } from '../../types/poker';
import { isLiveHand } from '../../utils/pokerTable';

type Props = {
  barMode?: boolean;
  compact?: boolean;
  controls: PokerControls;
  currentBet: number;
  onAction: (action: PokerAction) => void;
  onRaiseChange: (value: string) => void;
  onRaiseSubmit: () => void;
  onRebuy: () => void;
  onStartHand: () => void;
  phase: PokerPhase;
  player: PokerPlayerState | null;
  pendingAction?: string | null;
  quickRaiseOptions: Array<{ label: string; value: number }>;
  raiseTo: string;
  recentActions: string[];
  safeAreaBottom?: number;
  safeAreaHorizontal?: number;
  statusMessage: string;
};

export function HeroActionSection({
  barMode = false,
  compact = false,
  controls,
  currentBet,
  onAction,
  onRaiseChange,
  onRaiseSubmit,
  onRebuy,
  onStartHand,
  phase,
  player,
  pendingAction = null,
  raiseTo,
  safeAreaBottom = 0,
  safeAreaHorizontal = 0,
  statusMessage,
}: Props) {
  const compactActions = compact || barMode;

  return (
    <View
      style={[
        styles.root,
        barMode ? styles.rootBar : null,
        compact ? styles.compact : styles.expanded,
        {
          paddingBottom: barMode ? 0 : Math.max(10, safeAreaBottom + 8),
          paddingHorizontal: barMode
            ? 0
            : compact
              ? Math.max(4, safeAreaHorizontal + 2)
              : Math.max(8, safeAreaHorizontal + 2),
        },
      ]}
    >
      <View style={barMode ? styles.barLayout : styles.standardLayout}>
        <View
          style={[
            styles.actionSlot,
            compactActions ? styles.actionSlotCompact : null,
            barMode ? styles.actionSlotBar : null,
          ]}
        >
          <GameControls
            controls={controls}
            currentBet={currentBet}
            mode="standard"
            onAction={onAction}
            onRaiseChange={onRaiseChange}
            onRaiseSubmit={onRaiseSubmit}
            onRebuy={onRebuy}
            onStartHand={onStartHand}
            pendingAction={pendingAction}
            raiseTo={raiseTo}
            player={player}
            statusMessage={isLiveHand(phase) ? statusMessage : 'Start the next hand when the table is ready.'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionSlot: { flex: 1 },
  actionSlotBar: { minHeight: 0 },
  actionSlotCompact: { minWidth: 0 },
  barLayout: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: 0,
  },
  compact: { gap: 10 },
  expanded: { gap: 14 },
  root: {
    borderRadius: 16,
    width: '100%',
  },
  rootBar: {
    minHeight: 0,
  },
  standardLayout: {
    gap: 12,
    width: '100%',
  },
});
