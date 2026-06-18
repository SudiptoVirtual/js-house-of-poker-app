import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PlayerAvatar } from '../PlayerAvatar';
import { PlayerStatusBadge } from '../player/PlayerStatusBadge';
import type { PokerPlayerState } from '../../types/poker';

import { colors } from '../../theme/colors';
export type PlayerCardFriendState =
  | 'none'
  | 'request-sent'
  | 'incoming-request'
  | 'friends'
  | 'blocked'
  | 'reported';

type PlayerCardActionId =
  | 'add-friend'
  | 'accept-friend'
  | 'decline-friend'
  | 'invite-chat-room'
  | 'invite-table'
  | 'view-profile'
  | 'gift-clips';

type PlayerCardActionResult = void | string | { message?: string; friendState?: PlayerCardFriendState };

type PlayerCardActionCallback = (player: PokerPlayerState, context: PlayerCardActionContext) => PlayerCardActionResult | Promise<PlayerCardActionResult>;

export type PlayerCardActionContext = {
  currentTableId: string | null;
  currentUserId: string | null;
  selfId: string | null;
};

export type PlayerCardModalProps = {
  canGiftClips?: boolean;
  chatRoomInviteDisabled?: boolean;
  chatRoomInviteHelper?: string;
  currentTableId: string | null;
  currentUserId: string | null;
  friendState?: PlayerCardFriendState;
  isReported?: boolean;
  onAccept: PlayerCardActionCallback;
  onAddFriend: PlayerCardActionCallback;
  onClose: () => void;
  onDecline: PlayerCardActionCallback;
  onGiftClips: PlayerCardActionCallback;
  onInviteToChatRoom: PlayerCardActionCallback;
  onInviteToTable: PlayerCardActionCallback;
  onViewFullProfile: PlayerCardActionCallback;
  player: PokerPlayerState | null;
  selfId: string | null;
  tableInviteDisabled?: boolean;
  tableInviteHelper?: string;
  visible: boolean;
};

type ActionConfig = {
  disabled?: boolean;
  helper?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: PlayerCardActionId;
  label: string;
  onPress: PlayerCardActionCallback;
  tone?: 'danger' | 'muted' | 'primary' | 'success';
};

function normalizeFriendState(state: PlayerCardFriendState | undefined, isReported: boolean) {
  if (isReported) {
    return 'reported';
  }

  return state ?? 'none';
}

function getStatusCopy(player: PokerPlayerState, isSelf: boolean) {
  if (isSelf) {
    return 'This is you';
  }

  switch (player.tableStatus) {
    case 'acting':
      return 'Taking action';
    case 'all-in':
      return 'All-in';
    case 'away':
      return 'Away from table';
    case 'folded':
      return 'Folded this hand';
    case 'offline':
      return 'Offline';
    case 'seated':
      return 'At the table';
    case 'unseated':
      return 'Not seated';
    case 'unknown':
      return 'Table status unknown';
    default:
      break;
  }

  if (!player.isConnected) {
    return 'Away from table';
  }

  if (player.isTurn) {
    return 'Taking action';
  }

  if (player.hasFolded) {
    return 'Folded this hand';
  }

  return 'At the table';
}

function getOnlineCopy(player: PokerPlayerState) {
  switch (player.onlineStatus) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Presence unknown';
    default:
      return player.isConnected ? 'Online' : 'Offline';
  }
}

function getSeatCopy(player: PokerPlayerState) {
  if (player.tableStatus === 'unseated') {
    return 'unseated';
  }

  if (player.tableStatus === 'unknown') {
    return 'seat unknown';
  }

  return player.seatIndex === null ? 'seat unknown' : `seat ${player.seatIndex + 1}`;
}

function getTableCopy(player: PokerPlayerState, currentTableId: string | null) {
  const tableLabel = currentTableId ? `table ${currentTableId}` : 'table unknown';

  return `${getOnlineCopy(player)} • ${getSeatCopy(player)} • ${tableLabel}`;
}

function getProfileHandle(player: PokerPlayerState) {
  return player.handle ?? player.userId ?? 'No handle available';
}

function getResultMessage(result: PlayerCardActionResult, fallback: string) {
  if (typeof result === 'string') {
    return result;
  }

  return result?.message ?? fallback;
}

