import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import type { FeedPost } from './types';

type PromoteForCreatorPanelProps = {
  onClose: () => void;
  onPromote: () => void;
  post: FeedPost | null;
  visible: boolean;
};

export function PromoteForCreatorPanel({ onClose, onPromote, post, visible }: PromoteForCreatorPanelProps) {
  function handlePromote() {
    // TODO(feed:promoteForCreator): Connect this sponsorship placeholder to paid promotion packages.
    onPromote();
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel}>
          <View style={styles.iconShell}>
            <MaterialCommunityIcons color={colors.gold} name="bullhorn-outline" size={30} />
          </View>
          <Text style={styles.eyebrow}>Promote for Creator</Text>
          <Text style={styles.title}>{post ? `Sponsor ${post.player.name}'s post` : 'Sponsor this post'}</Text>
          <Text style={styles.body}>
            Promote for Creator is a paid advertising sponsorship placeholder. It increases visibility later, while Support remains free community encouragement.
          </Text>
          <View style={styles.actionRow}>
            <ActionButton compact fullWidth label="Not now" onPress={onClose} variant="secondary" />
            <ActionButton compact fullWidth icon="bullhorn-outline" label="Promote" onPress={handlePromote} tone="accent" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(3,1,10,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  body: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,201,94,0.12)',
    borderColor: 'rgba(255,201,94,0.35)',
    borderRadius: 999,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
});
