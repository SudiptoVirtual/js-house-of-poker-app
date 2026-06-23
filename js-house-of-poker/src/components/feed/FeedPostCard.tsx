import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../../theme/colors";
import { FeedActionBar } from "./FeedActionBar";
import { FeedPlayerHeader } from "./FeedPlayerHeader";
import { FeedMediaGallery } from "./FeedMediaGallery";
import type {
  FeedComment,
  FeedCommentSubmitResult,
  FeedPost,
} from "../../types/feed";

type CommentPanelLoadState = "idle" | "loading" | "ready" | "empty" | "error";
type PostMenuAnchor = { height: number; width: number; x: number; y: number };
type FeedPostToast = { tone: "success" | "error"; message: string };

const POST_MENU_WIDTH = 180;
const POST_MENU_HEIGHT = 98;
const POST_MENU_VIEWPORT_MARGIN = 8;

type FeedCommentsPanelResult = {
  comments: FeedComment[];
  post: FeedPost;
};

type FeedCommentMutationResult = {
  comment: FeedComment;
  post?: FeedPost | null;
};

type FeedCommentDeleteResult = {
  comment: FeedComment;
  deleted: boolean;
  post?: FeedPost | null;
};

type FeedPostCardProps = {
  actionMode?: "full" | "owner-only";
  variant?: "feed" | "ownerHistory";
  actionsDisabled?: boolean;
  isActive?: boolean;
  actionsDisabledMessage?: string;
  currentUserId?: string;
  onComment: (
    post: FeedPost,
    comment: string,
  ) => Promise<FeedCommentSubmitResult | void> | FeedCommentSubmitResult | void;
  onCommentInputFocus?: (inputHandle: number) => void;
  onDeleteComment: (
    post: FeedPost,
    comment: FeedComment,
  ) => Promise<FeedCommentDeleteResult | void> | FeedCommentDeleteResult | void;
  onDeletePost: (post: FeedPost) => Promise<void> | void;
  onFetchComments: (
    post: FeedPost,
  ) => Promise<FeedCommentsPanelResult | void> | FeedCommentsPanelResult | void;
  onGiftClips: (post: FeedPost) => void;
  onInviteToTable: (post: FeedPost) => Promise<void> | void;
  onJoinTable: (post: FeedPost) => Promise<void> | void;
  onOpenProfile: (playerId: string) => void;
  onPromote: (post: FeedPost) => void;
  onRequestVideoActive?: (postId: string) => void;
  onShare: (post: FeedPost) => void;
  onShowToast?: (toast: FeedPostToast) => void;
  onSupportChange: (
    postId: string,
    isSupported: boolean,
  ) => void | Promise<void>;
  onUpdateComment: (
    post: FeedPost,
    comment: FeedComment,
    body: string,
  ) =>
    | Promise<FeedCommentMutationResult | void>
    | FeedCommentMutationResult
    | void;
  onUpdatePost: (post: FeedPost, content: string) => Promise<void> | void;
  post: FeedPost;
};

