import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { FeedAvatar } from './FeedAvatar';
import type { FeedMedia, FeedPlayer, FeedPost } from '../../types/feed';
import type { UploadFeedMediaInput } from '../../services/api/feed';
import { appendFeedAttachments, isFeedAttachmentOversized, MAX_FEED_ATTACHMENTS, MAX_FEED_ATTACHMENT_SIZE_LABEL, removeFeedAttachment, uploadAttachmentsAndCreatePost, type PendingFeedAttachment } from './attachmentWorkflow';

import { colors } from '../../theme/colors';
export type ComposeFeedPostInput =
  | { content: string; media: FeedMedia[]; postType: 'text' | 'media' }
  | { content?: string; media?: FeedMedia[]; postType: 'table_invite' };
export type FeedPostBoxProfile = Pick<FeedPlayer, 'avatarUrl' | 'handle' | 'id' | 'name'>;
type LocalAttachment = PendingFeedAttachment;
type PickerAsset = { assetId?: string | null; fileName?: string | null; fileSize?: number; mimeType?: string; type?: string; uri: string };
type PickerResult = { canceled: boolean; assets?: PickerAsset[] | null };
const ImagePicker = require('expo-image-picker') as {
  launchCameraAsync(options?: Record<string, unknown>): Promise<PickerResult>;
  launchImageLibraryAsync(options?: Record<string, unknown>): Promise<PickerResult>;
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
};
type FeedToast = { tone: 'success' | 'error'; message: string };
type ToastAwareError = Error & { feedToastShown?: boolean };
type FeedPostBoxProps = {
  currentPlayer?: FeedPostBoxProfile;
  canInviteToTable?: boolean;
  hasActiveTable?: boolean;
  isAuthenticated?: boolean;
  onCreatePost: (input: ComposeFeedPostInput) => Promise<FeedPost>;
  onOpenProfile?: (player: FeedPostBoxProfile) => void;
  onPrepareTableInvite?: () => Promise<void> | void;
  onToast: (toast: FeedToast) => void;
  onUploadAttachment: (attachment: UploadFeedMediaInput) => Promise<FeedMedia>;
};
const placeholderPlayer: FeedPostBoxProfile = { handle: '@houseplayer', id: 'local-placeholder-player', name: 'House Player' };
function getPlayerInitials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'HP'; }
function toAttachment(asset: PickerAsset): LocalAttachment {
  const type = asset.type === 'video' ? 'video' : 'image';
  return { fileSize: asset.fileSize, id: asset.assetId || `${asset.uri}-${Date.now()}`, mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'), name: asset.fileName || `feed-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`, type, uri: asset.uri };
}

export function FeedPostBox({ canInviteToTable = false, currentPlayer, hasActiveTable = canInviteToTable, isAuthenticated = false, onCreatePost, onOpenProfile, onPrepareTableInvite, onToast, onUploadAttachment }: FeedPostBoxProps) {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [content, setContent] = useState('');
  const [isAttachmentSheetOpen, setIsAttachmentSheetOpen] = useState(false);
  const [isPreparingTableInvite, setIsPreparingTableInvite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTableInvite, setIsTableInvite] = useState(false);
  const player = currentPlayer ?? placeholderPlayer;
  const canPressTableInvite = Boolean(isAuthenticated && currentPlayer && canInviteToTable) && !isSubmitting && !isPreparingTableInvite;
  const canUseTableInvite = Boolean(isAuthenticated && currentPlayer && canInviteToTable && hasActiveTable) && !isSubmitting && !isPreparingTableInvite;
  const hasPostContent = content.trim().length > 0 || attachments.length > 0;
  const canSubmitTableInvite = isTableInvite && canUseTableInvite;
  const canSubmit = Boolean(currentPlayer && isAuthenticated) && (hasPostContent || canSubmitTableInvite) && !isSubmitting;
  const statusMessage = useMemo(() => {
    if (isSubmitting) return 'Uploading attachments and publishing post...';
    if (isPreparingTableInvite) return 'Creating a table and joining link for this invite...';
    if (!currentPlayer || !isAuthenticated) return 'Sign in to publish posts to the player feed.';
    if (isTableInvite && !hasActiveTable) return 'A table will be created for this invite.';
    if (isTableInvite) return 'Creates a feed post with a live poker table joining link.';
    return `Posting as ${player.name}`;
  }, [currentPlayer, hasActiveTable, isAuthenticated, isPreparingTableInvite, isSubmitting, isTableInvite, player.name]);
  const tableInviteHelper = useMemo(() => {
    if (isPreparingTableInvite) return 'Creating table invite...';
    if (!currentPlayer || !isAuthenticated) return 'Sign in to publish invite';
    if (!hasActiveTable) return 'Create a table invite link';
    return isTableInvite ? 'Live invite post selected' : 'Publish live table invite';
  }, [currentPlayer, hasActiveTable, isAuthenticated, isPreparingTableInvite, isTableInvite]);

  async function addAssets(source: 'gallery' | 'camera') {
    setIsAttachmentSheetOpen(false);
    const permission = source === 'gallery' ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { onToast({ tone: 'error', message: `Allow access to your ${source === 'gallery' ? 'photo library' : 'camera'} to attach media.` }); return; }
    const result = source === 'gallery'
      ? await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: MAX_FEED_ATTACHMENTS - attachments.length })
      : await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (!result.canceled && result.assets) {
      const selected = result.assets.map(toAttachment);
      const accepted = selected.filter((attachment) => !isFeedAttachmentOversized(attachment));
      if (accepted.length !== selected.length) onToast({ tone: 'error', message: `Attachments must be no larger than ${MAX_FEED_ATTACHMENT_SIZE_LABEL}.` });
      setAttachments((current) => appendFeedAttachments(current, accepted));
    }
  }

  async function handleSubmit() {
    const trimmedContent = content.trim();
    if (!currentPlayer || !isAuthenticated) { onToast({ tone: 'error', message: 'Sign in to publish posts to the player feed.' }); return; }
    if (!trimmedContent && attachments.length === 0 && !(isTableInvite && canUseTableInvite)) return;
    setIsSubmitting(true);
    try {
      await uploadAttachmentsAndCreatePost(attachments, trimmedContent, onUploadAttachment, (input) => {
        if (isTableInvite) {
          return onCreatePost({
            ...(input.content ? { content: input.content } : {}),
            ...(input.media.length > 0 ? { media: input.media } : {}),
            postType: 'table_invite',
          });
        }

        return onCreatePost(input.media.length > 0 ? { ...input, postType: 'media' } : { content: input.content, media: [], postType: 'text' });
      });
      setContent(''); setAttachments([]); setIsTableInvite(false);
      onToast({ tone: 'success', message: 'Post published to the feed.' });
    } catch (error) {
      if (!(error instanceof Error && (error as ToastAwareError).feedToastShown)) {
        onToast({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to upload attachments and publish your post.' });
      }
    } finally { setIsSubmitting(false); }
  }

  async function handleSelectTableInvite() {
    if (!canPressTableInvite) return;
    setIsTableInvite(true);
    if (hasActiveTable || !onPrepareTableInvite) return;
    setIsPreparingTableInvite(true);
    try {
      await onPrepareTableInvite();
    } catch {
      setIsTableInvite(false);
    } finally {
      setIsPreparingTableInvite(false);
    }
  }

  return <View style={styles.card}>
    <View style={styles.composerHeader}>
      <View>
        <Text style={styles.eyebrow}>Creator Studio</Text>
        <Text accessibilityRole="header" style={styles.heading}>Create Post</Text>
      </View>
      <View style={styles.liveBadge}><MaterialCommunityIcons color={colors.success} name="broadcast" size={14} /><Text style={styles.liveBadgeText}>Feed-ready</Text></View>
    </View>
    <View style={styles.row}>
      <Pressable accessibilityLabel={`Open ${player.name}'s profile`} accessibilityRole="button" onPress={() => onOpenProfile?.(player)} style={styles.avatarButton}><FeedAvatar initials={getPlayerInitials(player.name)} uri={player.avatarUrl} /></Pressable>
      <View style={styles.inputStack}>
        <Text style={styles.playerLabel}>{player.handle}</Text>
        <View style={styles.textboxArea}>
          <TextInput accessibilityLabel="Post content" multiline onChangeText={setContent} placeholder="What's happening at your table today?" placeholderTextColor={colors.mutedText} editable={Boolean(currentPlayer && isAuthenticated) && !isSubmitting} style={styles.input} value={content} />
          <Pressable accessibilityLabel="Attach media" accessibilityRole="button" disabled={!currentPlayer || !isAuthenticated || isSubmitting || attachments.length >= MAX_FEED_ATTACHMENTS} onPress={() => setIsAttachmentSheetOpen(true)} style={styles.attachmentButton}><MaterialCommunityIcons color={colors.secondary} name="paperclip" size={20} /></Pressable>
        </View>
        {attachments.length ? <ScrollView horizontal contentContainerStyle={styles.previewRow} showsHorizontalScrollIndicator={false}>{attachments.map((attachment) => <View key={attachment.id} style={styles.preview}>{attachment.type === 'image' ? <Image source={{ uri: attachment.uri }} style={styles.previewImage} /> : <View style={styles.videoPreview}><MaterialCommunityIcons color={colors.secondary} name="video-outline" size={28} /><Text style={styles.videoLabel}>Video</Text></View>}<Pressable accessibilityLabel={`Remove ${attachment.name}`} onPress={() => setAttachments((current) => removeFeedAttachment(current, attachment.id))} style={styles.removeButton}><MaterialCommunityIcons color={colors.text} name="close" size={15} /></Pressable></View>)}</ScrollView> : null}
      </View>
    </View>
    <View style={styles.toolRow}>
      <Pressable accessibilityRole="button" disabled={!currentPlayer || !isAuthenticated || isSubmitting || attachments.length >= MAX_FEED_ATTACHMENTS} onPress={() => setIsAttachmentSheetOpen(true)} style={styles.toolButton}><MaterialCommunityIcons color={colors.secondary} name="image-multiple-outline" size={18} /><Text style={styles.toolTitle}>Media drop</Text><Text style={styles.toolMeta}>{attachments.length}/{MAX_FEED_ATTACHMENTS}</Text></Pressable>
      {canInviteToTable ? <Pressable accessibilityRole="button" disabled={!canPressTableInvite} onPress={() => { void handleSelectTableInvite(); }} style={[styles.toolButton, !canPressTableInvite ? styles.toolButtonDisabled : null, isTableInvite ? styles.inviteOptionSelected : null]}><MaterialCommunityIcons color={isTableInvite ? colors.gold : colors.secondary} name="poker-chip" size={18} /><Text style={styles.toolTitle}>Invite to Table</Text><Text style={styles.toolMeta}>{tableInviteHelper}</Text></Pressable> : null}
    </View>
    <View style={styles.footerRow}><Text style={styles.helperText}>{statusMessage}</Text><ActionButton compact disabled={!canSubmit} icon="send-outline" label={isSubmitting ? 'Posting' : 'Post'} loading={isSubmitting} onPress={handleSubmit} /></View>
    <Modal animationType="slide" transparent visible={isAttachmentSheetOpen} onRequestClose={() => setIsAttachmentSheetOpen(false)}><Pressable style={styles.sheetBackdrop} onPress={() => setIsAttachmentSheetOpen(false)}><Pressable style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Attach media</Text><Pressable accessibilityRole="button" onPress={() => void addAssets('gallery')} style={styles.sheetAction}><MaterialCommunityIcons color={colors.secondary} name="image-multiple-outline" size={22} /><Text style={styles.sheetActionText}>Choose from gallery</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void addAssets('camera')} style={styles.sheetAction}><MaterialCommunityIcons color={colors.secondary} name="camera-outline" size={22} /><Text style={styles.sheetActionText}>Take a snap</Text></Pressable></Pressable></Pressable></Modal>
  </View>;
}

