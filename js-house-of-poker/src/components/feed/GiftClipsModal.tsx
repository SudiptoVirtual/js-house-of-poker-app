import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import type { FeedPost } from './types';

const presetAmounts = [100, 500, 1000, 5000, 10000];

type GiftClipsModalProps = {
  onClose: () => void;
  onSendGift: (amount: number, message: string) => void;
  post: FeedPost | null;
  visible: boolean;
};

export function GiftClipsModal({ onClose, onSendGift, post, visible }: GiftClipsModalProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(500);

  const resolvedAmount = useMemo(() => {
    const parsedCustomAmount = Number(customAmount.replace(/,/g, ''));

    return Number.isFinite(parsedCustomAmount) && parsedCustomAmount > 0 ? parsedCustomAmount : selectedAmount;
  }, [customAmount, selectedAmount]);

  function handleSend() {
    // TODO(feed:giftClips): Replace mock state with wallet/clip transfer API.
    // TODO(notification:giftClips): Notify recipient when the backend confirms the gift.
    onSendGift(resolvedAmount, message.trim());
    setCustomAmount('');
    setMessage('');
    setSelectedAmount(500);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel}>
          <View style={styles.headerRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>Gift Clips</Text>
              <Text style={styles.title}>{post ? `Support ${post.player.name}` : 'Send Gift Clips'}</Text>
            </View>
            <Pressable accessibilityLabel="Close gift clips" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color={colors.text} name="close" size={20} />
            </Pressable>
          </View>

          <Text style={styles.helperText}>
            Gift Clips are a direct premium-help placeholder. They do not count as free Support.
          </Text>

          <View style={styles.amountGrid}>
            {presetAmounts.map((amount) => {
              const isSelected = !customAmount && selectedAmount === amount;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={amount}
                  onPress={() => {
                    setCustomAmount('');
                    setSelectedAmount(amount);
                  }}
                  style={[styles.amountChip, isSelected ? styles.amountChipSelected : null]}
                >
                  <Text style={[styles.amountLabel, isSelected ? styles.amountLabelSelected : null]}>
                    {amount.toLocaleString()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            keyboardType="number-pad"
            onChangeText={setCustomAmount}
            placeholder="Custom amount"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
            value={customAmount}
          />
          <TextInput
            multiline
            onChangeText={setMessage}
            placeholder="Optional message"
            placeholderTextColor={colors.mutedText}
            style={[styles.input, styles.messageInput]}
            value={message}
          />

          <ActionButton
            fullWidth
            icon="gift-outline"
            label={`Send ${resolvedAmount.toLocaleString()} Gift Clips`}
            onPress={handleSend}
            tone="accent"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  amountChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '29%',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  amountChipSelected: {
    backgroundColor: 'rgba(255,201,94,0.16)',
    borderColor: colors.gold,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  amountLabelSelected: {
    color: colors.gold,
  },
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
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headingCopy: {
    flex: 1,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  messageInput: {
    minHeight: 78,
    textAlignVertical: 'top',
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
