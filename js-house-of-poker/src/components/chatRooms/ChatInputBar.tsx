import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AIPrimeButton } from './AIPrimeButton';

import { colors } from '../../theme/colors';

type ChatInputBarProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  openingAIPrime?: boolean;
  onOpenAIPrime: () => void;
  onOpenGiftClips?: () => void;
  onSend: () => void;
  placeholder?: string;
  sending?: boolean;
};

export function ChatInputBar({
  draft,
  onChangeDraft,
  openingAIPrime = false,
  onOpenAIPrime,
  onOpenGiftClips,
  onSend,
  placeholder = 'Message the room before launching a table...',
  sending = false,
}: ChatInputBarProps) {
  const canSend = Boolean(draft.trim()) && !sending;

  return (
    <View style={styles.composer}>
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
          accessibilityLabel="Add emoji"
          accessibilityRole="button"
          hitSlop={4}
          onPress={() => undefined}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <MaterialCommunityIcons color={colors.gold} name="emoticon-happy-outline" size={18} />
        </Pressable>
        {onOpenGiftClips ? (
          <Pressable
            accessibilityLabel="Send Gift Clips"
            accessibilityRole="button"
            hitSlop={4}
            onPress={onOpenGiftClips}
            style={({ pressed }) => [styles.iconButton, styles.giftButton, pressed ? styles.pressed : null]}
          >
            <MaterialCommunityIcons color={colors.gold} name="gift-outline" size={18} />
          </Pressable>
        ) : null}
        <AIPrimeButton loading={openingAIPrime} onPress={onOpenAIPrime} />
        <Pressable
          accessibilityLabel="Send chat message"
          accessibilityRole="button"
          disabled={!canSend}
          hitSlop={4}
          onPress={onSend}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend ? styles.sendButtonDisabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <MaterialCommunityIcons color={colors.background} name="send" size={17} />
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
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  composerActions: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
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
