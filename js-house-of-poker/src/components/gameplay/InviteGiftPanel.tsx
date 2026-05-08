import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ActionButton } from '../ActionButton';
import { complianceCopy } from '../../constants/compliance';
import type { SendPokerTableInviteInput } from '../../services/poker';
import type { PokerEconomyState } from '../../types/economy';
import type {
  PokerInviteRecipient,
  PokerInviteSource,
  PokerTableInvite,
} from '../../types/poker';
import { PanelShell } from './PanelShell';

type InviteOption = {
  id: PokerInviteSource;
  label: string;
  note: string;
};

type Props = {
  composerIntentMode?: ComposerMode;
  composerIntentToken?: number;
  economy: PokerEconomyState | null;
  giftOptions: number[];
  initialRecipientHandle?: string | null;
  initialRequestId?: string | null;
  initialSource?: PokerInviteSource;
  inviteContextLabel?: string | null;
  inviteOptions: InviteOption[];
  inviteRecipients: PokerInviteRecipient[];
  onSendInvite: (input: SendPokerTableInviteInput) => void;
  openSeats: number;
  sentInvites: PokerTableInvite[];
  tableCode: string;
};

type ComposerMode = 'gift' | 'invite' | null;

function formatInviteTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelWrap}>
        <MaterialCommunityIcons color="#B35CFF" name={icon} size={18} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function InviteGiftPanel({
  composerIntentMode = null,
  composerIntentToken = 0,
  economy,
  giftOptions,
  initialRecipientHandle,
  initialRequestId,
  initialSource,
  inviteContextLabel,
  inviteOptions,
  inviteRecipients,
  onSendInvite,
  openSeats,
  sentInvites,
  tableCode,
}: Props) {
  const appliedPresetKeyRef = useRef<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<PokerInviteSource>(
    initialSource ?? inviteOptions[0]?.id ?? 'share-link',
  );
  const [selectedRecipientAccountId, setSelectedRecipientAccountId] = useState<string | null>(
    null,
  );
  const [selectedGiftClips, setSelectedGiftClips] = useState(0);
  const [inviteMessage, setInviteMessage] = useState('');
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const clipToChipRate = economy?.compliance.clipToChipRate ?? 40;
  const activeRecipients = useMemo(
    () => inviteRecipients.filter((recipient) => recipient.source === selectedSource),
    [inviteRecipients, selectedSource],
  );
  const selectedRecipient =
    activeRecipients.find((recipient) => recipient.accountId === selectedRecipientAccountId) ??
    activeRecipients[0] ??
    null;
  const presetKey = `${initialSource ?? ''}:${initialRecipientHandle ?? ''}:${initialRequestId ?? ''}`;
  const normalizedInitialHandle = initialRecipientHandle?.trim().toLowerCase() ?? null;
  const pendingCount = sentInvites.filter((invite) => invite.status === 'pending').length;
  const acceptedCount = 0;
  const canGift =
    selectedGiftClips === 0 ||
    Boolean(
      economy &&
        economy.gifting.giftsRemainingToday > 0 &&
        selectedGiftClips <= economy.clipBalance &&
        selectedGiftClips <= economy.gifting.clipsRemainingToday,
    );
  const canSend = Boolean(selectedRecipient) && canGift;
  const selectedGiftChips = selectedGiftClips * clipToChipRate;
  const visibleNotifications = showAllNotifications ? sentInvites : sentInvites.slice(0, 3);

  useEffect(() => {
    if (!inviteOptions.some((option) => option.id === selectedSource)) {
      setSelectedSource(inviteOptions[0]?.id ?? 'share-link');
    }
  }, [inviteOptions, selectedSource]);

  useEffect(() => {
    if (!selectedRecipient) {
      setSelectedRecipientAccountId(activeRecipients[0]?.accountId ?? null);
      return;
    }

    if (selectedRecipient.accountId !== selectedRecipientAccountId) {
      setSelectedRecipientAccountId(selectedRecipient.accountId);
    }
  }, [activeRecipients, selectedRecipient, selectedRecipientAccountId]);

  useEffect(() => {
    if (!presetKey || presetKey === ':' || appliedPresetKeyRef.current === presetKey) {
      return;
    }

    if (initialSource) {
      setSelectedSource(initialSource);
    }

    if (normalizedInitialHandle) {
      const presetRecipient =
        inviteRecipients.find(
          (recipient) =>
            recipient.source === (initialSource ?? selectedSource) &&
            recipient.handle.trim().toLowerCase() === normalizedInitialHandle,
        ) ?? null;

      if (presetRecipient) {
        setSelectedRecipientAccountId(presetRecipient.accountId);
        setComposerMode('invite');
      }
    }

    appliedPresetKeyRef.current = presetKey;
  }, [
    initialSource,
    inviteRecipients,
    normalizedInitialHandle,
    presetKey,
    selectedSource,
  ]);

  useEffect(() => {
    if (!composerIntentMode) {
      return;
    }

    setComposerMode(composerIntentMode);
  }, [composerIntentMode, composerIntentToken]);

  function handleSend() {
    if (!selectedRecipient) {
      return;
    }

    const payload: SendPokerTableInviteInput = {
      recipientAccountId: selectedRecipient.accountId,
      source: selectedSource,
    };

    const trimmedMessage = inviteMessage.trim();
    if (trimmedMessage) {
      payload.message = trimmedMessage;
    }

    if (selectedGiftClips > 0) {
      payload.giftClips = selectedGiftClips;
    }

    onSendInvite(payload);
    setInviteMessage('');
    setSelectedGiftClips(0);
    setComposerMode(null);
  }

  return (
    <PanelShell eyebrow="Left Rail" title="Invites">
      <View style={styles.summaryCard}>
        <InfoRow icon="send-outline" label="Sent" value={String(sentInvites.length)} />
        <InfoRow icon="check-circle-outline" label="Accepted" value={String(acceptedCount)} />
        <InfoRow icon="clock-outline" label="Pending" value={String(pendingCount)} />
      </View>

      <View style={styles.primaryButtonRail}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setComposerMode((current) => (current === 'invite' ? null : 'invite'))}
          style={[styles.primaryRailButton, styles.primaryRailButtonInvite]}
        >
          <MaterialCommunityIcons color="#B35CFF" name="account-plus-outline" size={22} />
          <Text style={styles.primaryRailButtonText}>Invite Players</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setComposerMode((current) => (current === 'gift' ? null : 'gift'))}
          style={[styles.primaryRailButton, styles.primaryRailButtonGift]}
        >
          <MaterialCommunityIcons color="#FFCB6B" name="gift-outline" size={22} />
          <Text style={styles.primaryRailButtonText}>Gift Clips</Text>
        </Pressable>
      </View>

      {composerMode ? (
        <View style={styles.composerCard}>
          {inviteContextLabel ? (
            <Text style={styles.contextText}>{inviteContextLabel}</Text>
          ) : null}

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryStripText}>Table code {tableCode}</Text>
            <Text style={styles.summaryStripDivider}>|</Text>
            <Text style={styles.summaryStripText}>{openSeats} open seats</Text>
          </View>

          <View style={styles.laneRow}>
            {inviteOptions.map((option) => {
              const selected = option.id === selectedSource;

              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedSource(option.id)}
                  style={[styles.choiceChip, selected ? styles.choiceChipSelected : null]}
                >
                  <Text style={[styles.choiceChipText, selected ? styles.choiceChipTextSelected : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.helperText}>
            {inviteOptions.find((option) => option.id === selectedSource)?.note ?? 'Choose an invite lane.'}
          </Text>

          <View style={styles.recipientStack}>
            {activeRecipients.slice(0, 4).map((recipient) => {
              const selected = recipient.accountId === selectedRecipient?.accountId;

              return (
                <Pressable
                  key={recipient.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedRecipientAccountId(recipient.accountId)}
                  style={[styles.recipientCard, selected ? styles.recipientCardSelected : null]}
                >
                  <View style={styles.recipientCopy}>
                    <Text style={styles.recipientLabel}>{recipient.label}</Text>
                    <Text style={styles.recipientHandle}>{recipient.handle}</Text>
                  </View>
                  <Text style={styles.recipientState}>
                    {recipient.isInvited ? 'Pending' : 'Ready'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            maxLength={120}
            onChangeText={setInviteMessage}
            placeholder="Add a short invite note"
            placeholderTextColor="rgba(239, 235, 255, 0.38)"
            style={styles.noteInput}
            value={inviteMessage}
          />

          {composerMode === 'gift' ? (
            <>
              <View style={styles.giftOptionsRow}>
                {giftOptions.map((option) => {
                  const selected = option === selectedGiftClips;

                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      onPress={() => setSelectedGiftClips(option)}
                      style={[styles.giftChip, selected ? styles.giftChipSelected : null]}
                    >
                      <Text style={styles.giftChipText}>{option} clips</Text>
                      <Text style={styles.giftChipMeta}>
                        {option * clipToChipRate} chips
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.giftStatusCard}>
                <Text style={styles.giftStatusText}>
                  {selectedGiftClips > 0
                    ? `${selectedGiftClips} clips adds a ${selectedGiftChips.toLocaleString('en-US')} chip buy-in.`
                    : 'Pick a gift amount or send an invite without clips.'}
                </Text>
                <Text style={styles.giftStatusMeta}>
                  Balance {economy?.clipBalance ?? 0} clips | Remaining today {economy?.gifting.clipsRemainingToday ?? 0}
                </Text>
              </View>
            </>
          ) : null}

          <ActionButton
            compact
            disabled={!canSend}
            fullWidth
            icon={composerMode === 'gift' ? 'gift-outline' : 'account-plus-outline'}
            label={composerMode === 'gift' ? 'Send Invite + Gift' : 'Send Invite'}
            onPress={handleSend}
            tone={composerMode === 'gift' ? 'accent' : 'neutral'}
          />
        </View>
      ) : null}

      <View style={styles.notificationsCard}>
        <Text style={styles.sectionTitle}>Invite Notifications</Text>

        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((invite) => (
            <View key={invite.id} style={styles.notificationItem}>
              <Text style={styles.notificationTitle}>{invite.recipientLabel}</Text>
              <Text style={styles.notificationMeta}>
                {invite.senderPlayerName} at {formatInviteTime(invite.createdAt)}
              </Text>
              <Text style={styles.notificationBody}>
                {invite.message ??
                  (invite.giftBuyInClips > 0
                    ? `${invite.giftBuyInClips} clips attached to this table invite.`
                    : 'Table invite sent without a gift buy-in.')}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.notificationItem}>
            <Text style={styles.notificationBody}>
              Sent invites and table invite messages will appear here.
            </Text>
          </View>
        )}

        {sentInvites.length > 3 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAllNotifications((current) => !current)}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllButtonText}>
              {showAllNotifications ? 'Show less' : `View all (${sentInvites.length})`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.complianceText}>{complianceCopy.summary}</Text>
    </PanelShell>
  );
}

const styles = StyleSheet.create({
  choiceChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  choiceChipSelected: {
    backgroundColor: 'rgba(84, 28, 154, 0.98)',
    borderColor: 'rgba(180, 84, 255, 0.46)',
  },
  choiceChipText: {
    color: '#EEE8FF',
    fontSize: 11,
    fontWeight: '800',
  },
  choiceChipTextSelected: {
    color: '#FFFFFF',
  },
  complianceText: {
    color: 'rgba(239, 235, 255, 0.54)',
    fontSize: 11,
    lineHeight: 16,
  },
  composerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  contextText: {
    color: '#8BD7B7',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  giftChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255, 203, 107, 0.18)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  giftChipMeta: {
    color: 'rgba(255, 244, 221, 0.64)',
    fontSize: 10,
  },
  giftChipSelected: {
    backgroundColor: 'rgba(122, 80, 17, 0.96)',
    borderColor: 'rgba(255, 203, 107, 0.44)',
  },
  giftChipText: {
    color: '#FFF4DD',
    fontSize: 11,
    fontWeight: '800',
  },
  giftOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  giftStatusCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255, 203, 107, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  giftStatusMeta: {
    color: 'rgba(255, 244, 221, 0.56)',
    fontSize: 11,
  },
  giftStatusText: {
    color: '#FFF4DD',
    fontSize: 12,
    lineHeight: 17,
  },
  helperText: {
    color: 'rgba(239, 235, 255, 0.56)',
    fontSize: 11,
    lineHeight: 16,
  },
  infoLabel: {
    color: '#EEE8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoLabelWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  laneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 14,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notificationBody: {
    color: '#EEE8FF',
    fontSize: 12,
    lineHeight: 17,
  },
  notificationItem: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.14)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notificationMeta: {
    color: 'rgba(239, 235, 255, 0.5)',
    fontSize: 10,
    fontWeight: '700',
  },
  notificationTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  notificationsCard: {
    gap: 8,
  },
  primaryButtonRail: {
    gap: 10,
  },
  primaryRailButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  primaryRailButtonGift: {
    backgroundColor: 'rgba(31, 22, 6, 0.98)',
    borderColor: 'rgba(255, 203, 107, 0.28)',
  },
  primaryRailButtonInvite: {
    backgroundColor: 'rgba(17, 9, 31, 0.98)',
    borderColor: 'rgba(180, 84, 255, 0.28)',
  },
  primaryRailButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  recipientCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recipientCardSelected: {
    backgroundColor: 'rgba(84, 28, 154, 0.3)',
    borderColor: 'rgba(180, 84, 255, 0.46)',
  },
  recipientCopy: {
    flex: 1,
    gap: 2,
  },
  recipientHandle: {
    color: '#8BD7B7',
    fontSize: 10,
    fontWeight: '700',
  },
  recipientLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  recipientStack: {
    gap: 8,
  },
  recipientState: {
    color: '#EEE8FF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#B35CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 84, 255, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  summaryStripDivider: {
    color: 'rgba(239, 235, 255, 0.36)',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryStripText: {
    color: 'rgba(239, 235, 255, 0.68)',
    fontSize: 11,
    fontWeight: '700',
  },
  viewAllButton: {
    alignItems: 'center',
    borderColor: 'rgba(180, 84, 255, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  viewAllButtonText: {
    color: '#B35CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
