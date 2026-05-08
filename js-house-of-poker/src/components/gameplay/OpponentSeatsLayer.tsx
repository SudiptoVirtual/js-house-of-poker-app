import { StyleSheet, View } from 'react-native';

import { AnimatedChipStack } from '../AnimatedChipStack';
import { PlayerSeat } from '../PlayerSeat';
import type { SeatDescriptor } from '../../utils/pokerTable';
import type { PokerPhase } from '../../types/poker';

type Props = {
  dealtCards: Record<string, number>;
  phase: PokerPhase;
  seatDescriptors: SeatDescriptor[];
  selfId: string | null;
  winnerIds: string[];
};

export function OpponentSeatsLayer({
  dealtCards,
  phase,
  seatDescriptors,
  selfId,
  winnerIds,
}: Props) {
  return (
    <View style={styles.zone}>
      {seatDescriptors.map((descriptor) => {
        const isSelf = descriptor.player.id === selfId;
        const isWinner = winnerIds.includes(descriptor.player.id);

        return (
          <View key={descriptor.player.id} style={styles.seatSlot}>
            <PlayerSeat
              align={descriptor.align}
              dealtCardCount={dealtCards[descriptor.player.id] ?? 0}
              isBottomSeat={descriptor.isBottomSeat}
              isSelf={isSelf}
              isWinner={isWinner}
              phase={phase}
              player={descriptor.player}
              revealCards={phase === 'completed'}
            />
            <View pointerEvents="none" style={styles.betSpot}>
              <AnimatedChipStack
                amount={descriptor.player.betThisRound}
                highlighted={descriptor.player.isTurn}
                size="sm"
                tone="bet"
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  betSpot: {
    alignItems: 'center',
    marginTop: 4,
    minHeight: 32,
    minWidth: 60,
  },
  seatSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zone: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
});