export function FeedPostCard({
  actionMode,
  actionsDisabled = false,
  actionsDisabledMessage = "Sign in and refresh the feed before using post actions.",
  currentUserId,
  isActive = false,
  onComment,
  onCommentInputFocus,
  onDeleteComment,
  onDeletePost,
  onFetchComments,
  onGiftClips,
  onInviteToTable,
  onJoinTable,
  onOpenProfile,
  onPromote,
  onRequestVideoActive,
  onShare,
  onShowToast,
  onSupportChange,
  onUpdateComment,
  onUpdatePost,
  post,
  variant = "feed",
}: FeedPostCardProps) {
  const [commentDraft, setCommentDraft] = useState("");
  const [isCommentPanelVisible, setIsCommentPanelVisible] = useState(false);
  const [latestComments, setLatestComments] = useState<FeedComment[]>([]);
  const [commentPanelLoadState, setCommentPanelLoadState] =
    useState<CommentPanelLoadState>("idle");
  const [commentPanelError, setCommentPanelError] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isJoiningTable, setIsJoiningTable] = useState(false);
  const [isInvitingToTable, setIsInvitingToTable] = useState(false);
  const [isSupporting, setIsSupporting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(
    null,
  );
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [postMenuAnchor, setPostMenuAnchor] = useState<PostMenuAnchor | null>(
    null,
  );
  const moreButtonRef = useRef<View>(null);
  const [postEditorVisible, setPostEditorVisible] = useState(false);
  const [postDraft, setPostDraft] = useState(post.content);
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const isPostOwner = Boolean(
    currentUserId &&
      (post.authorUserId === currentUserId || post.player.id === currentUserId),
  );
  const isOwnerHistoryMode = variant === "ownerHistory" || actionMode === "owner-only";
  const canInviteToTable = Boolean(
    post.tableContext &&
      (!currentUserId || (post.authorUserId ?? post.player.id) !== currentUserId),
  );
  const showSocialActions = !isOwnerHistoryMode;
  const allowCommentComposer = showSocialActions;

  const socialStats = useMemo(
    () => [
      {
        accent: colors.gold,
        count: post.supportersCount.toLocaleString(),
        icon: "cards-heart-outline" as const,
        key: "supports",
        label: post.supportersCount === 1 ? "Support" : "Supports",
      },
      {
        accent: colors.secondary,
        count: post.commentCount.toLocaleString(),
        icon: "comment-text-outline" as const,
        key: "comments",
        label: post.commentCount === 1 ? "Comment" : "Comments",
      },
      {
        accent: colors.primary,
        count: post.shareCount.toLocaleString(),
        icon: "share-variant-outline" as const,
        key: "shares",
        label: post.shareCount === 1 ? "Share" : "Shares",
      },
    ],
    [post.commentCount, post.shareCount, post.supportersCount],
  );

  function guardAction(action: () => void) {
    if (actionsDisabled) {
      onShowToast?.({ tone: "error", message: actionsDisabledMessage });
      return;
    }

    action();
  }

  function isOwnComment(comment: FeedComment) {
    return Boolean(
      currentUserId &&
      (comment.authorUserId === currentUserId ||
        comment.player.id === currentUserId),
    );
  }

  async function loadPersistedComments() {
    if (actionsDisabled || commentPanelLoadState === "loading") {
      return;
    }

    setCommentPanelLoadState("loading");
    setCommentPanelError("");

    try {
      const result = await onFetchComments(post);
      const comments = result?.comments ?? [];

      setLatestComments(comments);
      setCommentPanelLoadState(comments.length > 0 ? "ready" : "empty");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load comments right now.";

      setCommentPanelError(message);
      setCommentPanelLoadState("error");
    }
  }

  function handleToggleCommentPanel() {
    guardAction(() => {
      setIsCommentPanelVisible((isVisible) => {
        const nextIsVisible = !isVisible;

        if (nextIsVisible) {
          void loadPersistedComments();
        }

        return nextIsVisible;
      });
    });
  }

  function beginEditingComment(comment: FeedComment) {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.body ?? "");
  }

  function cancelEditingComment() {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  }

  async function handleUpdateComment(comment: FeedComment) {
    const trimmedComment = editingCommentDraft.trim();

    if (!trimmedComment || updatingCommentId) {
      return;
    }

    setUpdatingCommentId(comment.id);

    try {
      const result = await onUpdateComment(post, comment, trimmedComment);

      if (result?.comment) {
        setLatestComments((currentComments) =>
          currentComments.map((currentComment) =>
            currentComment.id === comment.id ? result.comment : currentComment,
          ),
        );
      }

      cancelEditingComment();
    } finally {
      setUpdatingCommentId(null);
    }
  }

  async function handleDeleteComment(comment: FeedComment) {
    if (deletingCommentId) {
      return;
    }

    setDeletingCommentId(comment.id);

    try {
      const result = await onDeleteComment(post, comment);

      if (result?.deleted) {
        setLatestComments((currentComments) => {
          const nextComments = currentComments.filter(
            (currentComment) => currentComment.id !== comment.id,
          );
          setCommentPanelLoadState(nextComments.length > 0 ? "ready" : "empty");
          return nextComments;
        });
      }
    } finally {
      setDeletingCommentId(null);
    }
  }

  async function handleSubmitComment() {
    const trimmedComment = commentDraft.trim();

    if (actionsDisabled) {
      onShowToast?.({ tone: "error", message: actionsDisabledMessage });
      return;
    }

    if (!trimmedComment || isSubmittingComment) {
      return;
    }

    setIsSubmittingComment(true);

    try {
      const result = await onComment(post, trimmedComment);

      if (result?.comment) {
        setLatestComments((currentComments) => [
          result.comment,
          ...currentComments,
        ]);
        setCommentPanelLoadState("ready");
      }

      setCommentDraft("");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleSupport() {
    if (isSupporting) {
      return;
    }

    setIsSupporting(true);

    try {
      await onSupportChange(post.id, !post.supportedByCurrentPlayer);
    } finally {
      setIsSupporting(false);
    }
  }

  async function handleJoinTable() {
    if (isJoiningTable) {
      return;
    }

    setIsJoiningTable(true);

    try {
      await onJoinTable(post);
    } finally {
      setIsJoiningTable(false);
    }
  }

  async function handleSendTableInvite() {
    if (isInvitingToTable) {
      return;
    }

    setIsInvitingToTable(true);

    try {
      await onInviteToTable(post);
    } finally {
      setIsInvitingToTable(false);
    }
  }

  function beginEditingPost() {
    setPostDraft(post.content);
    setPostMenuAnchor(null);
    setPostEditorVisible(true);
  }

  async function handleUpdatePost() {
    const content = postDraft.trim();
    if (isUpdatingPost || (!content && post.media.length === 0)) return;
    setIsUpdatingPost(true);
    try {
      await onUpdatePost(post, content);
      setPostEditorVisible(false);
    } finally {
      setIsUpdatingPost(false);
    }
  }

  function confirmDeletePost() {
    setPostMenuAnchor(null);
    Alert.alert("Delete post?", "This action cannot be undone.", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: async () => {
          setIsDeletingPost(true);
          try {
            await onDeletePost(post);
          } finally {
            setIsDeletingPost(false);
          }
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  return (
    <View style={styles.card}>
      {isPostOwner ? (
        <Pressable
          accessibilityLabel="More post actions"
          accessibilityRole="button"
          disabled={isDeletingPost}
          onPress={() =>
            moreButtonRef.current?.measureInWindow((x, y, width, height) => {
              setPostMenuAnchor({ height, width, x, y });
            })
          }
          ref={moreButtonRef}
          style={styles.moreButton}
        >
          <MaterialCommunityIcons color={colors.primary} name="dots-vertical" size={22} />
        </Pressable>
      ) : null}
      <FeedPlayerHeader
        isPromoted={post.isPromoted}
        onOpenProfile={onOpenProfile}
        player={post.player}
        timestamp={post.timestamp}
      />

      <Text style={styles.content}>{post.content}</Text>

      <FeedMediaGallery
        isActive={isActive}
        media={post.media}
        onRequestVideoActive={() => onRequestVideoActive?.(post.id)}
      />

      {post.tableContext ? (
        <View style={styles.tableContext}>
          <View style={styles.tableIconShell}>
            <MaterialCommunityIcons
              color={colors.gold}
              name="poker-chip"
              size={22}
            />
          </View>
          <View style={styles.tableCopy}>
            <Text style={styles.tableName}>{post.tableContext.tableName}</Text>
            <Text style={styles.tableMeta}>
              {post.tableContext.gameLabel}
              {post.tableContext.seatsOpen != null
                ? ` · ${post.tableContext.seatsOpen} seats open`
                : ""}
              {post.tableContext.tableCode
                ? ` · ${post.tableContext.tableCode}`
                : ""}
            </Text>
          </View>
        </View>
      ) : null}

      {post.gameContext ? (
        <View style={[styles.gameContext, post.postKind === "share-win" ? styles.shareWinContext : null]}>
          <View style={[styles.gameIconShell, post.postKind === "share-win" ? styles.shareWinIconShell : null]}>
            <MaterialCommunityIcons
              color={post.postKind === "share-win" ? colors.gold : colors.secondary}
              name={post.postKind === "share-win" ? "trophy-outline" : "cards-playing-outline"}
              size={22}
            />
          </View>
          <View style={styles.tableCopy}>
            {post.postKind === "share-win" ? <Text style={styles.shareWinLabel}>Share Win · Hand #{post.gameContext.handNumber}</Text> : null}
            <Text style={styles.tableName}>{post.gameContext.headline}</Text>
            <Text style={styles.tableMeta}>
              {[
                post.gameContext.tableName,
                post.gameContext.resultLabel,
                post.gameContext.stakesLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.socialStatsRow}>
        {socialStats.map((item) => {
          const content = (
            <>
              <MaterialCommunityIcons color={item.accent} name={item.icon} size={18} />
              <View style={styles.socialStatCopy}>
                <Text numberOfLines={1} style={styles.socialStatCount}>{item.count}</Text>
                <Text numberOfLines={1} style={styles.socialStatLabel}>{item.label}</Text>
              </View>
            </>
          );

          return item.key === "comments" ? (
            <Pressable
              accessibilityLabel={`${item.count} ${item.label}. View comments`}
              accessibilityRole="button"
              disabled={commentPanelLoadState === "loading"}
              key={item.key}
              onPress={handleToggleCommentPanel}
              style={({ pressed }) => [
                styles.socialStatPill,
                pressed ? styles.socialStatPillPressed : null,
              ]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={item.key} style={styles.socialStatPill}>
              {content}
            </View>
          );
        })}
      </View>

      {showSocialActions && post.giftClipsTotal ? (
        <View style={styles.giftStats}>
          <MaterialCommunityIcons
            color={colors.gold}
            name="gift-outline"
            size={15}
          />
          <Text style={styles.giftStatsText}>
            {post.giftClipsTotal.toLocaleString()} clips gifted to this creator
          </Text>
        </View>
      ) : null}

      {showSocialActions ? (
        <FeedActionBar
          actionsDisabled={actionsDisabled}
          commentLoading={commentPanelLoadState === "loading"}
          canInviteToTable={canInviteToTable}
          canJoinTable={post.postKind === "table-invite"}
          inviteLoading={isInvitingToTable}
          isSupported={Boolean(post.supportedByCurrentPlayer)}
          joinLoading={isJoiningTable}
          supportersCount={post.supportersCount}
          onComment={handleToggleCommentPanel}
          onGiftClips={() => guardAction(() => onGiftClips(post))}
          onInviteToTable={() => guardAction(() => { void handleSendTableInvite(); })}
          onJoinTable={() => guardAction(() => { void handleJoinTable(); })}
          onPromote={() => guardAction(() => onPromote(post))}
          onShare={() => guardAction(() => onShare(post))}
          onSupport={() => guardAction(() => { void handleSupport(); })}
          supportLoading={isSupporting}
        />
      ) : null}

      {isCommentPanelVisible ? (
        <View style={styles.commentStack}>
          <View style={styles.persistedComments}>
            {commentPanelLoadState === "loading" ? (
              <Text style={styles.commentStateText}>
                Loading persisted comments…
              </Text>
            ) : commentPanelLoadState === "error" ? (
              <View style={styles.commentStateStack}>
                <Text style={styles.commentStateTitle}>
                  Comments unavailable
                </Text>
                <Text style={styles.commentStateText}>
                  {commentPanelError || "Unable to load comments right now."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={loadPersistedComments}
                  style={styles.commentRetryButton}
                >
                  <Text style={styles.commentRetryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : commentPanelLoadState === "empty" ? (
              <Text style={styles.commentStateText}>
                {allowCommentComposer
                  ? "No comments yet. Start the table talk."
                  : "No comments yet."}
              </Text>
            ) : latestComments.length > 0 ? (
              latestComments.map((comment) => {
                const canManageComment =
                  allowCommentComposer &&
                  isOwnComment(comment) &&
                  !comment.isDeleted &&
                  !comment.deletedAt;
                const isEditingComment = editingCommentId === comment.id;
                const isUpdatingComment = updatingCommentId === comment.id;
                const isDeletingComment = deletingCommentId === comment.id;

                return (
                  <View key={comment.id} style={styles.persistedCommentRow}>
                    <View style={styles.persistedCommentContent}>
                      <Text style={styles.persistedCommentAuthor}>
                        {comment.player.handle}
                      </Text>
                      {isEditingComment ? (
                        <TextInput
                          editable={!isUpdatingComment}
                          onChangeText={setEditingCommentDraft}
                          onFocus={(event) => onCommentInputFocus?.(event.nativeEvent.target)}
                          placeholder="Update your comment..."
                          placeholderTextColor={colors.mutedText}
                          style={styles.commentEditInput}
                          value={editingCommentDraft}
                        />
                      ) : (
                        <Text style={styles.persistedCommentBody}>
                          {comment.body ?? "Comment hidden by moderation"}
                        </Text>
                      )}
                    </View>
                    {canManageComment ? (
                      <View style={styles.commentControls}>
                        {isEditingComment ? (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              disabled={
                                isUpdatingComment || !editingCommentDraft.trim()
                              }
                              onPress={() => {
                                void handleUpdateComment(comment);
                              }}
                              style={[
                                styles.commentControlButton,
                                isUpdatingComment
                                  ? styles.commentControlButtonDisabled
                                  : null,
                              ]}
                            >
                              {isUpdatingComment ? (
                                <ActivityIndicator color={colors.text} size="small" />
                              ) : (
                                <MaterialCommunityIcons
                                  color={colors.text}
                                  name="check"
                                  size={16}
                                />
                              )}
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={isUpdatingComment}
                              onPress={cancelEditingComment}
                              style={styles.commentControlButton}
                            >
                              <MaterialCommunityIcons
                                color={colors.mutedText}
                                name="close"
                                size={16}
                              />
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => beginEditingComment(comment)}
                              style={styles.commentControlButton}
                            >
                              <MaterialCommunityIcons
                                color={colors.primary}
                                name="pencil-outline"
                                size={16}
                              />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={isDeletingComment}
                              onPress={() => {
                                void handleDeleteComment(comment);
                              }}
                              style={[
                                styles.commentControlButton,
                                isDeletingComment
                                  ? styles.commentControlButtonDisabled
                                  : null,
                              ]}
                            >
                              {isDeletingComment ? (
                                <ActivityIndicator color={colors.danger} size="small" />
                              ) : (
                                <MaterialCommunityIcons
                                  color={colors.danger}
                                  name="trash-can-outline"
                                  size={16}
                                />
                              )}
                            </Pressable>
                          </>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.commentStateText}>
                Open comments to load the latest replies.
              </Text>
            )}
          </View>
          {allowCommentComposer ? (
            <View style={styles.commentPanel}>
              <TextInput
                onChangeText={setCommentDraft}
                onFocus={(event) => onCommentInputFocus?.(event.nativeEvent.target)}
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
                style={[
                  styles.commentSendButton,
                  actionsDisabled || isSubmittingComment
                    ? styles.commentSendButtonDisabled
                    : null,
                ]}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <MaterialCommunityIcons
                    color={colors.text}
                    name="send-outline"
                    size={18}
                  />
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
      <Modal animationType="fade" onRequestClose={() => setPostMenuAnchor(null)} transparent visible={postMenuAnchor !== null}>
        <View style={styles.postMenuOverlay}>
          <Pressable accessibilityLabel="Close post actions" accessibilityRole="button" onPress={() => setPostMenuAnchor(null)} style={StyleSheet.absoluteFill} />
          {postMenuAnchor ? (
          <View
            style={[
              styles.postMenu,
              {
                left: Math.max(
                  POST_MENU_VIEWPORT_MARGIN,
                  Math.min(
                    postMenuAnchor.x + postMenuAnchor.width - POST_MENU_WIDTH,
                    Dimensions.get("window").width -
                      POST_MENU_WIDTH -
                      POST_MENU_VIEWPORT_MARGIN,
                  ),
                ),
                top: Math.max(
                  POST_MENU_VIEWPORT_MARGIN,
                  Math.min(
                    postMenuAnchor.y + postMenuAnchor.height,
                    Dimensions.get("window").height -
                      POST_MENU_HEIGHT -
                      POST_MENU_VIEWPORT_MARGIN,
                  ),
                ),
              },
            ]}
          >
            <Pressable accessibilityRole="button" onPress={beginEditingPost} style={styles.postMenuAction}>
              <MaterialCommunityIcons color={colors.primary} name="pencil-outline" size={18} />
              <Text style={styles.postMenuText}>Edit</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmDeletePost} style={styles.postMenuAction}>
              <MaterialCommunityIcons color={colors.danger} name="trash-can-outline" size={18} />
              <Text style={styles.deleteMenuText}>Delete</Text>
            </Pressable>
          </View>
          ) : null}
        </View>
      </Modal>
      <Modal animationType="fade" onRequestClose={() => setPostEditorVisible(false)} transparent visible={postEditorVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.postEditor}>
            <Text style={styles.postEditorTitle}>Edit post</Text>
            <TextInput
              accessibilityLabel="Post content"
              editable={!isUpdatingPost}
              multiline
              onChangeText={setPostDraft}
              placeholder="Add text or keep attached media"
              placeholderTextColor={colors.mutedText}
              style={styles.postEditInput}
              value={postDraft}
            />
            <View style={styles.postEditorActions}>
              <Pressable accessibilityRole="button" disabled={isUpdatingPost} onPress={() => setPostEditorVisible(false)} style={styles.secondaryButton}>
                <Text style={styles.postMenuText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={isUpdatingPost || (!postDraft.trim() && post.media.length === 0)} onPress={() => { void handleUpdatePost(); }} style={styles.primaryButton}>
                <Text style={styles.postMenuText}>{isUpdatingPost ? "Saving…" : "Save"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.roles.glassPanel,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: colors.radii.xl,
    borderWidth: 1,
    gap: colors.spacing[16],
    overflow: 'hidden',
    padding: colors.spacing[16],
    ...colors.shadows.lg,
  },
  deleteMenuText: { color: colors.danger, fontSize: 14, fontWeight: "900" },
  modalBackdrop: { alignItems: "center", backgroundColor: colors.modalBackdrop, flex: 1, justifyContent: "center", padding: 24 },
  moreButton: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", position: "absolute", right: 12, top: 12, width: 38, zIndex: 2 },
  postEditInput: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, minHeight: 110, padding: 12, textAlignVertical: "top" },
  postEditor: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 14, padding: 18, width: "100%" },
  postEditorActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  postEditorTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  postMenu: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, overflow: "hidden", width: 180 },
  postMenuOverlay: { flex: 1 },
  postMenuAction: { alignItems: "center", flexDirection: "row", gap: 10, padding: 14 },
  postMenuText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  secondaryButton: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  commentInput: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentControlButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  commentControlButtonDisabled: {
    opacity: 0.55,
  },
  commentControls: {
    flexDirection: "row",
    gap: 6,
  },
  commentEditInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  commentPanel: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
  },
  commentSendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    marginRight: 5,
    width: 38,
  },
  commentSendButtonDisabled: {
    opacity: 0.55,
  },
  commentStack: {
    gap: 8,
  },
  commentRetryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  commentRetryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
  },
  commentStateStack: {
    gap: 6,
  },
  commentStateText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  commentStateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  content: {
    ...colors.typography.body,
    color: colors.text,
  },
  gameContext: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(54,231,255,0.24)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  gameIconShell: {
    alignItems: "center",
    backgroundColor: "rgba(54,231,255,0.10)",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  shareWinContext: {
    backgroundColor: colors.goldTint,
    borderColor: "rgba(255,201,94,0.42)",
  },
  shareWinIconShell: { backgroundColor: "rgba(255,201,94,0.16)" },
  shareWinLabel: { color: colors.gold, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  giftStats: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.goldTint,
    borderColor: "rgba(255,201,94,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  giftStatsText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  persistedCommentAuthor: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  persistedCommentBody: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  persistedCommentContent: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  persistedCommentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
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
  socialStatCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  socialStatCount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  socialStatLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
  },
  socialStatPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.glassPanel,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: colors.radii.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: colors.spacing[8],
    minWidth: 0,
    paddingHorizontal: colors.spacing[12],
    paddingVertical: colors.spacing[8],
  },
  socialStatPillPressed: {
    opacity: 0.74,
  },
  socialStatsRow: {
    flexDirection: 'row',
    gap: colors.spacing[8],
  },
  tableContext: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: "rgba(255,201,94,0.24)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  tableCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  tableIconShell: {
    alignItems: "center",
    backgroundColor: colors.goldTint,
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  tableMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  tableName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
});
