import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import { FeedAvatar } from './FeedAvatar';
import type { FeedMedia, FeedPlayer, FeedPost } from '../../types/feed';
import type { UploadFeedMediaInput } from '../../services/api/feed';
import { appendFeedAttachments, isFeedAttachmentOversized, MAX_FEED_ATTACHMENTS, MAX_FEED_ATTACHMENT_SIZE_LABEL, removeFeedAttachment, uploadAttachmentsAndCreatePost, type PendingFeedAttachment } from './attachmentWorkflow';

export type ComposeFeedPostInput = { content: string; media: FeedMedia[]; postType: 'text' | 'media' | 'table_invite' };
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
type FeedPostBoxProps = {
  currentPlayer?: FeedPostBoxProfile;
  canInviteToTable?: boolean;
  isAuthenticated?: boolean;
  onCreatePost: (input: ComposeFeedPostInput) => Promise<FeedPost>;
  onOpenProfile?: (player: FeedPostBoxProfile) => void;
  onUploadAttachment: (attachment: UploadFeedMediaInput) => Promise<FeedMedia>;
};
const placeholderPlayer: FeedPostBoxProfile = { handle: '@houseplayer', id: 'local-placeholder-player', name: 'House Player' };
function getPlayerInitials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'HP'; }
function toAttachment(asset: PickerAsset): LocalAttachment {
  const type = asset.type === 'video' ? 'video' : 'image';
  return { fileSize: asset.fileSize, id: asset.assetId || `${asset.uri}-${Date.now()}`, mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'), name: asset.fileName || `feed-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`, type, uri: asset.uri };
}

export function FeedPostBox({ canInviteToTable = false, currentPlayer, isAuthenticated = false, onCreatePost, onOpenProfile, onUploadAttachment }: FeedPostBoxProps) {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [content, setContent] = useState('');
  const [isAttachmentSheetOpen, setIsAttachmentSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTableInvite, setIsTableInvite] = useState(false);
  const player = currentPlayer ?? placeholderPlayer;
  const canSubmit = Boolean(currentPlayer && isAuthenticated) && (content.trim().length > 0 || attachments.length > 0) && !isSubmitting;
  const statusMessage = useMemo(() => isSubmitting ? 'Uploading attachments and publishing post...' : !currentPlayer || !isAuthenticated ? 'Sign in to publish posts to the player feed.' : `Posting as ${player.name}`, [currentPlayer, isAuthenticated, isSubmitting, player.name]);

  async function addAssets(source: 'gallery' | 'camera') {
    setIsAttachmentSheetOpen(false);
    const permission = source === 'gallery' ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', `Allow access to your ${source === 'gallery' ? 'photo library' : 'camera'} to attach media.`); return; }
    const result = source === 'gallery'
      ? await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: MAX_FEED_ATTACHMENTS - attachments.length })
      : await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (!result.canceled && result.assets) {
      const selected = result.assets.map(toAttachment);
      const accepted = selected.filter((attachment) => !isFeedAttachmentOversized(attachment));
      if (accepted.length !== selected.length) Alert.alert('Attachment too large', `Attachments must be no larger than ${MAX_FEED_ATTACHMENT_SIZE_LABEL}.`);
      setAttachments((current) => appendFeedAttachments(current, accepted));
    }
  }

  async function handleSubmit() {
    const trimmedContent = content.trim();
    if (!currentPlayer || !isAuthenticated) { Alert.alert('Sign in required', 'Sign in to publish posts to the player feed.'); return; }
    if (!trimmedContent && attachments.length === 0) return;
    setIsSubmitting(true);
    try {
      await uploadAttachmentsAndCreatePost(attachments, trimmedContent, onUploadAttachment, (input) => onCreatePost(isTableInvite ? { ...input, postType: 'table_invite' } : input.media.length > 0 ? { ...input, postType: 'media' } : { content: input.content, postType: 'text' }));
      setContent(''); setAttachments([]); setIsTableInvite(false);
    } catch (error) {
      Alert.alert('Post not published', error instanceof Error ? error.message : 'Unable to upload attachments and publish your post.');
    } finally { setIsSubmitting(false); }
  }

  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>Create Post</Text>
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
    {canInviteToTable ? <Pressable accessibilityRole="button" onPress={() => setIsTableInvite((current) => !current)} style={[styles.inviteOption, isTableInvite ? styles.inviteOptionSelected : null]}><MaterialCommunityIcons color={colors.gold} name="poker-chip" size={18} /><Text style={styles.inviteOptionText}>{isTableInvite ? 'Table invitation attached' : 'Invite to Table'}</Text></Pressable> : null}
    <View style={styles.footerRow}><Text style={styles.helperText}>{statusMessage}</Text><ActionButton compact disabled={!canSubmit} icon="send-outline" label={isSubmitting ? 'Posting' : 'Post'} loading={isSubmitting} onPress={handleSubmit} /></View>
    <Modal animationType="slide" transparent visible={isAttachmentSheetOpen} onRequestClose={() => setIsAttachmentSheetOpen(false)}><Pressable style={styles.sheetBackdrop} onPress={() => setIsAttachmentSheetOpen(false)}><Pressable style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Attach media</Text><Pressable accessibilityRole="button" onPress={() => void addAssets('gallery')} style={styles.sheetAction}><MaterialCommunityIcons color={colors.secondary} name="image-multiple-outline" size={22} /><Text style={styles.sheetActionText}>Choose from gallery</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void addAssets('camera')} style={styles.sheetAction}><MaterialCommunityIcons color={colors.secondary} name="camera-outline" size={22} /><Text style={styles.sheetActionText}>Take a snap</Text></Pressable></Pressable></Pressable></Modal>
  </View>;
}

const styles = StyleSheet.create({
  attachmentButton: { alignItems: 'center', bottom: 8, height: 36, justifyContent: 'center', position: 'absolute', right: 8, width: 36 }, avatarButton: { borderRadius: 22 }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: 13, padding: 14 }, footerRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' }, heading: { color: colors.text, fontSize: 18, fontWeight: '800' }, helperText: { color: colors.mutedText, flex: 1, fontSize: 12, lineHeight: 17 }, inviteOption: { alignItems: 'center', alignSelf: 'flex-start', borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingVertical: 9 }, inviteOptionSelected: { backgroundColor: 'rgba(255,201,94,0.10)', borderColor: colors.gold }, inviteOptionText: { color: colors.gold, fontSize: 13, fontWeight: '800' }, input: { color: colors.text, fontSize: 15, minHeight: 52, paddingHorizontal: 14, paddingRight: 48, paddingVertical: 12, textAlignVertical: 'top' }, inputStack: { flex: 1, gap: 7 }, playerLabel: { color: colors.secondary, fontSize: 12, fontWeight: '800' }, preview: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 82, overflow: 'hidden', width: 82 }, previewImage: { height: '100%', width: '100%' }, previewRow: { gap: 8 }, removeButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, height: 24, justifyContent: 'center', position: 'absolute', right: 4, top: 4, width: 24 }, row: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8, padding: 20, paddingBottom: 34 }, sheetAction: { alignItems: 'center', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 }, sheetActionText: { color: colors.text, fontSize: 16, fontWeight: '700' }, sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'flex-end' }, sheetHandle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 3, height: 5, marginBottom: 5, width: 42 }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6 }, textboxArea: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 18, borderWidth: 1, overflow: 'hidden', position: 'relative' }, videoLabel: { color: colors.mutedText, fontSize: 11 }, videoPreview: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
