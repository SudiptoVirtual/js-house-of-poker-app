import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './ActionButton';
import {
  BOT_TRAINING_PROMO_CONFIG,
  type BotTrainingPromoPlacement,
  getRotatingBotTrainingMessage,
} from '../constants/botTrainingPromotion';

import { colors } from '../theme/colors';
type Props = {
  compact?: boolean;
  hideCtas?: boolean;
  messageSeed?: number;
  onPressPrimary?: () => void;
  onPressSecondary?: () => void;
  placement: BotTrainingPromoPlacement;
};

export function BotTrainingPromoBanner({
  compact = false,
  hideCtas = false,
  messageSeed,
  onPressPrimary,
  onPressSecondary,
  placement,
}: Props) {
  const secondaryLabelByPlacement = BOT_TRAINING_PROMO_CONFIG.cta.secondaryLabelByPlacement;
  const secondaryLabel =
    placement === 'social-feed'
      ? secondaryLabelByPlacement.socialFeed
      : placement === 'invite'
        ? secondaryLabelByPlacement.invite
        : placement === 'loading'
          ? secondaryLabelByPlacement.loading
          : placement === 'tutorial'
            ? secondaryLabelByPlacement.tutorial
            : null;

  return (
    <View style={[styles.card, compact ? styles.cardCompact : null]}>
      <Text style={styles.eyebrow}>{BOT_TRAINING_PROMO_CONFIG.eyebrow}</Text>
      <Text style={styles.title}>{BOT_TRAINING_PROMO_CONFIG.title}</Text>
      <Text style={styles.message}>{getRotatingBotTrainingMessage(messageSeed)}</Text>
      {hideCtas ? null : (
        <View style={compact ? styles.ctaStack : styles.ctaRow}>
          {onPressPrimary ? (
            <ActionButton
              compact
              fullWidth={compact}
              icon="robot-outline"
              label={BOT_TRAINING_PROMO_CONFIG.cta.primaryLabel}
              onPress={onPressPrimary}
            />
          ) : null}
          {secondaryLabel && onPressSecondary ? (
            <ActionButton
              compact
              fullWidth={compact}
              icon="school-outline"
              label={secondaryLabel}
              onPress={onPressSecondary}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.gold,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  cardCompact: {
    padding: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ctaStack: {
    gap: 8,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  message: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
