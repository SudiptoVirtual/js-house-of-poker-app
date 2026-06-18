import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { CommentButton } from './CommentButton';
import { JoinTableButton } from './InviteToTableButton';
import { SupportButton } from './SupportButton';

import { colors } from '../../theme/colors';
type FeedActionBarProps = {
  actionsDisabled?: boolean;
  commentLoading?: boolean;
  inviteLoading?: boolean;
  isSupported: boolean;
  isTableRelated?: boolean;
  supportersCount: number;
  onComment: () => void;
  onGiftClips: () => void;
  onJoinTable: () => void;
  onPromote: () => void;
  onShare: () => void;
  onSupport: () => void;
  supportLoading?: boolean;
};

export function FeedActionBar({
  actionsDisabled = false,
  commentLoading = false,
  inviteLoading = false,
  isSupported,
  isTableRelated = false,
  onComment,
  onGiftClips,
  onJoinTable,
  onPromote,
  onShare,
  onSupport,
  supportersCount,
  supportLoading = false,
}: FeedActionBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.primaryRow}>
        <SupportButton disabled={actionsDisabled} isSupported={isSupported} loading={supportLoading} onPress={onSupport} supportersCount={supportersCount} />
        <CommentButton disabled={actionsDisabled} loading={commentLoading} onPress={onComment} />
        <Pressable
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={onShare}
          style={({ pressed }) => [styles.actionButton, actionsDisabled ? styles.disabled : null, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.mutedText} name="share-variant-outline" size={18} />
          <Text style={styles.actionLabel}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.secondaryRow}>
        <Pressable
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={onGiftClips}
          style={({ pressed }) => [styles.secondaryButton, actionsDisabled ? styles.disabled : null, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.gold} name="gift-outline" size={17} />
          <Text style={styles.giftLabel}>Gift Clips</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={onPromote}
          style={({ pressed }) => [styles.secondaryButton, actionsDisabled ? styles.disabled : null, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.secondary} name="bullhorn-outline" size={17} />
          <Text style={styles.secondaryLabel}>Promote</Text>
        </Pressable>
      </View>
      {isTableRelated ? <JoinTableButton disabled={actionsDisabled} loading={inviteLoading} onPress={onJoinTable} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: colors.radii.md,
    flexDirection: 'row',
    gap: colors.spacing[8],
    justifyContent: 'center',
    minWidth: '30%',
    paddingHorizontal: 8,
    paddingVertical: colors.spacing[8],
  },
  actionLabel: {
    color: colors.mutedText,
    ...colors.typography.chipLabel,
  },
  container: {
    backgroundColor: 'rgba(5,3,11,0.28)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    gap: colors.spacing[8],
    padding: colors.spacing[8],
  },
  disabled: {
    opacity: 0.45,
  },
  giftLabel: {
    color: colors.gold,
    ...colors.typography.chipLabel,
  },
  pressed: {
    opacity: 0.74,
  },
  primaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: colors.radii.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: colors.spacing[8],
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: colors.spacing[8],
  },
  secondaryLabel: {
    color: colors.secondary,
    ...colors.typography.chipLabel,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: colors.spacing[8],
  },
});
