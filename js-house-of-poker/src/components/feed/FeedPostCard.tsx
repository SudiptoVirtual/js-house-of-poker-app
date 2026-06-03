import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import { FeedActionBar } from './FeedActionBar';
import { FeedPlayerHeader } from './FeedPlayerHeader';
import type { FeedPlayer, FeedPost } from '../../types/feed';

type FeedPostCardProps = {
  onComment: (post: FeedPost, comment: string) => void;
  onGiftClips: (post: FeedPost) => void;
  onInviteToTable: (post: FeedPost) => void;
  onOpenProfile: (player: FeedPlayer) => void;
  onPromote: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onSupportChange: (postId: string, isSupported: boolean) => void;
  post: FeedPost;
};

export function FeedPostCard({
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

  function handleSubmitComment() {
    const trimmedComment = commentDraft.trim();

    if (!trimmedComment) {
      return;
    }

    // TODO(feed:addComment): Replace this placeholder panel with persisted comments and live updates.
    onComment(post, trimmedComment);
    setCommentDraft('');
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
        isSupported={Boolean(post.supportedByCurrentPlayer)}
        isTableRelated={Boolean(post.isTableRelated || post.tableContext)}
        onComment={() => setIsCommentPanelVisible((value) => !value)}
        onGiftClips={() => onGiftClips(post)}
        onInviteToTable={() => onInviteToTable(post)}
        onPromote={() => onPromote(post)}
        onShare={() => onShare(post)}
        onSupport={() => {
          // TODO(feed:supportPost): Persist Support toggle and reconcile with backend count.
          onSupportChange(post.id, !post.supportedByCurrentPlayer);
        }}
      />

      {isCommentPanelVisible ? (
        <View style={styles.commentPanel}>
          <TextInput
            onChangeText={setCommentDraft}
            placeholder="Add a table-side comment..."
            placeholderTextColor={colors.mutedText}
            style={styles.commentInput}
            value={commentDraft}
          />
          <Pressable accessibilityRole="button" onPress={handleSubmitComment} style={styles.commentSendButton}>
            <MaterialCommunityIcons color={colors.text} name="send-outline" size={18} />
          </Pressable>
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
