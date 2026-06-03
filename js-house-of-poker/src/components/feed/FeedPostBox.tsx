import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import { FeedAvatar } from './FeedAvatar';
import type { FeedPlayer } from './types';

type FeedPostBoxProps = {
  currentPlayer: FeedPlayer;
  onOpenProfile: (player: FeedPlayer) => void;
  onPostCreated: (content: string) => void;
};

export function FeedPostBox({ currentPlayer, onOpenProfile, onPostCreated }: FeedPostBoxProps) {
  const [content, setContent] = useState('');

  function handleSubmit() {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    // TODO(feed:createPost): Persist post content to backend and refresh feed with API response.
    // TODO(notification:feedActivity): Broadcast new post activity after backend confirmation.
    onPostCreated(trimmedContent);
    setContent('');
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable accessibilityLabel="Open your profile" accessibilityRole="button" onPress={() => onOpenProfile(currentPlayer)}>
          <FeedAvatar initials={currentPlayer.avatarInitials} uri={currentPlayer.avatarUri} />
        </Pressable>
        <TextInput
          multiline
          onChangeText={setContent}
          placeholder="What’s happening at the tables?"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          value={content}
        />
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.helperText}>Post table talk, invites, recaps, and creator updates.</Text>
        <ActionButton compact disabled={!content.trim()} icon="send-outline" label="Post" onPress={handleSubmit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 13,
    padding: 14,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  helperText: {
    color: colors.mutedText,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
});