export function PlayerCardModal({
  canGiftClips = false,
  chatRoomInviteDisabled = false,
  chatRoomInviteHelper,
  currentTableId,
  currentUserId,
  friendState,
  isReported = false,
  onAccept,
  onAddFriend,
  onClose,
  onDecline,
  onGiftClips,
  onInviteToChatRoom,
  onInviteToTable,
  onViewFullProfile,
  player,
  selfId,
  tableInviteDisabled = false,
  tableInviteHelper,
  visible,
}: PlayerCardModalProps) {
  const [actionLoading, setActionLoading] = useState<PlayerCardActionId | null>(null);
  const [optimisticFriendState, setOptimisticFriendState] = useState<PlayerCardFriendState | null>(null);
  const [toast, setToast] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  const isSelf = Boolean(
    player &&
      (player.id === selfId ||
        player.id === currentUserId ||
        player.userId === selfId ||
        player.userId === currentUserId),
  );
  const resolvedFriendState = optimisticFriendState ?? normalizeFriendState(friendState, isReported);
  const isBlockedOrReported = resolvedFriendState === 'blocked' || resolvedFriendState === 'reported';
  const context = useMemo(
    () => ({ currentTableId, currentUserId, selfId }),
    [currentTableId, currentUserId, selfId],
  );

  useEffect(() => {
    if (!visible) {
      setActionLoading(null);
      setOptimisticFriendState(null);
      setToast(null);
    }
  }, [visible, player?.id]);

  if (!player) {
    return null;
  }

  async function runAction(action: ActionConfig, fallbackMessage: string, nextFriendState?: PlayerCardFriendState) {
    if (!player || action.disabled || actionLoading) {
      return;
    }

    setActionLoading(action.id);
    setToast(null);

    const previousFriendState = optimisticFriendState;

    if (nextFriendState) {
      setOptimisticFriendState(nextFriendState);
    }

    try {
      const result = await action.onPress(player, context);
      const resultFriendState = typeof result === 'object' ? result.friendState : undefined;

      if (resultFriendState) {
        setOptimisticFriendState(resultFriendState);
      }

      setToast({ tone: 'success', message: getResultMessage(result, fallbackMessage) });
    } catch (error) {
      setOptimisticFriendState(previousFriendState);
      setToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Action failed. Please try again.',
      });
    } finally {
      setActionLoading(null);
    }
  }

  const friendActions: ActionConfig[] = [];

  if (!isSelf && !isBlockedOrReported) {
    if (resolvedFriendState === 'incoming-request') {
      friendActions.push(
        {
          icon: 'account-check',
          id: 'accept-friend',
          label: 'Accept',
          onPress: onAccept,
          tone: 'success',
        },
        {
          icon: 'account-cancel',
          id: 'decline-friend',
          label: 'Decline',
          onPress: onDecline,
          tone: 'danger',
        },
      );
    } else if (resolvedFriendState === 'friends') {
      friendActions.push({
        disabled: true,
        helper: 'You are already connected.',
        icon: 'account-multiple-check',
        id: 'add-friend',
        label: 'Friends',
        onPress: onAddFriend,
        tone: 'success',
      });
    } else {
      friendActions.push({
        disabled: resolvedFriendState === 'request-sent',
        helper: resolvedFriendState === 'request-sent' ? 'Waiting for their response.' : undefined,
        icon: resolvedFriendState === 'request-sent' ? 'account-clock' : 'account-plus',
        id: 'add-friend',
        label: resolvedFriendState === 'request-sent' ? 'Request Sent' : 'Add Friend',
        onPress: onAddFriend,
        tone: 'primary',
      });
    }
  }

  const giftClipActions: ActionConfig[] = canGiftClips
    ? [
        {
          disabled: isSelf || isBlockedOrReported,
          helper: isSelf ? 'Gift Clips are for other players.' : undefined,
          icon: 'gift',
          id: 'gift-clips',
          label: 'Gift Clips',
          onPress: onGiftClips,
          tone: 'success',
        },
      ]
    : [];
  const socialActions: ActionConfig[] = [
    ...friendActions,
    {
      disabled: isSelf || isBlockedOrReported || chatRoomInviteDisabled,
      helper: isSelf ? 'You cannot invite yourself.' : chatRoomInviteHelper,
      icon: 'chat-plus',
      id: 'invite-chat-room',
      label: 'Invite to Chat Room',
      onPress: onInviteToChatRoom,
    },
    {
      disabled: isSelf || isBlockedOrReported || tableInviteDisabled || !currentTableId,
      helper: isSelf ? 'You cannot invite yourself.' : tableInviteHelper ?? (!currentTableId ? 'No active table is available.' : undefined),
      icon: 'poker-chip',
      id: 'invite-table',
      label: 'Invite to Table',
      onPress: onInviteToTable,
    },
    ...giftClipActions,
    {
      icon: 'account-details',
      id: 'view-profile',
      label: 'View Full Profile',
      onPress: onViewFullProfile,
    },
  ];

  const restrictionCopy = isSelf
    ? 'Social friend actions are hidden for your own player card.'
    : isBlockedOrReported
      ? `Social actions are disabled because this player is ${resolvedFriendState}.`
      : null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!actionLoading) {
          onClose();
        }
      }}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close player card"
          accessibilityRole="button"
          disabled={Boolean(actionLoading)}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <PlayerAvatar avatar={player.avatar} connected={player.isConnected} name={player.name} seed={player.userId ?? player.id} size="lg" status={player.playerStatus} />
            <View style={styles.identity}>
              <Text numberOfLines={1} style={styles.eyebrow}>Player Card</Text>
              <Text numberOfLines={1} style={styles.name}>{player.displayName ?? player.name}</Text>
              <Text numberOfLines={1} style={styles.handle}>{getProfileHandle(player)}</Text>
              <Text numberOfLines={1} style={styles.statusLine}>{getTableCopy(player, currentTableId)}</Text>
            </View>
            <Pressable
              accessibilityLabel="Close player card"
              accessibilityRole="button"
              disabled={Boolean(actionLoading)}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            >
              <MaterialCommunityIcons color={colors.text} name="close" size={20} />
            </Pressable>
          </View>

          <View style={styles.badgeRow}>
            <PlayerStatusBadge compact statusTier={player.statusTier} />
            {player.statusTier === 'none' && !player.statusIcon ? (
              <View style={[styles.statusBadge, styles.awayBadge]}>
                <Text style={styles.statusBadgeText}>No badge</Text>
              </View>
            ) : null}
            {player.statusIcon ? (
              <View style={[styles.statusBadge, styles.onlineBadge]}>
                <Text style={styles.statusBadgeText}>{player.statusIcon}</Text>
              </View>
            ) : null}
            <View style={[styles.statusBadge, player.isConnected ? styles.onlineBadge : styles.awayBadge]}>
              <Text style={styles.statusBadgeText}>{getStatusCopy(player, isSelf)}</Text>
            </View>
          </View>

          {restrictionCopy ? <Text style={styles.restrictionText}>{restrictionCopy}</Text> : null}
          {toast ? <Text style={[styles.toast, toast.tone === 'error' ? styles.toastError : styles.toastSuccess]}>{toast.message}</Text> : null}

          <View style={styles.actionList}>
            {socialActions.map((action) => {
              const loading = actionLoading === action.id;
              const disabled = action.disabled || Boolean(actionLoading && !loading);

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  key={action.id}
                  onPress={() => {
                    const nextFriendState =
                      action.id === 'add-friend' && resolvedFriendState === 'none'
                        ? 'request-sent'
                        : action.id === 'accept-friend'
                          ? 'friends'
                          : action.id === 'decline-friend'
                            ? 'none'
                            : undefined;
                    const fallbackMessage =
                      action.id === 'add-friend'
                        ? 'Friend request sent.'
                        : action.id === 'accept-friend'
                          ? 'Friend request accepted.'
                          : action.id === 'decline-friend'
                            ? 'Friend request declined.'
                            : `${action.label} queued.`;

                    void runAction(action, fallbackMessage, nextFriendState);
                  }}
                  style={({ pressed }) => [
                    styles.actionRow,
                    action.tone === 'primary' ? styles.actionPrimary : null,
                    action.tone === 'success' ? styles.actionSuccess : null,
                    action.tone === 'danger' ? styles.actionDanger : null,
                    disabled ? styles.actionDisabled : null,
                    pressed && !disabled ? styles.pressed : null,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={action.tone === 'danger' ? colors.danger : colors.text} size="small" />
                  ) : (
                    <MaterialCommunityIcons color={action.tone === 'danger' ? colors.danger : colors.text} name={action.icon} size={22} />
                  )}
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionLabel}>{loading ? 'Working…' : action.label}</Text>
                    {action.helper ? <Text style={styles.actionHelper}>{action.helper}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionCopy: { flex: 1, gap: 2 },
  actionDanger: { borderColor: 'rgba(255,95,137,0.36)' },
  actionDisabled: { opacity: 0.5 },
  actionHelper: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  actionLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  actionList: { gap: 10, marginTop: 14 },
  actionPrimary: { backgroundColor: 'rgba(139,92,255,0.18)', borderColor: 'rgba(139,92,255,0.48)' },
  actionRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionSuccess: { borderColor: 'rgba(77,243,199,0.36)' },
  awayBadge: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,2,8,0.72)' },
  badgeRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 16, width: 48 },
  handle: { color: colors.mutedText, fontSize: 12, fontWeight: '800', marginTop: 2 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  identity: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 22, fontWeight: '900' },
  onlineBadge: { backgroundColor: 'rgba(77,243,199,0.14)', borderColor: 'rgba(77,243,199,0.32)' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  restrictionText: { color: colors.mutedText, fontSize: 12, fontWeight: '800', marginTop: 12 },
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#100A24',
    borderColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    maxHeight: '88%',
    padding: 20,
    paddingBottom: 28,
  },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  statusLine: { color: colors.mutedText, fontSize: 12, fontWeight: '700', marginTop: 3 },
  toast: { borderRadius: 14, fontSize: 12, fontWeight: '900', marginTop: 12, overflow: 'hidden', padding: 10 },
  toastError: { backgroundColor: 'rgba(255,95,137,0.15)', color: '#FFD6E1' },
  toastSuccess: { backgroundColor: 'rgba(77,243,199,0.14)', color: '#DFFFF8' },
});
