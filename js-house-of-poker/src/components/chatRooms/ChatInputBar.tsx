import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../../theme/colors';

type ChatInputBarProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
};

export function ChatInputBar({
  draft,
  onChangeDraft,
  onSend,
  placeholder = 'Message the room before launching a table...',
}: ChatInputBarProps) {
  const canSend = Boolean(draft.trim());

  return (
    <View style={styles.composer}>
      <TextInput
        multiline
        onChangeText={onChangeDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        style={styles.composerInput}
        value={draft}
      />
      <Pressable
        accessibilityLabel="Send chat message"
        accessibilityRole="button"
        disabled={!canSend}
        onPress={onSend}
        style={({ pressed }) => [
          styles.sendButton,
          !canSend ? styles.sendButtonDisabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <MaterialCommunityIcons color={colors.background} name="send" size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  composerInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    maxHeight: 108,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.78,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
