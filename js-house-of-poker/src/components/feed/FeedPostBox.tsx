import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import { FeedAvatar } from './FeedAvatar';
import type { FeedPlayer } from '../../types/feed';

export type FeedPostBoxProfile = Pick<FeedPlayer, 'avatarUrl' | 'handle' | 'id' | 'name'>;

type FeedPostBoxProps = {
  currentPlayer?: FeedPostBoxProfile;
  onOpenProfile?: (player: FeedPostBoxProfile) => void;
  onPostCreated?: (content: string) => void;
};

const placeholderPlayer: FeedPostBoxProfile = {
  handle: '@houseplayer',
  id: 'local-placeholder-player',
  name: 'House Player',
};

function getPlayerInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HP';
}

export function FeedPostBox({ currentPlayer, onOpenProfile, onPostCreated }: FeedPostBoxProps) {
  const [content, setContent] = useState('');
  const [lastMockPost, setLastMockPost] = useState<string | null>(null);
  const player = currentPlayer ?? placeholderPlayer;
  const canSubmit = content.trim().length > 0;

  const statusMessage = useMemo(() => {
    if (lastMockPost) {
      return 'Post staged locally. Feed sync coming soon.';
    }

    return `Posting as ${player.name}`;
  }, [lastMockPost, player.name]);

  function handleOpenProfile() {
    onOpenProfile?.(player);
  }

  function handleSubmit() {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    // TODO(feed:createPost): Replace this local mock submit with the feed create-post API.
    // TODO(notification:feedActivity): Notify interested players after feed post creation succeeds.
    setLastMockPost(trimmedContent);
    onPostCreated?.(trimmedContent);
    setContent('');
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`Open ${player.name}'s profile`}
          accessibilityRole="button"
          onPress={handleOpenProfile}
          style={styles.avatarButton}
        >
          <FeedAvatar initials={getPlayerInitials(player.name)} uri={player.avatarUrl} />
        </Pressable>
        <View style={styles.inputStack}>
          <Text style={styles.playerLabel}>{player.handle}</Text>
          <TextInput
            multiline
            onChangeText={setContent}
            placeholder="What’s happening at the tables?"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
            value={content}
          />
        </View>
      </View>
      <View style={styles.footerRow}>
        <Text style={styles.helperText}>{statusMessage}</Text>
        <ActionButton compact disabled={!canSubmit} icon="send-outline" label="Post" onPress={handleSubmit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarButton: {
    borderRadius: 22,
  },
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
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  inputStack: {
    flex: 1,
    gap: 7,
  },
  playerLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
});
