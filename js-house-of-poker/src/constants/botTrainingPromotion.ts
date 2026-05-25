export const BOT_TRAINING_PROMO_MESSAGES = [
  'Practice safely with no risk to your free clips.',
  'Instant AI opponents are always ready.',
  'Learn showdown decisions before playing live.',
  'Bot Training Tables are always open.',
  'Build confidence before joining real multiplayer tables.',
] as const;

export type BotTrainingPromoPlacement =
  | 'lobby'
  | 'empty-seat'
  | 'first-login'
  | 'social-feed'
  | 'invite'
  | 'tutorial'
  | 'loading';

export const BOT_TRAINING_PROMO_CONFIG = {
  cta: {
    primaryLabel: 'Open Bot Training Tables',
    secondaryLabelByPlacement: {
      invite: 'Learn 357',
      loading: 'Watch Demo Hand',
      socialFeed: 'Watch Demo Hand',
      tutorial: 'Learn 357',
    },
  },
  eyebrow: 'Bot Training Tables',
  messages: BOT_TRAINING_PROMO_MESSAGES,
  title: 'Train before you go live',
} as const;

export function getRotatingBotTrainingMessage(seed = Date.now()) {
  const messages = BOT_TRAINING_PROMO_CONFIG.messages;
  return messages[Math.abs(seed) % messages.length];
}
