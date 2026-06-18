import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../ActionButton';
import { KeyboardSafeView } from '../KeyboardSafeView';
import type { FeedPost } from './types';

import { colors } from '../../theme/colors';
const presetAmounts = [100, 500, 1000, 5000, 10000];

export type GiftClipsRecipientOption = {
  id: string;
  label: string;
  subtitle?: string;
};

type GiftClipsModalProps = {
  disabled?: boolean;
  helperText?: string;
  loading?: boolean;
  onClose: () => void;
  onSelectRecipient?: (recipientId: string) => void;
  onSendGift: (amount: number, message: string, recipientId?: string) => void | Promise<void>;
  post: FeedPost | null;
  recipientOptions?: GiftClipsRecipientOption[];
  selectedRecipientId?: string | null;
  sendLabelPrefix?: string;
  title?: string;
  visible: boolean;
};

export function GiftClipsModal({
  disabled = false,
  helperText = 'Gift Clips are a direct premium-help placeholder. They do not count as free Support.',
  loading = false,
  onClose,
  onSelectRecipient,
  onSendGift,
  post,
  recipientOptions = [],
  selectedRecipientId,
  sendLabelPrefix = 'Send',
  title,
  visible,
}: GiftClipsModalProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(500);

  const resolvedAmount = useMemo(() => {
    const parsedCustomAmount = Number(customAmount.replace(/,/g, ''));

    return Number.isFinite(parsedCustomAmount) && parsedCustomAmount > 0 ? parsedCustomAmount : selectedAmount;
  }, [customAmount, selectedAmount]);

  async function handleSend() {
    if (loading) {
      return;
    }

    await onSendGift(resolvedAmount, message.trim(), selectedRecipientId ?? undefined);
    setCustomAmount('');
    setMessage('');
    setSelectedAmount(500);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={() => {
      if (!loading) {
        onClose();
      }
    }}>
      <KeyboardSafeView>
        <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose}>
          <ScrollView
            contentContainerStyle={styles.backdropContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <Pressable style={styles.panel}>
              <View style={styles.headerRow}>
                <View style={styles.headingCopy}>
                  <Text style={styles.eyebrow}>Gift Clips</Text>
                  <Text style={styles.title}>
                    {title ?? (post ? `Support ${post.player.name}` : 'Send Gift Clips')}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close gift clips"
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={onClose}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons color={colors.text} name="close" size={20} />
                </Pressable>
              </View>

              <Text style={styles.helperText}>{helperText}</Text>

              {recipientOptions.length > 0 ? (
                <View style={styles.recipientStack}>
                  <Text style={styles.fieldLabel}>Choose recipient</Text>
                  <View style={styles.recipientGrid}>
                    {recipientOptions.map((recipient) => {
                      const isSelected = selectedRecipientId === recipient.id;

                      return (
                        <Pressable
                          accessibilityLabel={`Send Gift Clips to ${recipient.label}`}
                          accessibilityRole="button"
                          key={recipient.id}
                          onPress={() => onSelectRecipient?.(recipient.id)}
                          style={[styles.recipientChip, isSelected ? styles.recipientChipSelected : null]}
                        >
                          <Text style={[styles.recipientLabel, isSelected ? styles.recipientLabelSelected : null]}>
                            {recipient.label}
                          </Text>
                          {recipient.subtitle ? <Text style={styles.recipientSubtitle}>{recipient.subtitle}</Text> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

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
                disabled={disabled}
                icon="gift-outline"
                label={`${sendLabelPrefix} ${resolvedAmount.toLocaleString()} Gift Clips`}
                loading={loading}
                onPress={() => { void handleSend().catch(() => undefined); }}
                tone="accent"
              />
            </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardSafeView>
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
  },
  backdropContent: {
    flexGrow: 1,
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
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
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
  recipientChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flexGrow: 1,
    gap: 2,
    minWidth: '44%',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  recipientChipSelected: {
    backgroundColor: colors.successTint,
    borderColor: colors.success,
  },
  recipientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipientLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  recipientLabelSelected: {
    color: colors.success,
  },
  recipientStack: {
    gap: 8,
  },
  recipientSubtitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
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
