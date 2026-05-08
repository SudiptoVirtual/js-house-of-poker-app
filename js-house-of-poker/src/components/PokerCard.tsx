import type { StyleProp, ViewStyle } from 'react-native';

import { AnimatedCard } from './AnimatedCard';

type PokerCardProps = {
  card?: string;
  hidden?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PokerCard({
  card,
  hidden = false,
  large = false,
  style,
}: PokerCardProps) {
  return (
    <AnimatedCard
      animateOnMount="none"
      card={card}
      hidden={hidden}
      large={large}
      style={style}
    />
  );
}
