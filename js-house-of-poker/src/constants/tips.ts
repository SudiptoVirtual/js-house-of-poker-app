export const pokerTips = [
  'The chance of one of your cards making a pair on the flop is about 1/3',
  'By the river, your chances of making a pair go up to roughly 1/2',
  "Don't play any two cards just because they're suited. It only improves your hand by 2.5%",
  "If you've got one card short of a full flush after the flop, you'll make your hand 1/3 of the time",
  'The probability of flopping two-pair from non-paired hole cards is about 2%',
  'Every out you have on the flop equals about 4% to improve by the river',
  'If you have a pocket pair, you will flop a set roughly one time in 9',
  'If you have two suited cards, you will flop a flush roughly one time in 118',
  "On average, you'll be dealt pocket aces once every 220 hands",
  'A straight flush is likely to happen once in 64,974 hands',
  'There are 169 non-equivalent starting hands, not all of them equally likely',
  'About every sixth flop will contain a pair',
  'Against a random single hand, pocket aces win about 85% of the time',
] as const;

export function getRandomTip() {
  return pokerTips[Math.floor(Math.random() * pokerTips.length)];
}
