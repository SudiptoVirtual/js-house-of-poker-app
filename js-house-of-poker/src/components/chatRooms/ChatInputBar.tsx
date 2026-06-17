import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AIPrimeButton } from './AIPrimeButton';

import { colors } from '../../theme/colors';
import type { ChatRoomMediaAttachment } from '../../types/chatRooms';

type PendingChatAttachment = { fileSize?: number; id: string; mimeType: string; name: string; type: 'image' | 'video'; uri: string };
type PickerAsset = { assetId?: string | null; fileName?: string | null; fileSize?: number; mimeType?: string; type?: string; uri: string };
type PickerResult = { canceled: boolean; assets?: PickerAsset[] | null };
const ImagePicker = require('expo-image-picker') as {
  launchImageLibraryAsync(options?: Record<string, unknown>): Promise<PickerResult>;
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
};
function toAttachment(asset: PickerAsset): PendingChatAttachment { const type = asset.type === 'video' ? 'video' : 'image'; return { fileSize: asset.fileSize, id: asset.assetId || asset.uri, mimeType: asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'), name: asset.fileName || `chat-${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`, type, uri: asset.uri }; }

type ChatInputBarProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  openingAIPrime?: boolean;
  onOpenAIPrime?: () => void;
  onOpenGiftClips?: () => void;
  onSend: (attachments?: ChatRoomMediaAttachment[]) => void | Promise<void>;
  onUploadAttachment?: (attachment: PendingChatAttachment) => Promise<ChatRoomMediaAttachment>;
  placeholder?: string;
  sending?: boolean;
  variant?: 'room' | 'direct';
};

export function ChatInputBar({
  draft,
  onChangeDraft,
  openingAIPrime = false,
  onOpenAIPrime,
  onOpenGiftClips,
  onSend,
  onUploadAttachment,
  placeholder = 'Message the room before launching a table...',
  sending = false,
  variant = 'room',
}: ChatInputBarProps) {
  const [attachments, setAttachments] = useState<PendingChatAttachment[]>([]);
  const isDirectVariant = variant === 'direct';
  const canSend = (Boolean(draft.trim()) || attachments.length > 0) && !sending;
  async function addMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: Math.max(1, 4 - attachments.length) });
    if (!result.canceled && result.assets) setAttachments((current: PendingChatAttachment[]) => [...current, ...result.assets!.map(toAttachment)].slice(0, 4));
  }
  async function sendWithAttachments() {
    const uploaded = onUploadAttachment ? await Promise.all(attachments.map(onUploadAttachment)) : [];
    await onSend(uploaded);
    setAttachments([]);
  }

  if (isDirectVariant) {
    return (
      <View style={[styles.composer, styles.directComposer]}>
        {attachments.length > 0 ? <View style={styles.attachmentPreviewRow}>{attachments.map((attachment) => <View key={attachment.id} style={styles.attachmentPreview}>{attachment.type === 'image' ? <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} /> : <MaterialCommunityIcons color={colors.gold} name="video-outline" size={18} />}<Pressable onPress={() => setAttachments((current: PendingChatAttachment[]) => current.filter((item) => item.id !== attachment.id))}><Text style={styles.removeAttachment}>x</Text></Pressable></View>)}</View> : null}
        <View style={styles.directComposerRow}>
          <Pressable
            accessibilityLabel="Attach media"
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => { void addMedia(); }}
            style={({ pressed }) => [styles.directIconButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.gold} name="paperclip" size={15} />
          </Pressable>
          <TextInput
            multiline
            onChangeText={onChangeDraft}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedText}
            editable={!sending}
            style={styles.directComposerInput}
            value={draft}
          />
          <Pressable
            accessibilityLabel="Send chat message"
            accessibilityRole="button"
            disabled={!canSend}
            hitSlop={4}
            onPress={() => { void sendWithAttachments(); }}
            style={({ pressed }) => [
              styles.directSendButton,
              !canSend ? styles.sendButtonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            {sending ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <MaterialCommunityIcons color={colors.background} name="send" size={14} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.composer}>
      {attachments.length > 0 ? <View style={styles.attachmentPreviewRow}>{attachments.map((attachment) => <View key={attachment.id} style={styles.attachmentPreview}>{attachment.type === 'image' ? <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} /> : <MaterialCommunityIcons color={colors.gold} name="video-outline" size={18} />}<Pressable onPress={() => setAttachments((current: PendingChatAttachment[]) => current.filter((item) => item.id !== attachment.id))}><Text style={styles.removeAttachment}>×</Text></Pressable></View>)}</View> : null}
      <TextInput
        multiline
        onChangeText={onChangeDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        editable={!sending}
        style={styles.composerInput}
        value={draft}
      />
      <View style={styles.composerActions}>
        <Pressable
          accessibilityLabel="Attach media"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => { void addMedia(); }}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.gold} name="paperclip" size={15} />
        </Pressable>
        {onOpenGiftClips ? (
          <Pressable
            accessibilityLabel="Send Gift Clips"
            accessibilityRole="button"
            hitSlop={4}
            onPress={onOpenGiftClips}
            style={({ pressed }) => [styles.iconButton, styles.giftButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.gold} name="gift-outline" size={15} />
          </Pressable>
        ) : null}
        {onOpenAIPrime ? <AIPrimeButton loading={openingAIPrime} onPress={onOpenAIPrime} /> : null}
        <Pressable
          accessibilityLabel="Send chat message"
          accessibilityRole="button"
          disabled={!canSend}
          hitSlop={4}
          onPress={() => { void sendWithAttachments(); }}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend ? styles.sendButtonDisabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.background} name="send" size={14} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    alignItems: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  attachmentImage: { borderRadius: 8, height: 44, width: 44 },
  attachmentPreview: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 },
  attachmentPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 6 },
  removeAttachment: { color: colors.danger, fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  composerActions: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 2,
    width: '100%',
  },
  directComposer: {
    backgroundColor: colors.background,
    borderRadius: 0,
    borderWidth: 0,
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  directComposerInput: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 109,
    minHeight: 26,
    paddingHorizontal: 12,
    paddingVertical: 3,
    textAlignVertical: 'center',
  },
  directComposerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  directIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  directSendButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  composerInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 84,
    minHeight: 20,
    paddingHorizontal: 8,
    paddingVertical: 0,
    textAlignVertical: 'center',
    width: '100%',
  },
  pressed: {
    opacity: 0.78,
  },
  giftButton: {
    backgroundColor: 'rgba(255,201,94,0.16)',
    borderColor: colors.gold,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