const styles = StyleSheet.create({
  attachmentButton: { alignItems: 'center', bottom: 8, height: 36, justifyContent: 'center', position: 'absolute', right: 8, width: 36 },
  avatarButton: { borderRadius: 22 },
  card: { backgroundColor: colors.roles.glassPanel, borderColor: 'rgba(255,255,255,0.14)', borderRadius: colors.radii.xl, borderWidth: 1, gap: colors.spacing[16], padding: colors.spacing[16], ...colors.shadows.md },
  composerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { ...colors.typography.chipLabel, color: colors.secondary },
  footerRow: { alignItems: 'center', flexDirection: 'row', gap: colors.spacing[12], justifyContent: 'space-between' },
  heading: { ...colors.typography.sectionTitle, color: colors.text },
  helperText: { ...colors.typography.caption, color: colors.mutedText, flex: 1 },
  input: { ...colors.typography.body, color: colors.text, minHeight: 72, paddingHorizontal: 14, paddingRight: 48, paddingVertical: 12, textAlignVertical: 'top' },
  inputStack: { flex: 1, gap: 7 },
  inviteOptionSelected: { backgroundColor: colors.goldTint, borderColor: colors.gold },
  liveBadge: { alignItems: 'center', backgroundColor: colors.successTint, borderColor: 'rgba(77,243,199,0.28)', borderRadius: colors.radii.pill, borderWidth: 1, flexDirection: 'row', gap: colors.spacing[4], paddingHorizontal: colors.spacing[8], paddingVertical: colors.spacing[4] },
  liveBadgeText: { ...colors.typography.chipLabel, color: colors.success },
  playerLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  preview: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 82, overflow: 'hidden', width: 82 },
  previewImage: { height: '100%', width: '100%' },
  previewRow: { gap: colors.spacing[8] },
  removeButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 24 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8, padding: 20, paddingBottom: 34 },
  sheetAction: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  sheetActionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'flex-end' },
  sheetHandle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 3, height: 5, marginBottom: 5, width: 42 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  textboxArea: { backgroundColor: 'rgba(5,3,11,0.34)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: colors.radii.lg, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  toolButton: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', borderRadius: colors.radii.lg, borderWidth: 1, flex: 1, gap: colors.spacing[4], minWidth: 104, padding: colors.spacing[12] },
  toolButtonDisabled: { opacity: 0.5 },
  toolMeta: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: colors.spacing[8] },
  toolTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  videoLabel: { color: colors.mutedText, fontSize: 11 },
  videoPreview: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
