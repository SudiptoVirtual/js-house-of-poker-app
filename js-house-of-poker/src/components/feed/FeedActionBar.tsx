import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { CommentButton } from './CommentButton';
import { JoinTableButton } from './InviteToTableButton';
import { SupportButton } from './SupportButton';

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
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minWidth: '30%',
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  actionLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  container: {
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopWidth: 1,
    gap: 8,
    paddingTop: 8,
  },
  disabled: {
    opacity: 0.45,
  },
  giftLabel: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
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
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  secondaryLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
