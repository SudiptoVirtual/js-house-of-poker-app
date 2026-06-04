import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { FeedActionBar } from './FeedActionBar';
import { FeedPlayerHeader } from './FeedPlayerHeader';
import type { FeedComment, FeedCommentSubmitResult, FeedPost } from '../../types/feed';

type FeedPostCardProps = {
  actionsDisabled?: boolean;
  actionsDisabledMessage?: string;
  onComment: (
    post: FeedPost,
    comment: string,
  ) => Promise<FeedCommentSubmitResult | void> | FeedCommentSubmitResult | void;
  onGiftClips: (post: FeedPost) => void;
  onInviteToTable: (post: FeedPost) => void;
  onOpenProfile: (playerId: string) => void;
  onPromote: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onSupportChange: (postId: string, isSupported: boolean) => void | Promise<void>;
  post: FeedPost;
};

export function FeedPostCard({
  actionsDisabled = false,
  actionsDisabledMessage = 'Sign in and refresh the feed before using post actions.',
  onComment,
  onGiftClips,
  onInviteToTable,
  onOpenProfile,
  onPromote,
  onShare,
  onSupportChange,
  post,
}: FeedPostCardProps) {
  const [commentDraft, setCommentDraft] = useState('');
  const [isCommentPanelVisible, setIsCommentPanelVisible] = useState(false);
  const [latestComments, setLatestComments] = useState<FeedComment[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const statsLine = useMemo(() => {
    const stats = [
      `${post.supportersCount.toLocaleString()} Supporters`,
      `${post.commentCount.toLocaleString()} Comments`,
      `${post.shareCount.toLocaleString()} Shares`,
    ];

    if (post.giftClipsCount) {
      stats.push(`${post.giftClipsCount.toLocaleString()} Gift Clips`);
    }

    if (post.promotedCount) {
      stats.push(`${post.promotedCount.toLocaleString()} Sponsors`);
    }

    return stats.join(' · ');
  }, [post.commentCount, post.giftClipsCount, post.promotedCount, post.shareCount, post.supportersCount]);

  function guardAction(action: () => void) {
    if (actionsDisabled) {
      Alert.alert('Action unavailable', actionsDisabledMessage);
      return;
    }

    action();
  }

  async function handleSubmitComment() {
    const trimmedComment = commentDraft.trim();

    if (actionsDisabled) {
      Alert.alert('Action unavailable', actionsDisabledMessage);
      return;
    }

    if (!trimmedComment || isSubmittingComment) {
      return;
    }

    setIsSubmittingComment(true);

    try {
      const result = await onComment(post, trimmedComment);

      if (result?.comment) {
        setLatestComments((currentComments) => [result.comment, ...currentComments].slice(0, 3));
      }

      setCommentDraft('');
    } finally {
      setIsSubmittingComment(false);
    }
  }

  return (
    <View style={styles.card}>
      <FeedPlayerHeader
        isPromoted={post.isPromoted}
        onOpenProfile={onOpenProfile}
        player={post.player}
        timestamp={post.timestamp}
      />

      <Text style={styles.content}>{post.content}</Text>

      {post.tableContext ? (
        <View style={styles.tableContext}>
          <View style={styles.tableIconShell}>
            <MaterialCommunityIcons color={colors.gold} name="poker-chip" size={22} />
          </View>
          <View style={styles.tableCopy}>
            <Text style={styles.tableName}>{post.tableContext.tableName}</Text>
            <Text style={styles.tableMeta}>
              {post.tableContext.gameLabel}
              {post.tableContext.seatsOpen != null ? ` · ${post.tableContext.seatsOpen} seats open` : ''}
              {post.tableContext.tableCode ? ` · ${post.tableContext.tableCode}` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {post.gameContext ? (
        <View style={styles.gameContext}>
          <View style={styles.gameIconShell}>
            <MaterialCommunityIcons color={colors.secondary} name="cards-playing-outline" size={22} />
          </View>
          <View style={styles.tableCopy}>
            <Text style={styles.tableName}>{post.gameContext.headline}</Text>
            <Text style={styles.tableMeta}>
              {[post.gameContext.tableName, post.gameContext.resultLabel, post.gameContext.stakesLabel]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.stats}>{statsLine}</Text>

      {post.giftClipsTotal ? (
        <View style={styles.giftStats}>
          <MaterialCommunityIcons color={colors.gold} name="gift-outline" size={15} />
          <Text style={styles.giftStatsText}>{post.giftClipsTotal.toLocaleString()} clips gifted to this creator</Text>
        </View>
      ) : null}

      <FeedActionBar
        actionsDisabled={actionsDisabled}
        isSupported={Boolean(post.supportedByCurrentPlayer)}
        isTableRelated={Boolean(post.isTableRelated || post.tableContext)}
        supportersCount={post.supportersCount}
        onComment={() => guardAction(() => setIsCommentPanelVisible((value) => !value))}
        onGiftClips={() => guardAction(() => onGiftClips(post))}
        onInviteToTable={() => guardAction(() => onInviteToTable(post))}
        onPromote={() => guardAction(() => onPromote(post))}
        onShare={() => guardAction(() => onShare(post))}
        onSupport={() => {
          guardAction(() => {
            void onSupportChange(post.id, !post.supportedByCurrentPlayer);
          });
        }}
      />

      {isCommentPanelVisible ? (
        <View style={styles.commentStack}>
          {latestComments.length > 0 ? (
            <View style={styles.persistedComments}>
              {latestComments.map((comment) => (
                <View key={comment.id} style={styles.persistedCommentRow}>
                  <Text style={styles.persistedCommentAuthor}>{comment.player.handle}</Text>
                  <Text style={styles.persistedCommentBody}>{comment.body ?? 'Comment hidden by moderation'}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.commentPanel}>
            <TextInput
              onChangeText={setCommentDraft}
              placeholder="Add a table-side comment..."
              placeholderTextColor={colors.mutedText}
              editable={!actionsDisabled && !isSubmittingComment}
              style={styles.commentInput}
              value={commentDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled || isSubmittingComment}
              onPress={handleSubmitComment}
              style={[styles.commentSendButton, actionsDisabled || isSubmittingComment ? styles.commentSendButtonDisabled : null]}
            >
              <MaterialCommunityIcons color={colors.text} name="send-outline" size={18} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  commentInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentPanel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
  },
  commentSendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    marginRight: 5,
    width: 38,
  },
  commentSendButtonDisabled: {
    opacity: 0.55,
  },
  commentStack: {
    gap: 8,
  },
  content: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  gameContext: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: 'rgba(54,231,255,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  gameIconShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(54,231,255,0.10)',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  giftStats: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,201,94,0.10)',
    borderColor: 'rgba(255,201,94,0.28)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  giftStatsText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  persistedCommentAuthor: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  persistedCommentBody: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  persistedCommentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  persistedComments: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  stats: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  tableContext: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: 'rgba(255,201,94,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 11,
  },
  tableCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  tableIconShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,201,94,0.10)',
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tableMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
  },
  tableName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
});
