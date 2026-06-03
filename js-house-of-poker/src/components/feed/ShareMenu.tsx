import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from '../../theme/colors';
import type { FeedPost, ShareDestination } from './types';

const shareDestinations: ShareDestination[] = [
  { icon: 'link-variant', id: 'copy-link', label: 'Copy Link' },
  { icon: 'account-circle-outline', id: 'profile', label: 'Share to Profile' },
  { icon: 'newspaper-variant-outline', id: 'feed', label: 'Share to Feed' },
  { icon: 'forum-outline', id: 'chat-room', label: 'Share to Chat Room' },
  { icon: 'poker-chip', id: 'table', label: 'Share to Table' },
  { icon: 'share-variant-outline', id: 'facebook', label: 'Share to Facebook' },
  { icon: 'bullhorn-outline', id: 'promote', label: 'Promote for Creator' },
];

type ShareMenuProps = {
  onClose: () => void;
  onPromote: () => void;
  onShare: (destinationId: string) => void;
  post: FeedPost | null;
  visible: boolean;
};

export function ShareMenu({ onClose, onPromote, onShare, post, visible }: ShareMenuProps) {
  function handleDestinationPress(destination: ShareDestination) {
    if (destination.id === 'promote') {
      onClose();
      onPromote();
      return;
    }

    // TODO(feed:sharePost): Send selected destination to backend/share socket when ready.
    onShare(destination.id);
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Share this table story</Text>
              <Text style={styles.title}>{post ? `From ${post.player.name}` : 'Share post'}</Text>
            </View>
            <Pressable accessibilityLabel="Close share menu" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color={colors.text} name="close" size={20} />
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            Share increases visibility. Promote for Creator is a separate paid sponsorship placeholder.
          </Text>
          <View style={styles.destinationStack}>
            {shareDestinations.map((destination) => (
              <Pressable
                accessibilityRole="button"
                key={destination.id}
                onPress={() => handleDestinationPress(destination)}
                style={({ pressed }) => [styles.destination, pressed ? styles.destinationPressed : null]}
              >
                <MaterialCommunityIcons
                  color={destination.id === 'promote' ? colors.gold : colors.secondary}
                  name={destination.icon}
                  size={20}
                />
                <Text style={styles.destinationLabel}>{destination.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3,1,10,0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  destination: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  destinationLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  destinationPressed: {
    opacity: 0.76,
  },
  destinationStack: {
    gap: 8,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
});
